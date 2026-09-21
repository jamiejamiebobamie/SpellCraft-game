// Player.ts
import { GameSymbol } from '../PlacedSpells/GameSymbol'
import { UniqueId } from '../UniqeId';

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
  private static readonly FOCUS_REGEN_AMT = -4; // amt of focus restored between turns (negative for "focusDecrement" method)
  private static readonly MAX_FOCUS_AMT = 4; // normal max focus amt
  private static readonly MAX_EXCESS_FOCUS_AMT = 4; // max focus amt player can store above MAX_FOCUS_AMT
  private static readonly BLOOD_MAGIC_COST = 5; // amt of health that is spent per spell when out of focus
  // - - - - - - - - - - - -
  // State
  healthAmt: number = Player.MAX_HEALTH_AMT;
  focusAmt: number = Player.MAX_FOCUS_AMT;
  gameSymbol: GameSymbol | null = null;
  isDoneWithTurn: boolean = true;

  constructor(direction: -1 | 1, color: string, avatarUrl: string) {
    super();
    this.direction = direction;
    this.color = color;
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

  getMaxHealth = (): number => {
    return Player.MAX_HEALTH_AMT;
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

  getColor = (): string => {
    return this.color;
  };

  getDirection = (): number => {
    return this.direction;
  }

  getIsDoneWithTurn = (): boolean => {
    return this.isDoneWithTurn;
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
    this.focusAmt = Math.min(Math.max(this.focusAmt, 0), Player.MAX_FOCUS_AMT)// + Player.MAX_EXCESS_FOCUS_AMT);
  };

  /**
   * Reduces focus to zero.
   */
  depleteFocusToZero = (): void => {
    this.focusAmt = 0;
  }

  reset = (): void => {
    this.healthAmt = Player.MAX_HEALTH_AMT;
    this.focusAmt = Player.MAX_FOCUS_AMT;
    this.setGameSymbol(null);
  }
};