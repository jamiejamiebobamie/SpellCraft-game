// Player.ts
import { GameSymbol, NpcPlaceSpellOnBoardFunc } from '../PlacedSpells/GameSymbol'
import { GameBoard } from '../GameBoard/GameBoard';
import { UniqueId } from '../UniqeId';
import { InferenceString } from '../types';
import { proxy } from 'valtio';

export type NPCPlayerTurnMove = {
  isSkip: boolean;
  symbol: GameSymbol | null;
};

export class Player extends UniqueId {
  // Constants
  readonly direction: -1 | 1; // -1 (going left) or 1 (going right)
  readonly color: string;     // Hex code
  readonly avatarUrl!: string;

  readonly avatarRightArmUrl: string = './player_avatars/RightArm.png';
  readonly avatarWandHandUrl: string = './player_avatars/WandHand.png';
  readonly avatarForearmUrl: string = './player_avatars/Forearm.png';

  readonly avatarHeadUrl: string = './player_avatars/Head1.png';
  readonly avatarRobeUrl: string = './player_avatars/Robe1a.png';
  readonly avatarBicepUrl: string = './player_avatars/Bicep1.png';

  // Configuration Constants
  private static readonly MAX_HEALTH_AMT = 100;
  // - - FOCUS - - - - - - -
  private static readonly FOCUS_REGEN_AMT = -1; // amt of focus restored between turns (negative for "focusDecrement" method)
  private static readonly MAX_FOCUS_AMT = 4; // normal max focus amt
  private static readonly MAX_EXCESS_FOCUS_AMT = 4; // max focus amt player can store above MAX_FOCUS_AMT
  // - - - - - - - - - - - -
  /*
    If player-drawn symbol is:
      (1) too short or 
      (2) if "runInference" finds it to be a "square" or "squiggle"
    player spell is a "Fizzle" (a "whiff" / "oopsy").

    Fizzles create a "Backlash," which decrements Focus as if the spell was successful.
    If player has no Focus, Backlash causes damage to player health.
  */
  private static readonly BACKLASH_DAMAGE = 1;
  // State
  healthAmt: number = Player.MAX_HEALTH_AMT;
  focusAmt: number = Player.MAX_FOCUS_AMT;
  isTurn: boolean = false;
  checkGameOverCallback!: Function;

  constructor(direction: -1 | 1, color: string, avatarUrl: string, checkGameOverCallback: Function) {
    super();
    this.direction = direction;
    this.color = color;
    this.avatarUrl = avatarUrl;
    this.checkGameOverCallback = checkGameOverCallback;
  }

  // --- Getters ---

  getIsDead = (): boolean => {
    return this.healthAmt <= 0;
  };

  getHealth = (): number => {
    return this.healthAmt;
  };

  getMaxHealth = (): number => {
    return Player.MAX_HEALTH_AMT;
  };

  getHealthPrct = (): number => {
    return (this.healthAmt / Player.MAX_HEALTH_AMT) * 100
  }

  getBacklashDmg = (): number => {
    return Player.BACKLASH_DAMAGE;
  }

  // focus restored between turns
  getFocusRegenAmt = (): number => {
    return Player.FOCUS_REGEN_AMT;
  };

  // current amt of focus player has
  getFocus = (): number => {
    return this.focusAmt;
  };

  // normal max or cap on focus
  getMaxFocus = (): number => {
    return Player.MAX_FOCUS_AMT;
  };

  // excess focus allowed above normal max
  getMaxExcessFocus = (): number => {
    return Player.MAX_EXCESS_FOCUS_AMT;
  };

  getColor = (): string => {
    return this.color;
  };

  getDirection = (): number => {
    return this.direction;
  }

  static getBacklashDmg = (): number => {
    return Player.BACKLASH_DAMAGE;
  }


  // --- State Changers ---

  setIsTurn = (isTurn: boolean): void => {
    this.isTurn = isTurn;
  };

  /**
   * Deducts health points. Pass a negative number to heal the player.
   */
  decrementHealth = (healthDecrement: number): void => {
    this.healthAmt -= healthDecrement;
    // clamp values between 0 and max
    this.healthAmt = Math.min(Math.max(this.healthAmt, 0), Player.MAX_HEALTH_AMT);
    this.checkGameOverCallback();
  };

  /**
   * Deducts focus points. Pass a negative number to regenerate focus.
   */
  decrementFocus = (focusDecrement: number): void => {
    this.focusAmt -= focusDecrement;
    // clamp values between 0 and max
    this.focusAmt = Math.min(Math.max(this.focusAmt, 0), Player.MAX_FOCUS_AMT + Player.MAX_EXCESS_FOCUS_AMT);
  };

