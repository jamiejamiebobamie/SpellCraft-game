// Spell.ts
import { CellIndex, SpellPropertyName, Direction } from '../types';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

export abstract class Spell extends UniqueId {
  static readonly spellName: string;
  readonly caster: Player;
  protected static readonly focusCost: number = 0;
  cellIndex!: CellIndex;
  readonly key!: string;
  isRemove: boolean = false;
  isPlaced: boolean = false;
  empoweredColor: string = '';
  protected empoweredPng: number = 0;
  spellIconUrl: string = '';

  baseCellDmg: number = 5;
  updateOrder: number = 0;
  speedDirection: number = 0;
  dmgHealth: number = 0;
  upDown: number = 0;
  rowShift: number = 0;
  gyreLives: number = 0;
  empoweredDmgHealth: number = 0;
  empoweredSpeedDirection: number = 0;

  // Add to your base Spell class properties area in Spell.tsx
  isPlayerHitImpact: boolean = false;
  isOpponentHitImpact: boolean = false;
  hitDamageAmount: number = 0;

  // Dimensions properties driving dynamic stats calculations (PART 2 Requirements)
  widthCells: number = 1;
  heightCells: number = 1;

  isBeingConsumed: boolean = false;
  consumedEthers: number = 0;
  consumedPhlegms: number = 0;
  consumedQuickens: number = 0;
  consumedGyres: number = 0;

  // Real-time loop step counters monitored by the execution system
  remainingMoves: number = 0;
  recordedMovesCount: number = 0;

  // Vector field tracking mechanics
  phlegmOrbitStepsSpent: number = 0;
  inPhlegmField: boolean = false;

  // Add these inside the base Spell class properties area
  phlegmCenterIndex: CellIndex | null = null;
  phlegmSize: number = 1;
  phlegmOrbitStepsRemaining: number = 0;
  phlegmExitOnOppositeSide: boolean = false;
  phlegmDirectionSign: number = 1; // 1 for right-moving Phlegm, -1 for left-moving Phlegm


  readonly limits = {
    updateOrder: { min: 1, max: Number.MAX_SAFE_INTEGER },
    speedDirection: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    dmgHealth: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    rowShift: { min: -1, max: 1 },
    upDown: { min: -1, max: 1 },
    gyreLives: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    empoweredPng: { min: 0, max: 3 },
    empoweredSpeedDirection: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    empoweredDmgHealth: { min: 0, max: Number.MAX_SAFE_INTEGER },
    consumedEthers: { min: 0, max: Number.MAX_SAFE_INTEGER },
    consumedPhlegms: { min: 0, max: Number.MAX_SAFE_INTEGER },
    consumedQuickens: { min: 0, max: Number.MAX_SAFE_INTEGER }
  };

  readonly primaryModifiers: Array<SpellPropertyName> = [];
  readonly secondaryModifiers: Array<SpellPropertyName> = [];

  constructor(caster: Player) {
    super();
    this.caster = caster;
    this.speedDirection = caster.getDirection();
    this.key = String(Math.random());
  }

  getSpellName = (): string => {
    const currentClass = this.constructor as any;
    return currentClass.spellName || "Unknown Spell";
  };

  getSpellIcon = (): string => this.spellIconUrl;
  getCaster = (): Player => this.caster;
  getCellIndex = (): CellIndex => this.cellIndex;
  setCellIndex = (cellIndex: CellIndex): void => { this.cellIndex = proxy(cellIndex); };
  getIsPlaced = (): boolean => this.isPlaced;
  getEmpoweredPng = (): number => this.empoweredPng;
  getIsEmpowered = (): boolean => this.empoweredPng !== 0;
  getEmpoweredColor = (): string => this.empoweredColor;

  setConditionallyEmpoweredPng = (neighborSpell: Array<Spell | null>): void => {
    const [behind, inFront] = neighborSpell;
    let isBehind = this.isConditionToEmpower(behind);
    let isInFront = this.isConditionToEmpower(inFront);
    if (isBehind && isInFront) this.empoweredPng = 2;
    else if (isBehind) this.empoweredPng = 3;
    else if (isInFront) this.empoweredPng = 1;
    else this.empoweredPng = 0;
  };

