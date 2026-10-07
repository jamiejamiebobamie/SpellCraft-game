// Spell.ts
import { CellIndex, SpellPropertyName } from '../types';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

export abstract class Spell extends UniqueId {
  static readonly spellName: string;
  readonly caster: Player;
  static readonly FOCUS_COST: number = 0;
  cellIndex!: CellIndex;
  widthCells: number = 1;
  heightCells: number = 1;

  isRemove: boolean = false;

  baseCellDmg: number = 5;
  speedDirection: number = 0;
  dmgHealth: number = 0;
  rowShift: number = 0;

  // PlacedSpellComponent.tsx properties
  isPlayerHitImpact: boolean = false;
  isOpponentHitImpact: boolean = false;
  hitDamageAmount: number = 0;

  // isBeingConsumed: boolean = false;
  consumedEthers: number = 0;
  consumedPhlegms: number = 0;
  consumedQuickens: number = 0;
  consumedGyres: number = 0;

  // Real-time loop step counters monitored by the execution system
  remainingMoves: number = 0;
  recordedMovesCount: number = 0;

  // Vector field tracking mechanics
  phlegmOrbitStepsSpent: number = 0;
  isInPhlegmField: boolean = false;

  // Gyre and Phlegm bookkeeping, to ensure they are destroyed after all spells consuming them exit
  consumingSpellIds: Set<string> = new Set();
  consumedSpellRef: Spell | null = null;
  movesOutOfConsumed: number = 0;

  // Add these inside the base Spell class properties area
  phlegmCenterIndex: CellIndex | null = null;
  phlegmSize: number = 1;
  phlegmOrbitStepsRemaining: number = 0;
  phlegmDirectionSign: number = 1; // 1 for right-moving Phlegm, -1 for left-moving Phlegm

  readonly limits = {
    speedDirection: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    dmgHealth: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    rowShift: { min: -1, max: 1 },
    consumedEthers: { min: 0, max: Number.MAX_SAFE_INTEGER },
    consumedPhlegms: { min: 0, max: Number.MAX_SAFE_INTEGER },
    consumedQuickens: { min: 0, max: Number.MAX_SAFE_INTEGER }
  };

  constructor(caster: Player) {
    super();
    this.caster = caster;
    this.speedDirection = caster.getDirection();
  }

  getSpellName = (): string => {
    const currentClass = this.constructor as any;
    return currentClass.spellName || "Unknown Spell";
  };

  getCaster = (): Player => this.caster;
  getCellIndex = (): CellIndex => this.cellIndex;
  setCellIndex = (cellIndex: CellIndex): void => { this.cellIndex = proxy(cellIndex); };
  getIsRemove = (): boolean => this.isRemove;// && !this.getIsBeingConsumed();// /* TESTING: */ && !this.isBeingConsumed;
  markSpellForRemoval = (): void => {
    this.isRemove = true;
    this.movesOutOfConsumed = Number.MAX_SAFE_INTEGER;
    this.clearConsumedRef();
  };

  getIsBeingConsumed = (possibleConsumer?: Spell): boolean => possibleConsumer ? this.consumingSpellIds.has(possibleConsumer.id) : !!this.consumingSpellIds.size;

  /**
   * Refactored Size-Driven Property Accessors (PART 2 Requirements)
   */
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    const totalCellsSize = this.widthCells * this.heightCells;

    if (propertyName === 'dmgHealth') {
      let baseDmg = totalCellsSize * this.baseCellDmg;
      if (this instanceof Ether || this.consumedEthers > 0) baseDmg += 5; // isOnFire
      if (this instanceof Phlegm) return -baseDmg + (this.consumedPhlegms > 0 ? -20 : 0); // Baseline negative value for healing properties
      return baseDmg;
    }

    if (propertyName === 'speedDirection') {
      let baseSpeed = this.widthCells;
      if (this instanceof Quicken || this.consumedQuickens > 0) baseSpeed += 1; // isElectrified
      return baseSpeed * Math.sign(this.speedDirection || 1);
    }

    return (this as Spell)[propertyName] || 0;
  };

  updatePropertyValue = (propertyName: SpellPropertyName, value: number): void => {
    const limit = (this.limits as any)[propertyName];
    if (limit) {
      (this as Spell)[propertyName] = Math.max(limit.min, Math.min(limit.max, value));
    } else {
      (this as Spell)[propertyName] = value;
    }
  };

  executeSingleMicroStep = (): void => {
    // 1. Gyre vertical movement overrides horizontal tracks
    if (this.consumedGyres !== 0 && this.consumedSpellRef && this.consumedSpellRef.cellIndex.j == this.cellIndex.j) {
      this.moveVertically();
      return;
    }

    // 2. Vector field implementation for orbital paths inside Phlegm layouts
    if (this.isInPhlegmField && this.phlegmCenterIndex) {
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
      this.isInPhlegmField = false;
      this.phlegmCenterIndex = null;
      this.reverseDirection();
      return;
    }

    const size = this.phlegmSize;

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
      this.isInPhlegmField = false;
      this.phlegmCenterIndex = null;
      this.reverseDirection();
    }
  };

  moveHorizontally = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    });

    this.clearConsumedRef();
  };

  moveVertically = (): void => {
    const stepDir = Math.sign(this.consumedGyres);
    this.cellIndex = proxy({
      i: this.cellIndex.i + stepDir,
      j: this.cellIndex.j
    });
    this.consumedGyres -= stepDir;

    if (this.consumedGyres == 0) {
      this.clearConsumedRef();
    }
  };

  clearConsumedRef = (): void => {
    if (this.consumedSpellRef) {
      if (this.movesOutOfConsumed >= 1) {
        this.consumedSpellRef.consumingSpellIds.delete(this.id);
        if (!this.consumedSpellRef.getIsBeingConsumed()) this.consumedSpellRef.markSpellForRemoval();
        this.consumedSpellRef = null;
        this.movesOutOfConsumed = 0;
      } else {
        this.movesOutOfConsumed++;
      }
    }
  }

  resolveSpellCollision = (consumed: Spell): void => {
    consumed.conferModifierTo(this);
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

  abstract conferModifierTo(consumer: Spell): void;
  abstract getFocusCost(): number;
}

