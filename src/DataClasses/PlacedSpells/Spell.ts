// Spell.ts
import { CellIndex, SpellPropertyName } from '../types';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqueId/UniqeId';
import { GYRE_RULES, PHLEGM_RULES, QUICKEN_RULES } from './spellRules';

type CellBounds = { minI: number; maxI: number; minJ: number; maxJ: number };

const clampIntoBounds = (cell: CellIndex, b: CellBounds): CellIndex => ({
  i: Math.min(b.maxI, Math.max(b.minI, cell.i)),
  j: Math.min(b.maxJ, Math.max(b.minJ, cell.j)),
});

/** The next cell around a square's edge, clockwise or counterclockwise. */
const getNextPerimeterCell = ({ i, j }: CellIndex, b: CellBounds, isClockwise: boolean): CellIndex => {
  if (isClockwise) {
    if (i === b.minI && j < b.maxJ) return { i, j: j + 1 }; // top edge moves right
    if (j === b.maxJ && i < b.maxI) return { i: i + 1, j }; // right edge moves down
    if (i === b.maxI && j > b.minJ) return { i, j: j - 1 }; // bottom edge moves left
    if (j === b.minJ && i > b.minI) return { i: i - 1, j }; // left edge moves up
  } else {
    if (i === b.minI && j > b.minJ) return { i, j: j - 1 }; // top edge moves left
    if (j === b.minJ && i < b.maxI) return { i: i + 1, j }; // left edge moves down
    if (i === b.maxI && j < b.maxJ) return { i, j: j + 1 }; // bottom edge moves right
    if (j === b.maxJ && i > b.minI) return { i: i - 1, j }; // right edge moves up
  }
  return { i, j };
};

/**
 * Orbit length for a spell entering a Phlegm at `entry` (7a): one full lap, then onward around the
 * edge until it reaches `exitColumn`, the side it will face after reversing.
 */
