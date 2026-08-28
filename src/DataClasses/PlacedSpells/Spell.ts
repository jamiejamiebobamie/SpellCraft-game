// Spell.ts
import { CellIndex, SpellPropertyName, RowShiftDirections } from '../types';
import { Player } from '../Player/Player';

export abstract class Spell {
  // Constants & Core Properties
  readonly spellName: string;
  readonly caster: Player;
  protected static readonly focusCost: number = 0;
  cellIndex: CellIndex | null = null; // Starts as null (attached to cursor) until placed

  // Modifiers with strict min/max limits
  speedDirection: number = 0;
  dmgHealth: number = 0;
  rowShift: number = 0;

  // Stat Limits (Enforcing Min/Max values)
  protected readonly limits = {
    speedDirection: { min: -3, max: 3 },
    dmgHealth: { min: -3, max: 3 },
    rowShift: { min: -3, max: 3 }
  };

  constructor(spellName: string, caster: Player) {
    this.spellName = spellName;
    this.caster = caster;
    this.speedDirection = caster.getDirection();
  }

  // --- Getters & Setters (Using arrow functions to preserve 'this' context) ---

  getSpellName = (): string => {
    return this.spellName;
  };


  getCellIndex = (): CellIndex | null => {
    return this.cellIndex;
  };

  setCellIndex = (cellIndex: CellIndex | null): void => {
    this.cellIndex = cellIndex;
  };

  // Dynamic Property Accessors (Safe from 'this' context loss)
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    return this[propertyName];
  };

  updatePropertyValue = (propertyName: SpellPropertyName, value: number): void => {
    const limit = this.limits[propertyName];
    if (limit) {
      // Clamp the value between min and max bounds
      this[propertyName] = Math.max(limit.min, Math.min(limit.max, value));
    } else {
      this[propertyName] = value;
    }
  };

  // --- Game Loop Logic ---

  /**
   * Moves the spell on the board based on its speedDirection and rowShift modifiers.
   */
  move = (): void => {
    if (!this.cellIndex) return; // Cannot move if attached to cursor

    // Example grid movement logic
    this.cellIndex = {
      i: this.cellIndex.i + this.rowShift,// + this.speedDirection,
      j: this.cellIndex.j + this.speedDirection//+ this.rowShift
    };
  };

  /**
   * Called when this spell moves onto a cell containing another spell.
   */
  resolveSpellCollision = (otherSpell: Spell): void => {
    // Absorb modifiers from the consumed spell
    otherSpell.conferModifierTo(this);

    // Destroy the other spell by removing it from the board
    otherSpell.setCellIndex(null);
  };

  /**
   * Called when this spell moves onto an opposing player's cell.
   */
  resolvePlayerCollision = (otherPlayer: Player): void => {
    if (otherPlayer !== this.caster) {
      // Apply damage (or healing if dmgHealth is negative)
      otherPlayer.decrementHealth(this.dmgHealth)

      // Consume/destroy this spell after collision
      this.setCellIndex(null);
    }
  };

  /**
   * Abstract hook handled by subclasses to dictate how they modify another spell upon consumption.
   */
  abstract conferModifierTo(targetSpell: Spell): void;

  /**
   * Abstract hook handled by subclasses to implement logic for this scenario:
   * "Spell has invalid values after 'conferModifierTo' call modifies its values"
   * Varies per class:
                  Phlegm: healthDmg >= 0
                  Quicken: speedDirection == 0
                  Ether: healthDmg <= 0
                  Gyre: rowShift == 0           
   */
  abstract isModifierValueInvalid(): boolean;
  abstract getFocusCost(): number;
}

// Subclasses

export class Phlegm extends Spell {
  protected static readonly focusCost: number = 1;

  constructor(caster: Player) {
    super('Phlegm', caster);
    this.dmgHealth = -1; // Heal for 1 Health
    this.rowShift = 0;
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Detract from dmgHealth
    const currentDmgHealth = targetSpell.getPropertyValue('dmgHealth');
    targetSpell.updatePropertyValue('dmgHealth', currentDmgHealth + this.dmgHealth);

    // Reverse direction of spell movement
    const currentSpeed = targetSpell.getPropertyValue('speedDirection');
    targetSpell.updatePropertyValue('speedDirection', currentSpeed * - 1);
  };

  isModifierValueInvalid = (): boolean => {
    return this.dmgHealth >= 0;
  }

  getFocusCost = (): number => {
    return Phlegm.focusCost;
  }
}

export class Ether extends Spell {
  protected static readonly focusCost: number = 2;

  constructor(caster: Player) {
    super('Ether', caster);
    this.dmgHealth = 3; // Higher magic damage
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Ether boosts the damage of the spell that consumed it
    const currentDmg = targetSpell.getPropertyValue('dmgHealth');
    targetSpell.updatePropertyValue('dmgHealth', currentDmg + this.dmgHealth);
  };

  isModifierValueInvalid = (): boolean => {
    return this.dmgHealth <= 0;
  }
  
  getFocusCost = (): number => {
    return Ether.focusCost;
  }
}

export class Gyre extends Spell {
  protected static readonly focusCost: number = 1;

  constructor(caster: Player, rowShift: RowShiftDirections) {
    super('Gyre', caster);
    this.dmgHealth = 2;
    this.rowShift = rowShift || 0; // Alters movement tracks
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Gyre adds a lane/row shifting vector to the consuming spell
    const currentShift = targetSpell.getPropertyValue('rowShift');
    targetSpell.updatePropertyValue('rowShift', currentShift + this.rowShift);
  };

  isModifierValueInvalid = (): boolean => {
    return this.rowShift == 0;
  }
  
  getFocusCost = (): number => {
    return Gyre.focusCost;
  }
}

export class Quicken extends Spell {
  protected static readonly focusCost: number = 1;

  constructor(caster: Player) {
    super('Quicken', caster);
    this.speedDirection *= 2; // twice as fast
    this.dmgHealth = 1;
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Quicken drastically increases the velocity of the consuming spell
    const currentSpeed = targetSpell.getPropertyValue('speedDirection');
    targetSpell.updatePropertyValue('speedDirection', currentSpeed + this.speedDirection);
  };

  isModifierValueInvalid = (): boolean => {
    return this.speedDirection == 0 || this.dmgHealth <= 0;
  }

  getFocusCost = (): number => {
    return Quicken.focusCost;
  }
}