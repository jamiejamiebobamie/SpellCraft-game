// Player.ts
import { Fizzle } from './Fizzle';
import { GameSymbol } from '../PlacedSpells/GameSymbol'
import { GameBoard } from '../GameBoard/GameBoard';
import { Quicken } from '../PlacedSpells/Spell';

export type NPCPlayerTurnMove = {
  isSkip: boolean;
  symbol: GameSymbol | null;
};

export class Player {
  // Constants
  readonly direction: -1 | 1; // -1 (going left) or 1 (going right)
  readonly color: string;     // Hex code

  // State
  healthAmt: number = 5;
  focusAmt: number = 4;
  isTurn: boolean = false;
  fizzles: Array<Fizzle> = [];

  // Configuration Constants
  private static readonly MAX_HEALTH_AMT = 5;
  private static readonly MAX_FOCUS_AMT = 4;
  private static readonly MAX_FIZZLES_BEFORE_BACKLASH = 3;
  private static readonly BACKLASH_DAMAGE = 20;
  private static readonly FIZZLE_LIFETIME_TURNS = 3; // How long a fizzle tracks on a player

  constructor(direction: -1 | 1, color: string) {
    this.direction = direction;
    this.color = color;
  }

  // --- Getters ---

  getIsDead = (): boolean => {
    return this.healthAmt <= 0;
  };

  getHealth = (): number => {
    return this.healthAmt;
  };

  getFocus = (): number => {
    return this.focusAmt;
  };

  getColor = (): string => {
    return this.color;
  };

  getDirection = (): number => {
    return this.direction;
  }

  getFizzleCount = (): number => {
    return this.fizzles.length;
  }

  static getMaxFizzles = (): number => {
    return Player.MAX_FIZZLES_BEFORE_BACKLASH;
  }

  static getBacklashDmg = (): number => {
    return Player.BACKLASH_DAMAGE;
  }


  // --- State Changers ---

  setIsTurn = (isTurn: boolean, currentGlobalTurn: number): void => {
    this.isTurn = isTurn;
    
    // Automatically manage temporal states when a turn transitions
    if (isTurn) {
      this.updateFizzles(currentGlobalTurn);
    }
  };

  /**
   * Deducts health points. Pass a negative number to heal the player.
   */
  decrementHealth = (healthDecrement: number): void => {
    this.healthAmt -= healthDecrement;
    // clamp values between 0 and max
    this.healthAmt = Math.min(Math.max(this.healthAmt, 0), Player.MAX_HEALTH_AMT);
  };

  /**
   * Deducts focus points. Pass a negative number to regenerate focus.
   */
  decrementFocus = (focusDecrement: number): void => {
    this.focusAmt -= focusDecrement;
    // clamp values between 0 and max
    this.focusAmt = Math.min(Math.max(this.focusAmt, 0), Player.MAX_FOCUS_AMT);
  };

  /**
   * Deducts focus points. Pass a negative number to regenerate focus.
   */
  depleteFocus = (): void => {
    this.focusAmt = 0;
  }

  /**
   * Logs a new gesture drawing failure and instantly verifies if it triggers a Backlash.
   */
   addFizzle = (currentGlobalTurn: number): void => {

    this.decrementFocus(1);

    // Instantiate using the current global turn and a custom duration limit
    this.fizzles.push(new Fizzle(currentGlobalTurn, Player.FIZZLE_LIFETIME_TURNS));
    
    if (this.fizzles.length > Player.MAX_FIZZLES_BEFORE_BACKLASH) {
      this.doBacklash();
    }
  };

  doBacklash = (): void => {
    this.decrementHealth(Player.BACKLASH_DAMAGE);
    this.fizzles = []; // Wipe historical fizzles clean after punishing
    console.warn(`Backlash triggered! Damage dealt.`);
  };

  /**
   * Decrements lifetime ticks on active tracking fizzles and removes expired ones.
   */
  /**
   * Cleans up expired elements on turn boundaries.
   */
  updateFizzles = (currentGlobalTurn: number): void => {
    // 1. Trigger the explicit remove hook for anything that is about to vanish
    this.fizzles
      .filter(fizzle => fizzle.getIsExpired(currentGlobalTurn))
      .forEach(fizzle => fizzle.remove());

    // 2. Keep only the active, unexpired fizzles
    this.fizzles = this.fizzles.filter(fizzle => !fizzle.getIsExpired(currentGlobalTurn));
  };
}

export class NPCPlayer extends Player {
  gameBoardRef: GameBoard;
  difficulty: number; // Dynamic slider integer: [1, 10]

  constructor(direction: -1 | 1, color: string, gameBoardRef: GameBoard, difficulty: number = 6) {
    super(direction, color);
    this.gameBoardRef = gameBoardRef;
    
    // Clamp difficulty constructor fallback strictly to valid bounds
    this.difficulty = Math.max(1, Math.min(10, difficulty));
  }

  /**
   * Analyzes board positioning vectors to make the optimal competitive choice.
   */
  getIdealMove = (): NPCPlayerTurnMove => {
    // Engine hook placeholder: evaluate row vectors, open targets, or threats
    return {
      isSkip: false,
      symbol: new GameSymbol(this, 25, Quicken)
    };
  };

  /**
   * Completely ignores board state and generates a randomized turn option.
   */
  getRandomMove = (): NPCPlayerTurnMove => {
    const shouldSkip = Math.random() > 0.8;
    return {
      isSkip: shouldSkip,
      symbol: shouldSkip ? null : new GameSymbol(this, 15, Quicken)
    };
  };

  /**
   * Evaluates AI intent probability thresholds based on the difficulty variable.
   */
  doMove = (currentGlobalTurn: number): void => {
    // Produce a ceiling integer match between 1 and 10
    const roll = Math.ceil(Math.random() * 10);
    
    let chosenMove: NPCPlayerTurnMove;

    if (this.difficulty <= roll) {
      chosenMove = this.getRandomMove();
    } else {
      chosenMove = this.getIdealMove();
    }

    // Execute the chosen AI action
    if (chosenMove.isSkip || !chosenMove.symbol) {
      console.log(`${this.color} NPC chose to pass.`);
      this.setIsTurn(false, currentGlobalTurn);
      return;
    }

    // Attempt to invoke the spell matching the decision choice
    const spawnedSpell = chosenMove.symbol.instantiateSpell('squiggle', currentGlobalTurn);

    if (!spawnedSpell) {
      // If the AI failed the roll/gesture, log it on the player profile
      this.addFizzle(currentGlobalTurn);
    }
  };
}