  setEmpoweredPng = (empoweredPng: number): void => { this.empoweredPng = empoweredPng; };
  isConditionToEmpower = (neighborSpell: Spell | null) => false;
  getEmpoweredDirection = (): Direction => 0;
  setIsPlaced = (isPlaced: boolean): void => { this.isPlaced = isPlaced; };
  getIsRemove = (): boolean => this.isRemove;
  markSpellForRemoval = (): void => { this.isRemove = true; };

  /**
   * Refactored Size-Driven Property Accessors (PART 2 Requirements)
   */
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    const totalCellsSize = this.widthCells * this.heightCells;

    if (propertyName === 'empoweredDmgHealth' || propertyName === 'dmgHealth') {
      let baseDmg = totalCellsSize * this.baseCellDmg;
      if (this instanceof Ether || this.consumedEthers > 0) baseDmg += 5; // isOnFire
      if (this instanceof Phlegm) return -baseDmg; // Baseline negative value for healing properties
      return baseDmg;
    }

    if (propertyName === 'empoweredSpeedDirection' || propertyName === 'speedDirection') {
      let baseSpeed = this.widthCells;
      if (this instanceof Quicken || this.consumedQuickens > 0) baseSpeed += 1; // isElectrified
      return baseSpeed * Math.sign(this.speedDirection || 1);
    }

    return (this as any)[propertyName] || 0;
  };

  updatePropertyValue = (propertyName: SpellPropertyName, value: number): void => {
    const limit = (this.limits as any)[propertyName];
    if (limit) {
      (this as any)[propertyName] = Math.max(limit.min, Math.min(limit.max, value));
    } else {
      (this as any)[propertyName] = value;
    }
  };

  executeSingleMicroStep = (): void => {
    // 1. Gyre vertical movement overrides horizontal tracks
    if (this.consumedGyres !== 0) {
      const stepDir = Math.sign(this.consumedGyres);
      this.cellIndex = proxy({
        i: this.cellIndex.i + stepDir,
        j: this.cellIndex.j
      });
      this.consumedGyres -= stepDir;
      return;
    }

    // 2. Vector field implementation for orbital paths inside Phlegm layouts
    if (this.inPhlegmField && this.phlegmCenterIndex) {
      this.executePhlegmOrbitStep();
      return;
    }

    // 3. Fallback to basic horizontal movement paths
    this.moveHorizontally();
  };

  /**
   * Calculates perimeter movement along a square matrix grid
   */
  private executePhlegmOrbitStep = (): void => {
    if (this.phlegmOrbitStepsRemaining <= 0) {
      this.inPhlegmField = false;
      this.phlegmCenterIndex = null;
      this.moveHorizontally(); // Exit orbit step forward
      return;
    }

    const size = this.phlegmSize;
    const half = Math.floor(size / 2);

    if (!this.phlegmCenterIndex) return;

    // Calculate relative bounds from the root center cell index of the Phlegm structure
    const minI = this.phlegmCenterIndex.i;
    const maxI = this.phlegmCenterIndex.i + size - 1;
    const minJ = this.phlegmCenterIndex.j;
    const maxJ = this.phlegmCenterIndex.j + size - 1;

    let nextI = this.cellIndex.i;
    let nextJ = this.cellIndex.j;

    const isClockwise = this.phlegmDirectionSign === 1;

    // Determine direction vectors based on edge coordinates
    if (isClockwise) {
      // Clockwise edge movement matrix
      if (this.cellIndex.i === minI && this.cellIndex.j < maxJ) {
        nextJ++; // Top edge moves Right
      } else if (this.cellIndex.j === maxJ && this.cellIndex.i < maxI) {
        nextI++; // Right edge moves Down
      } else if (this.cellIndex.i === maxI && this.cellIndex.j > minJ) {
        nextJ--; // Bottom edge moves Left
      } else if (this.cellIndex.j === minJ && this.cellIndex.i > minI) {
        nextI--; // Left edge moves Up
      }
    } else {
      // Counter-Clockwise edge movement matrix
      if (this.cellIndex.i === minI && this.cellIndex.j > minJ) {
        nextJ--; // Top edge moves Left
      } else if (this.cellIndex.j === minJ && this.cellIndex.i < maxI) {
        nextI++; // Left edge moves Down
      } else if (this.cellIndex.i === maxI && this.cellIndex.j < maxJ) {
        nextJ++; // Bottom edge moves Right
      } else if (this.cellIndex.j === maxJ && this.cellIndex.i > minI) {
        nextI--; // Right edge moves Up
      }
    }

    this.cellIndex = proxy({ i: nextI, j: nextJ });
    this.phlegmOrbitStepsRemaining--;

    // Clean exit verification on the final orbital tick step
    if (this.phlegmOrbitStepsRemaining === 0) {
      this.inPhlegmField = false;
      this.phlegmCenterIndex = null;
      if (!this.phlegmExitOnOppositeSide) {
        this.reverseDirection();
      }
    }
  };

  moveHorizontally = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    });
  };

  moveVertically = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i + this.upDown,
      j: this.cellIndex.j
    });
    this.upDown = 0;
  };

  resolveSpellCollision = (inactive: Spell): void => {
    inactive.conferModifierToActive(this);
  };

  conserveGreater = (consumed: Spell, properties: Array<SpellPropertyName>): void => {
    properties.forEach(spn => {
      const sign = Math.sign(this.getPropertyValue(spn));
      const currentValue = Math.abs(this.getPropertyValue(spn));
      const otherValue = Math.abs(consumed.getPropertyValue(spn));
      if (otherValue > currentValue) {
        this.updatePropertyValue(spn, otherValue * sign);
      }
    });
  };

  accumulateProperty = (consumed: Spell, spn: SpellPropertyName, multiplier: number = 1): void => {
    const currentValue = this.getPropertyValue(spn);
    const otherValue = consumed.getPropertyValue(spn);
    const newValue = (currentValue + Math.abs(otherValue) * Math.sign(currentValue || 1)) * multiplier;
    this.updatePropertyValue(spn, newValue);
  };

  reverseDirection = (): void => {
    this.speedDirection *= -1;
  };

  resolvePlayerCollision = (otherPlayer: Player, dmgHealth: number): void => {
    otherPlayer.decrementHealth(dmgHealth);
  };

  getEmpoweredNeighborIndexOffsets = (direction: Direction): Array<CellIndex> => [];

  abstract conferModifierToActive(consumer: Spell): void;
  abstract conferModifierToInactive(consumer: Spell): void;
  abstract isModifierValueInvalid(): boolean;
  abstract getFocusCost(): number;
  abstract getModifierLogText(consumer: Spell): string;
}