// --- Subclasses ---

export class Phlegm extends Spell {
  static readonly FOCUS_COST: number = 1;
  static readonly spellName = "Phlegm";

  constructor(caster: Player) {
    super(caster);
  }

  conferModifierTo = (consumer: Spell): void => {
    const phlegmSize = this.widthCells; // 1, 2, or 3

    // A full perimeter loop calculation: 4 * (size - 1), minimum 1 step for 1x1 pieces
    const fullCircleSteps = phlegmSize > 1 ? 4 * (phlegmSize - 1) : 0;

    consumer.consumedSpellRef = this;
    this.consumingSpellIds.add(consumer.id);
    consumer.isInPhlegmField = true;
    consumer.phlegmCenterIndex = proxy({ ...this.cellIndex });
    consumer.phlegmSize = phlegmSize;
    consumer.phlegmDirectionSign = Math.sign(this.getPropertyValue('speedDirection') || 1);
    consumer.phlegmOrbitStepsRemaining = fullCircleSteps;

    if (consumer instanceof Phlegm) {
      this.consumedPhlegms++;
      consumer.consumedPhlegms += this.consumedPhlegms;//.accumulateProperty(this, 'consumedPhlegms');
      // Phlegm-on-Phlegm collision exits opposite side to fly back safely to player
      consumer.phlegmOrbitStepsRemaining = consumer.phlegmOrbitStepsRemaining + fullCircleSteps / 4;
    }

    // Add extra steps if consumer requires structural breakdown overhead adjustments
    const baseDamageDelta = Math.abs(consumer.getPropertyValue('dmgHealth')) - Math.abs(this.getPropertyValue('dmgHealth'));
    if (baseDamageDelta > 0) {
      consumer.remainingMoves += Math.floor(baseDamageDelta / 5);
    }

    // Extend active step limits so the engine doesn't cut the animation path early
    consumer.remainingMoves += Math.max(1, consumer.phlegmOrbitStepsRemaining);
  };

  getFocusCost = (): number => Phlegm.FOCUS_COST;
}

export class Ether extends Spell {
  static readonly FOCUS_COST: number = 1.25;
  static readonly spellName = "Ether";

  constructor(caster: Player) {
    super(caster);
  }

  conferModifierTo = (consumer: Spell): void => {
    if (!(consumer instanceof Phlegm)) {
      this.consumedEthers++;
      consumer.accumulateProperty(this, 'consumedEthers');
    }
    this.markSpellForRemoval();
  };

  getFocusCost = (): number => Ether.FOCUS_COST;
}

export abstract class Gyre extends Spell {
  baseCellDmg = 4;
  static readonly FOCUS_COST: number = 1;

  constructor(caster: Player) {
    super(caster);
  }

  conferModifierTo = (consumer: Spell): void => {
      // Push regular items vertically relative to entry index
      consumer.consumedGyres = this.rowShift * (this.heightCells + 1);
      // Give dynamic max extension loops tracking visibility
      consumer.remainingMoves += Math.abs(consumer.consumedGyres);
      consumer.consumedSpellRef = this;
      this.consumingSpellIds.add(consumer.id);
    }

  getFocusCost = (): number => Gyre.FOCUS_COST;
}

export class GyreUp extends Gyre {
  static readonly spellName = "GyreUp";
  constructor(caster: Player) {
    super(caster);
    this.rowShift = -1;
  }
}

export class GyreDown extends Gyre {
  static readonly spellName = "GyreDown";
  constructor(caster: Player) {
    super(caster);
    this.rowShift = 1;
  }
}

export class Quicken extends Spell {
  static readonly FOCUS_COST: number = 1;
  static readonly spellName = "Quicken";
  constructor(caster: Player) {
    super(caster);
  }

  conferModifierTo = (consumer: Spell): void => {
    this.consumedQuickens++;
    consumer.accumulateProperty(this, 'consumedQuickens');
    /*
      Speeding up gives immediate dynamic move
        ticks extensions inside the simulation frame
    */
    consumer.remainingMoves += 2;
    this.markSpellForRemoval();
  };

  getFocusCost = (): number => Quicken.FOCUS_COST;
}