// Spell.ts
import { CellIndex, SpellPropertyName } from '../types';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqueId/UniqeId';
import { GYRE_RULES, PHLEGM_RULES } from './spellRules';

export abstract class Spell extends UniqueId {
  static readonly spellName: string;
  readonly caster: Player;
  static readonly FOCUS_COST: number = 0;
  cellIndex!: CellIndex;
  widthCells: number = 1;
  heightCells: number = 1;

  isRemove: boolean = false;

  baseCellDmg: number = 5;
  powerModifier: number = 0; // e.g. power drained from a Phlegm when PHLEGM_RULES.absorbCostsPower is on
  speedDirection: number = 0;
  dmgHealth: number = 0;
  rowShift: number = 0;

  // PlacedSpellComponent.tsx properties
  isPlayerHitImpact: boolean = false;
  isOpponentHitImpact: boolean = false;
  isBloodMagic: boolean = false;
  hitDamageAmount: number = 0;
  hitImpactCount: number = 0; // incremented per hit, so the canvas plays each hit's effects once

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

  // Id of the spell this piece broke off from ('' if not a piece). Pieces of the same spell never collide.
  fragmentGroupId: string = '';
  // Id of the Phlegm/Gyre that broke this piece off ('' if not a piece)
  fragmentBreakerId: string = '';

  // Gyre and Phlegm bookkeeping, to ensure they are destroyed after all spells consuming them exit
  consumingSpellIds: Set<string> = new Set();
  consumedSpellRef: Spell | null = null;
  movesOutOfConsumed: number = 0;

  // Add these inside the base Spell class properties area
  phlegmCenterIndex: CellIndex | null = null;
  phlegmSize: number = 1;
  phlegmOrbitStepsRemaining: number = 0;
  phlegmDirectionSign: number = 1; // 1 for right-moving Phlegm, -1 for left-moving Phlegm

  // Sized spells bounce off a Phlegm as a block: they slide into it for the entry steps, swirl in
  // place for the dwell steps, then reverse
  phlegmEntryStepsRemaining: number = 0;
  phlegmDwellStepsRemaining: number = 0;

  // Capacity a Phlegm has used (spells consumed in 'count' mode, power absorbed in 'power' mode)
  capacityUsed: number = 0;

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
  setCellIndex = (cellIndex: CellIndex): void => { this.cellIndex = { ...cellIndex }; };
  getIsRemove = (): boolean => this.isRemove;// && !this.getIsBeingConsumed();// /* TESTING: */ && !this.isBeingConsumed;
  markSpellForRemoval = (): void => {
    this.isRemove = true;
    this.movesOutOfConsumed = Number.MAX_SAFE_INTEGER;
    this.clearConsumedRef();
  };

  /** Flags a hit on a player (or a blood magic cost paid by the caster) for the canvas to show. */
  flagHitImpact = (isPlayerSide: boolean, amount: number, isBloodMagic: boolean = false): void => {
    this.isPlayerHitImpact = isPlayerSide;
    this.isOpponentHitImpact = !isPlayerSide;
    this.hitDamageAmount = amount;
    this.isBloodMagic = isBloodMagic;
    this.hitImpactCount++;
  };

  /** Always-positive strength used to decide collisions (requirement 2a). */
  getPower = (): number => Math.abs(this.getPropertyValue('dmgHealth'));

  getIsBeingConsumed = (possibleConsumer?: Spell): boolean => possibleConsumer ? this.consumingSpellIds.has(possibleConsumer.id) : !!this.consumingSpellIds.size;

  /**
   * Refactored Size-Driven Property Accessors (PART 2 Requirements)
   */
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    const totalCellsSize = this.widthCells * this.heightCells;