  /**
   * Reduces focus to zero.
   */
  depleteFocusToZero = (): void => {
    this.focusAmt = 0;
  }

  reset = (): void => {
    this.healthAmt = 5;
    this.focusAmt = 4;
  }
}


export class NPCPlayer extends Player {
  gameBoard: GameBoard | null = null;
  castSpeed!: number;
  npcPlaceSpellOnBoard!: NpcPlaceSpellOnBoardFunc;
  castingLoopInterval: number | undefined = undefined;
  appendToLog: Function | null = null;

  readonly avatarHeadUrl: string = './player_avatars/Head2.png';
  readonly avatarRobeUrl: string = './player_avatars/Robe2a.png';
  readonly avatarBicepUrl: string = './player_avatars/Bicep2.png';

  constructor(direction: -1 | 1, color: string, avatarUrl: string, checkGameOverCallback: Function, castSpeed: number, npcPlaceSpellOnBoard: NpcPlaceSpellOnBoardFunc) {//, gameBoardRef: GameBoard, difficulty: number = 6) {
    super(direction, color, avatarUrl, checkGameOverCallback);

    this.castSpeed = castSpeed;
    this.npcPlaceSpellOnBoard = npcPlaceSpellOnBoard;
  }

  setGameBoard = (gameBoard: GameBoard): void => {
    this.gameBoard = gameBoard;
  }

  /*
  
    TO-DO:
    implement "combos".
    "combos" -> in a single turn, place lower priority spell on owner cell, place later priority spell "in front" to be consumed.
  
  
    COMBOS: (1) phlegm + phlegm = +2 heal for self
            (2) quicken + quicken = +4 speed
            (3) star + quicken = +2 speed +2 dmg
            (4) quicken + star = +2 speed +2 dmg

    TO-DO: figure out if consumed spell modifiers stack and if not, why not...        

  */

  getMove = (): [InferenceString, number?] => {
    const isHasFocus = this.focusAmt > 1;

    if (this.gameBoard != null) {
      const i = this.gameBoard.npcGetFutureSpellCollisionRow();
      const isIncomingSpell = i != -1;

      // REFLECT spell BACK!
      if (isIncomingSpell && isHasFocus) {
        return ['circle', i];
      }

      // SHIFT spell OFF COURSE!
      if (isIncomingSpell && !isHasFocus) {
        const GAME_SYMBOLS: Array<InferenceString> = ['diamond', 'triangle']
        const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
        const inferenceString = GAME_SYMBOLS[rand];
        return [inferenceString, i];
      }

      // HEAL!
      // if (this.healthAmt < 4 && isHasFocus) {
      //   const healingRowIndex = this.gameBoard.npcGetHealingRow();
      //   return ['circle', healingRowIndex];
      // }

    }

    // SKIP
    if (!isHasFocus) {
      return ['SKIP']
    }

    // Do random damaging attack
    let GAME_SYMBOLS: Array<InferenceString> = ['line', 'star']
    const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
    const inferenceString = GAME_SYMBOLS[rand];
    return [inferenceString];
  };

  doRandomMove = (): [InferenceString, number?] => {
    // SKIP
    if (this.focusAmt > 1) {
      return ['SKIP']
    }
    // Do random spell with chance of fizzle and skip
    let GAME_SYMBOLS: Array<InferenceString> = ['line', 'circle', 'star', 'triangle', 'diamond', 'squiggle', 'SKIP', 'SKIP', 'SKIP'];
    const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
    const inferenceString = GAME_SYMBOLS[rand];
    return [inferenceString];
  }

  startCastingLoop = (): void => {
    this.castingLoopInterval = setInterval(() => {
      const [inferenceString, cellRowIndex] = this.getMove();//Math.random() > .7 ? this.doRandomMove() : this.getMove();
      // if (this.appendToLog)
      //   this.appendToLog(`${inferenceString} ${cellRowIndex}`, 'black');
      if (inferenceString != 'SKIP') {
        const gameSymbol = proxy(new GameSymbol(inferenceString, this));
        this.npcPlaceSpellOnBoard(gameSymbol, cellRowIndex);
      }
    }, this.castSpeed);
  }

  stopCastingLoop = (): void => {
    clearInterval(this.castingLoopInterval);
  }

  setAppendToLogMethod = (appendToLog: Function): void => {
    this.appendToLog = appendToLog;
  }
}