// --- Subclasses ---

export class Phlegm extends Spell {
  protected static readonly focusCost: number = 1;
  static readonly spellName = "Phlegm";
  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift', 'speedDirection'];

  constructor(caster: Player) {
    super(caster);
    this.spellIconUrl = 'spell-icons/PhlegmIcon_mockup.png';
  }

  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);

  conferModifierTo = (consumer: Spell): void => {
    const phlegmSize = this.widthCells; // 1, 2, or 3

    // A full perimeter loop calculation: 4 * (size - 1), minimum 1 step for 1x1 pieces
    const fullCircleSteps = phlegmSize > 1 ? 4 * (phlegmSize - 1) : 1;

    consumer.inPhlegmField = true;
    consumer.phlegmCenterIndex = { ...this.cellIndex };
    consumer.phlegmSize = phlegmSize;
    consumer.phlegmDirectionSign = Math.sign(this.getPropertyValue('speedDirection') || 1);
    consumer.phlegmOrbitStepsRemaining = fullCircleSteps;

    if (consumer instanceof Phlegm) {
      this.consumedPhlegms++;
      consumer.accumulateProperty(this, 'consumedPhlegms');

      // Phlegm-on-Phlegm collision exits opposite side to fly back safely to player
      consumer.phlegmExitOnOppositeSide = true;

      // Add extra steps if consumer requires structural breakdown overhead adjustments
      const baseDamageDelta = Math.abs(consumer.getPropertyValue('dmgHealth')) - Math.abs(this.getPropertyValue('dmgHealth'));
      if (baseDamageDelta > 0) {
        consumer.phlegmOrbitStepsRemaining += Math.floor(baseDamageDelta / 5);
      }
    } else {
      // Standard projectile loops fully and flips vector directions back out
      consumer.phlegmExitOnOppositeSide = false;
    }

    // Extend active step limits so the engine doesn't cut the animation path early
    consumer.remainingMoves += consumer.phlegmOrbitStepsRemaining;

    this.markSpellForRemoval();
  };


  isModifierValueInvalid = (): boolean => this.getPropertyValue('dmgHealth') >= 0;
  getFocusCost = (): number => Phlegm.focusCost;
  getModifierLogText = (consumer: Spell): string => 'redirected smoothly!';
}