    // Damage (+) or healing (-, Phlegms) dealt to the player whose edge the spell exits.
    // Its magnitude is the spell's power (see getPower).
    if (propertyName === 'dmgHealth') {
      let power = totalCellsSize * this.baseCellDmg + this.powerModifier;
      if (this instanceof Ether || this.consumedEthers > 0) power += 5; // isOnFire
      if (this instanceof Phlegm && this.consumedPhlegms > 0) power += PHLEGM_RULES.empoweredBonus; // isHealing
      return this instanceof Phlegm ? -power : power;
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

  /*
  
    executeSingleMicroStep = (): void => {
    // FIX: If a spell has active consumedGyres capacity, it should always execute its vertical movement step.
    // We remove the strict requirement for 'consumedSpellRef' to be alive in memory for vertical steps,
    // allowing shattered fragments to safely dive or climb even after the target Gyre obstacle has been destroyed.
    const hasActiveVerticalOverride = this.consumedGyres !== 0;

    if (hasActiveVerticalOverride) {
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

  
  */

  executeSingleMicroStep = (): void => {
    // FIX: If a spell is carrying vertical movement capacity from an interactive Gyre,
    // bypass the strict column-matching rule (.j == .j) so it can execute its rowShift 
    // cleanly without being blocked by look-ahead targets in adjacent columns.
    // const isTrackingGyreObstacle = this.consumedSpellRef instanceof Gyre;
    // const isColumnAligned = this.consumedSpellRef && this.consumedSpellRef.cellIndex.j === this.cellIndex.j;

    // const hasActiveVerticalOverride = this.consumedGyres !== 0 &&
    //   (this instanceof Gyre || isTrackingGyreObstacle || isColumnAligned);

    // if (hasActiveVerticalOverride) {
    //   this.moveVertically();
    //   return;
    // }

    if (this.consumedGyres !== 0) {
      this.moveVertically();
      return;
    }

    // Bouncing off a Phlegm as a block: slide into it, stay in place, then reverse.
    // (Not moveHorizontally: sliding in must not count as leaving the Phlegm.)
    if (this.phlegmEntryStepsRemaining > 0) {
      this.phlegmEntryStepsRemaining--;
      this.cellIndex = { i: this.cellIndex.i, j: this.cellIndex.j + Math.sign(this.speedDirection) };
      return;
    }
    if (this.phlegmDwellStepsRemaining > 0) {
      this.phlegmDwellStepsRemaining--;
      if (this.phlegmDwellStepsRemaining === 0) this.reverseDirection();
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

    if (!this.phlegmCenterIndex) return;

    // A spell captured just outside the Phlegm first steps onto its edge; the orbit starts from there
    const isEntering = this.getIsOutsidePhlegm();
    this.cellIndex = this.getNextOrbitCell();
    if (isEntering) return;

    this.phlegmOrbitStepsRemaining--;

    // Clean exit verification on the final orbital tick step
    if (this.phlegmOrbitStepsRemaining === 0) {
      this.isInPhlegmField = false;
      this.phlegmCenterIndex = null;
      this.reverseDirection();
    }
  };

  private getPhlegmBounds = () => {
    const center = this.phlegmCenterIndex!;
    return {
      minI: center.i,
      maxI: center.i + this.phlegmSize - 1,
      minJ: center.j,
      maxJ: center.j + this.phlegmSize - 1,
    };
  };

  private getIsOutsidePhlegm = (): boolean => {
    const { minI, maxI, minJ, maxJ } = this.getPhlegmBounds();
    const { i, j } = this.cellIndex;
    return i < minI || i > maxI || j < minJ || j > maxJ;
  };

  /** The cell this spell's next orbit step moves to (its current cell when the orbit is ending). */
  private getNextOrbitCell = (): CellIndex => {
    if (this.phlegmOrbitStepsRemaining <= 0 || !this.phlegmCenterIndex) return { ...this.cellIndex };

    const { minI, maxI, minJ, maxJ } = this.getPhlegmBounds();

    let nextI = this.cellIndex.i;
    let nextJ = this.cellIndex.j;

    if (this.getIsOutsidePhlegm()) {
      return {
        i: Math.min(maxI, Math.max(minI, nextI)),
        j: Math.min(maxJ, Math.max(minJ, nextJ)),
      };
    }

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

    return { i: nextI, j: nextJ };
  };

  /** Where executeSingleMicroStep would move this spell, without moving it. */
  peekNextCellIndex = (): CellIndex => {
    if (this.consumedGyres !== 0) {
      return { i: this.cellIndex.i + Math.sign(this.consumedGyres), j: this.cellIndex.j };
    }
    if (this.phlegmEntryStepsRemaining > 0) {
      return { i: this.cellIndex.i, j: this.cellIndex.j + Math.sign(this.speedDirection) };
    }
    if (this.phlegmDwellStepsRemaining > 0) {
      return { ...this.cellIndex };
    }
    if (this.isInPhlegmField && this.phlegmCenterIndex) {
      return this.getNextOrbitCell();
    }
    return { i: this.cellIndex.i, j: this.cellIndex.j + Math.sign(this.speedDirection) };
  };

  moveHorizontally = (): void => {
    this.cellIndex = {
      i: this.cellIndex.i,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    };

    this.clearConsumedRef();
  };

  moveVertically = (): void => {
    const stepDir = Math.sign(this.consumedGyres);
    this.cellIndex = {
      i: this.cellIndex.i + stepDir,
      j: this.cellIndex.j
    };
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
    if (consumer.isInPhlegmField && consumer.consumedSpellRef === this) {
      return;
    }

    const phlegmSize = this.widthCells; // 1, 2, or 3

    // A full perimeter loop calculation: 4 * (size - 1), minimum 1 step for 1x1 pieces
    const fullCircleSteps = phlegmSize > 1 ? 4 * (phlegmSize - 1) : 0;

    consumer.consumedSpellRef = this;
    this.consumingSpellIds.add(consumer.id);
    consumer.isInPhlegmField = true;
    consumer.phlegmCenterIndex = { ...this.cellIndex };
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
    // Any consumer gains the fire bonus, including a Phlegm absorbing an Ether in 'power' mode
    this.consumedEthers++;
    consumer.accumulateProperty(this, 'consumedEthers');
    this.markSpellForRemoval();
  };

  getFocusCost = (): number => Ether.FOCUS_COST;
}

export abstract class Gyre extends Spell {
  baseCellDmg = GYRE_RULES.powerPerCell;
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