const getOrbitSteps = (entry: CellIndex, b: CellBounds, isClockwise: boolean, exitColumn: number): number => {
  const lapSteps = 4 * (b.maxJ - b.minJ);
  let cell = entry;
  let extraSteps = 0;
  while (cell.j !== exitColumn && extraSteps < lapSteps) {
    cell = getNextPerimeterCell(cell, b, isClockwise);
    extraSteps++;
  }
  return lapSteps + extraSteps;
};

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

  // Reflection bonus moves (7b), granted when the spell leaves the Phlegm it entered
  phlegmBonusMoves: number = 0;
  gyreExitBonusMoves: number = 0; // moves added once its Gyre lift ends (GYRE_RULES.exitBonusMode)

  // The Phlegm this spell just left: ignored while the spell is still on its edge, so it isn't recaptured
  exitedPhlegmId: string = '';

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
      if (this.phlegmDwellStepsRemaining === 0) this.exitPhlegm();
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
      this.exitPhlegm();
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
      this.exitPhlegm();
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

    if (this.getIsOutsidePhlegm()) return clampIntoBounds(this.cellIndex, { minI, maxI, minJ, maxJ });

    return getNextPerimeterCell(this.cellIndex, { minI, maxI, minJ, maxJ }, this.phlegmDirectionSign === 1);
  };

  /**
   * Spends this step without moving (blocked by a stuck sibling). Any lift, slide, swirl or orbit
   * still counts down, so the spell always finishes its transit instead of freezing mid-way.
   */
  forfeitStep = (): void => {
    if (this.consumedGyres !== 0) {
      this.consumedGyres -= Math.sign(this.consumedGyres);
      if (this.consumedGyres === 0) this.endGyreLift();
      return; // vertical moves don't use up horizontal moves
    }
    this.remainingMoves--;
    if (this.phlegmEntryStepsRemaining > 0) {
      this.phlegmEntryStepsRemaining--;
    } else if (this.phlegmDwellStepsRemaining > 0) {
      this.phlegmDwellStepsRemaining--;
      if (this.phlegmDwellStepsRemaining === 0) this.exitPhlegm();
    } else if (this.isInPhlegmField) {
      this.phlegmOrbitStepsRemaining--;
      if (this.phlegmOrbitStepsRemaining <= 0) {
        this.isInPhlegmField = false;
        this.phlegmCenterIndex = null;
        this.exitPhlegm();
      }
    }
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

    // One cell past the Gyre's tip: the spell has left the Gyre
    if (this.consumedGyres == 0) this.endGyreLift();
  };

  /** The lift has ended (one cell past the Gyre's tip): it lets go of the Gyre, and gets its exit bonus. */
  private endGyreLift = (): void => {
    this.remainingMoves += this.gyreExitBonusMoves;
    this.gyreExitBonusMoves = 0;
    this.movesOutOfConsumed = Math.max(1, this.movesOutOfConsumed);
    this.clearConsumedRef();
  };

  /**
   * Whether this spell is used up once nothing is inside it. Gyres are only used up when their
   * capacity is spent (10b); other spells are removed as soon as their last consumer leaves.
   */
  getIsUsedUp = (): boolean => true;

  clearConsumedRef = (): void => {
    if (this.consumedSpellRef) {
      if (this.movesOutOfConsumed >= 1) {
        this.consumedSpellRef.consumingSpellIds.delete(this.id);
        if (!this.consumedSpellRef.getIsBeingConsumed() && this.consumedSpellRef.getIsUsedUp()) this.consumedSpellRef.markSpellForRemoval();
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

  /**
   * Leaving a Phlegm: reverse, then the Phlegm shoots the spell outward with its bonus moves (7b).
   * The spell lets go of the Phlegm right away, so the Phlegm pops as soon as its last spell exits (10b).
   */
  exitPhlegm = (): void => {
    this.reverseDirection();
    this.remainingMoves += this.phlegmBonusMoves;
    this.phlegmBonusMoves = 0;
    if (this.consumedSpellRef instanceof Phlegm) {
      this.exitedPhlegmId = this.consumedSpellRef.id;
      this.movesOutOfConsumed = Math.max(1, this.movesOutOfConsumed);
      this.clearConsumedRef();
    }
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
    const bounds = {
      minI: this.cellIndex.i, maxI: this.cellIndex.i + phlegmSize - 1,
      minJ: this.cellIndex.j, maxJ: this.cellIndex.j + phlegmSize - 1,
    };
    const isClockwise = Math.sign(this.getPropertyValue('speedDirection') || 1) === 1;
    const entry = clampIntoBounds(consumer.cellIndex, bounds);
    const isEnteringFromOutside = entry.i !== consumer.cellIndex.i || entry.j !== consumer.cellIndex.j;
    // It exits on the side it faces after reversing (7a)
    const exitColumn = -Math.sign(consumer.speedDirection || 1) > 0 ? bounds.maxJ : bounds.minJ;
    // A piece of a spell that broke up on entering (PHLEGM_RULES.sizedEntry 'cells') orbits exactly one
    // lap and leaves from where it entered, so the pieces come back out in formation and reassemble
    const isLapFromEntry = PHLEGM_RULES.sizedEntry === 'cells' && !!consumer.fragmentGroupId;
    const orbitSteps = isLapFromEntry ? 4 * (phlegmSize - 1) : getOrbitSteps(entry, bounds, isClockwise, exitColumn);

    consumer.consumedSpellRef = this;
    this.consumingSpellIds.add(consumer.id);
    consumer.isInPhlegmField = true;
    consumer.phlegmCenterIndex = { ...this.cellIndex };
    consumer.phlegmSize = phlegmSize;
    consumer.phlegmDirectionSign = isClockwise ? 1 : -1;
    consumer.phlegmOrbitStepsRemaining = orbitSteps;

    if (consumer instanceof Phlegm) {
      this.consumedPhlegms++;
      consumer.consumedPhlegms += this.consumedPhlegms;
    }

    // Stepping in, the orbit, and the reversal (a 1x1 Phlegm's whole orbit) don't use up the
    // spell's own moves. Reflection bonus moves are set by the engine (7b).
    consumer.remainingMoves += Math.max(1, orbitSteps) + (isEnteringFromOutside ? 1 : 0);
  };

  getFocusCost = (): number => Phlegm.FOCUS_COST;
}

export class Ether extends Spell {
  static readonly FOCUS_COST: number = 1; // per cell (1.25 and 2 were tried)
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
  // Spells this Gyre has lifted this turn: it lifts each at most once (no endless lifts or ping-pong)
  liftedThisTurn: Set<string> = new Set();
  static readonly FOCUS_COST: number = 1;

  constructor(caster: Player) {
    super(caster);
  }

  /**
   * Lifts a (1x1) spell that entered this Gyre until it is one cell past the Gyre's tip (4a):
   * GyreUp: entry row − top row + 1 moves up. GyreDown: bottom row − entry row + 1 moves down.
   * Vertical moves don't use up the spell's horizontal moves.
   */
  conferModifierTo = (consumer: Spell): void => {
    const top = this.cellIndex.i;
    const bottom = top + this.heightCells - 1;
    const entryRow = Math.min(bottom, Math.max(top, consumer.cellIndex.i));
    const isUp = this.rowShift < 0;
    consumer.consumedGyres = isUp ? -(entryRow - top + 1) : bottom - entryRow + 1;
    if (GYRE_RULES.exitBonusMode === 'legacy') consumer.remainingMoves += this.heightCells + 1;
    if (GYRE_RULES.exitBonusMode === 'height') consumer.gyreExitBonusMoves = this.heightCells;
    consumer.consumedSpellRef = this;
    this.consumingSpellIds.add(consumer.id);
    this.liftedThisTurn.add(consumer.id);
  }

  /** How many spells ('count') or how much power ('power') this Gyre can lift (4c). A 1x1 Gyre lifts one. */
  getCapacity = (): number => {
    if (GYRE_RULES.lifetime === 'turn') return Infinity;
    if (this.heightCells === 1) return 1;
    if (GYRE_RULES.capacityMode === 'unlimited') return Infinity;
    return this.heightCells * (GYRE_RULES.capacityMode === 'power' ? GYRE_RULES.powerCapacityPerCell : GYRE_RULES.capacityPerCell);
  };

  /** Capacity used when a 1x1 spell (or piece) enters: one, or its power in 'power' mode. */
  getCapacityUse = (entering: Spell): number =>
    GYRE_RULES.capacityMode === 'power' && this.heightCells > 1 ? entering.getPower() : 1;

  /** At capacity: other spells pass through it. */
  getIsFull = (): boolean => this.capacityUsed >= this.getCapacity();

  /** Removed once empty: after any use, or (persistsAfterUse) only when full (10b). */
  getIsUsedUp = (): boolean => {
    if (GYRE_RULES.lifetime === 'turn') return false; // (dissipates at the turn's end, in the engine)
    return GYRE_RULES.persistsAfterUse ? this.getIsFull() : true;
  };

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
  static readonly FOCUS_COST: number = 1; // per cell (2 was tried)
  static readonly spellName = "Quicken";
  constructor(caster: Player) {
    super(caster);
  }

  /**
   * The consumer becomes electrified (11a). 'flat': +1 speed, once; a spell electrified mid-turn
   * immediately gains its extra move. 'perConsumption': every Quicken consumed grants
   * QUICKEN_RULES.bonusMovesPerConsumption extra moves this turn.
   */
  conferModifierTo = (consumer: Spell): void => {
    const isAlreadyElectrified = consumer instanceof Quicken || consumer.consumedQuickens > 0;
    this.consumedQuickens++;
    consumer.accumulateProperty(this, 'consumedQuickens');
    if (QUICKEN_RULES.bonusMode === 'perConsumption') {
      consumer.remainingMoves += QUICKEN_RULES.bonusMovesPerConsumption;
    } else if (!isAlreadyElectrified) {
      consumer.remainingMoves += 1;
    }
    this.markSpellForRemoval();
  };

  getFocusCost = (): number => Quicken.FOCUS_COST;
}