export class Ether extends Spell {
  protected static readonly focusCost: number = 1;
  static readonly spellName = "Ether";
  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift', 'speedDirection'];

  constructor(caster: Player) {
    super(caster);
    this.spellIconUrl = 'spell-icons/EtherIcon_mockup.png';
  }

  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);

  conferModifierTo = (consumer: Spell): void => {
    if (!(consumer instanceof Phlegm)) {
      this.consumedEthers++;
      consumer.accumulateProperty(this, 'consumedEthers');
    }
    this.markSpellForRemoval();
  };

  isModifierValueInvalid = (): boolean => this.getPropertyValue('dmgHealth') <= 0;
  getFocusCost = (): number => Ether.focusCost;
  getModifierLogText = (consumer: Spell): string => 'empowered with blazing force!';
}

export abstract class Gyre extends Spell {
  baseCellDmg = 4;
  protected static readonly focusCost: number = 1;
  spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';
  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'rowShift'];
  secondaryModifiers: Array<SpellPropertyName> = ['dmgHealth', 'speedDirection'];
  constructor(caster: Player) {
    super(caster);
    this.empoweredColor = '#ddd8d8';
  }
  isConditionToEmpower = (spell: Spell | null) => {
    return spell instanceof Gyre && !spell.getIsRemove() && Math.sign(spell.getPropertyValue('rowShift')) == Math.sign(this.rowShift);
  };
  conferModifierToActive = (consumer: Spell): void => {
    this.conferModifierTo(consumer);
  };
  conferModifierToInactive = (consumer: Spell): void => {
    this.conferModifierTo(consumer);
  };
  conferModifierTo = (consumer: Spell): void => {
    if (consumer instanceof Gyre) {
      const sameDirection = (consumer instanceof GyreUp && this instanceof GyreUp) || (consumer instanceof GyreDown && this instanceof GyreDown);
      if (sameDirection) {
        // Increase structural sizing height
        consumer.heightCells += this.heightCells;
        this.markSpellForRemoval();
      } else {
        // Decrement height from opposing cancelations
        consumer.heightCells -= this.heightCells;
        this.markSpellForRemoval();
        if (consumer.heightCells <= 0) {
          consumer.markSpellForRemoval();
        }
      }
    } else {
      // Push regular items vertically relative to entry index
      consumer.consumedGyres = this.rowShift * (this.heightCells + 1);
      // Give dynamic max extension loops tracking visibility
      consumer.remainingMoves += Math.abs(consumer.consumedGyres);
      this.markSpellForRemoval();
    }
  };
  isModifierValueInvalid = (): boolean => this.rowShift === 0;
  getFocusCost = (): number => Gyre.focusCost;
  getModifierLogText = (): string => 'vertical trajectory modified!';
}
export class GyreUp extends Gyre {
  static readonly spellName = "GyreUp";
  constructor(caster: Player) {
    super(caster);
    this.rowShift = -1;
    this.spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';
  }
}
export class GyreDown extends Gyre {
  static readonly spellName = "GyreDown";
  constructor(caster: Player) {
    super(caster);
    this.rowShift = 1;
    this.spellIconUrl = 'spell-icons/GyreDownIcon_mockup.png';
  }
}
export class Quicken extends Spell {
  protected static readonly focusCost: number = 1;
  static readonly spellName = "Quicken";
  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth', 'speedDirection'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift'];
  constructor(caster: Player) {
    super(caster);
    this.spellIconUrl = 'spell-icons/QuickenIcon_mockup.png';
    this.empoweredColor = '#16e0d6';
  }
  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierTo = (consumer: Spell): void => {
    this.consumedQuickens++;
    consumer.accumulateProperty(this, 'consumedQuickens');
    // Speeding up gives immediate dynamic move ticks extensions inside the simulation frame
    consumer.remainingMoves += 1;
    this.markSpellForRemoval();
  };
  isModifierValueInvalid = (): boolean => this.getPropertyValue('speedDirection') === 0;
  getFocusCost = (): number => Quicken.focusCost;
  getModifierLogText = (): string => 'accelerated forward!';
}