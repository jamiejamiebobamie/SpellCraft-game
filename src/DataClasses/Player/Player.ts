// Player.ts
import { GameSymbol } from '../PlacedSpells/GameSymbol'
import { UniqueId } from '../UniqueId/UniqeId';
import { PLAYER_RULES } from '../PlacedSpells/spellRules';

export class Player extends UniqueId {
  // Constants
  readonly direction: -1 | 1; // -1 (going left) or 1 (going right)
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
  private static readonly FOCUS_REGEN_AMT = -3; // amt of focus restored between turns (negative for "focusDecrement" method; 2 was tried)
  private static readonly MAX_FOCUS_AMT = 4; // normal max focus amt
  private static readonly MAX_EXCESS_FOCUS_AMT = 4; // max focus amt player can store above MAX_FOCUS_AMT
  private static readonly BLOOD_MAGIC_COST = PLAYER_RULES.bloodMagicHealthPerFocus; // health spent per missing focus point
  // - - - - - - - - - - - -
  // State
  healthAmt: number = Player.MAX_HEALTH_AMT;
  focusAmt: number = Player.MAX_FOCUS_AMT;
  gameSymbol: GameSymbol | null = null;
  isDoneWithTurn: boolean = false;
  isBeginIntroWalk: boolean = false;
  isDoneWithIntroWalk: boolean = false;

  constructor(direction: -1 | 1, avatarUrl: string) {
    super();
    this.direction = direction;
    this.avatarUrl = avatarUrl;
  }

  // --- Getters ---

  getGameSymbol = (): GameSymbol | null => {
    return this.gameSymbol;
  }

  getIsDead = (): boolean => {
    return this.healthAmt <= 0;
  };

  getHealth = (): number => {
    return this.healthAmt;
  };

  getHealthPrct = (): number => {
    return (this.healthAmt / Player.MAX_HEALTH_AMT) * 100
  }

  // focus restored between turns
  getFocusRegenAmt = (): number => {
    return Player.FOCUS_REGEN_AMT;
  };

  // focus restored between turns
  getBloodMagicCost = (): number => {
    return Player.BLOOD_MAGIC_COST;
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

  getDirection = (): number => {
    return this.direction;
  }

  getIsDoneWithTurn = (): boolean => {
    return this.isDoneWithTurn;
  }

  getIsBeginIntroWalk = (): boolean => {
    return this.isBeginIntroWalk;
  }

  setIsBeginIntroWalk = (isBegin?: boolean): void => {
    this.isBeginIntroWalk = typeof isBegin == 'boolean' ? isBegin : true;
  }

  getIsDoneWithIntroWalk = (): boolean => {
    return this.isDoneWithIntroWalk;
  }

  setIsDoneWithIntroWalk = (isDone?: boolean): void => {
    this.isDoneWithIntroWalk = typeof isDone == 'boolean' ? isDone : true;
  }

  setIsDoneWithTurn = (isDoneWithTurn: boolean): void => {
    this.isDoneWithTurn = isDoneWithTurn;
  }

  // --- State Changers ---

  setGameSymbol = (gameSymbol: GameSymbol | null): void => {
    this.gameSymbol = gameSymbol;
  }

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
    this.focusAmt = Math.min(Math.max(this.focusAmt, 0), Player.MAX_FOCUS_AMT + Player.MAX_EXCESS_FOCUS_AMT);
  };

  /**
   * Reduces focus to zero.
   */
  depleteFocusToZero = (): void => {
    this.focusAmt = 0;
  }

  reset(): void {
    this.healthAmt = Player.MAX_HEALTH_AMT;
    this.focusAmt = Player.MAX_FOCUS_AMT;
    this.setGameSymbol(null);
    this.isDoneWithTurn = false;
  }

  /*
  * Accepts the FocusCost of the Spell.
  * Decrements that amount of Focus from the Player
  * Returns the Health cost (if any) for the Spell.
  */
  incurPlayerCostForSpell = (focusCost: number): number => {
    // (the cast's cap, if any, is in gameRules.getFocusCost)
    const cost = Math.max(1, Math.ceil(focusCost));
    if (this.getFocus() >= cost) {
      this.decrementFocus(cost);
      return 0;
    } else {
      const difference = cost - this.getFocus();
      this.depleteFocusToZero();
       // Health covers the remaining resource debt
      this.decrementHealth(difference * this.getBloodMagicCost());
      return difference * this.getBloodMagicCost();
    }
  }
};