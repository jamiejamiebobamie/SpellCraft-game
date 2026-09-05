// Spell.ts
import { CellIndex, SpellPropertyName } from '../types';
import { Player } from '../Player/Player';
import { BadgeValues } from '../GameBoard/Badge';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

export abstract class Spell extends UniqueId {
  // Constants & Core Properties
  readonly spellName: string;
  readonly caster: Player;
  protected static readonly focusCost: number = 0;
  cellIndex!: CellIndex;
  readonly key!: string;
  isRemove: boolean = false;
  isPlaced: boolean = false;
  spellIconUrl: string = '';

  // Modifiers with strict min/max limits
  updateOrder: number = 0;
  speedDirection: number = 0;
  dmgHealth: number = 0;
  rowShift: number = 0;
  upDown: number = 0;

  // Stat Limits (Enforcing Min/Max values)
  readonly limits = {
    updateOrder: { min: 1, max: 1000 },
    speedDirection: { min: -4, max: 4 },
    dmgHealth: { min: -5, max: 5 },
    rowShift: { min: -1, max: 1 },
    upDown: { min: -3, max: 3 }
  };

  // determines if value is shown if zero
  readonly primaryModifiers: Array<SpellPropertyName> = [];
  readonly secondaryModifiers: Array<SpellPropertyName> = [];

  constructor(spellName: string, caster: Player) {
    super();
    this.spellName = spellName;
    this.caster = caster;
    this.speedDirection = caster.getDirection();
    this.key = String(Math.random());
  }

  // --- Getters & Setters (Using arrow functions to preserve 'this' context) ---

  getSpellName = (): string => {
    return this.spellName;
  };

  getSpellIcon = (): string => {
    return this.spellIconUrl;
  }

  getCaster = (): Player => {
    return this.caster;
  }

  getBadgeValues = (): BadgeValues => {
    return {
      secondaryModifiers: this.secondaryModifiers,
      updateOrder: this.updateOrder,
      speedDirection: this.speedDirection,
      dmgHealth: this.dmgHealth,
      rowShift: this.rowShift
    }
  }

  getCellIndex = (): CellIndex => {
    return this.cellIndex;
  };

  setCellIndex = (cellIndex: CellIndex): void => {
    this.cellIndex = proxy(cellIndex);
  };

  getIsPlaced = (): boolean => {
    return this.isPlaced;
  }

  setIsPlaced = (isPlaced: boolean): void => {
    this.isPlaced = isPlaced;
  }

  getIsRemove = (): boolean => {
    return this.isRemove;
  }

  markSpellForRemoval = (): void => {
    this.isRemove = true;
  }

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
  moveHorizontally = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    });
  };

  moveVertically = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i - this.rowShift,//this.upDown,
      j: this.cellIndex.j
    });
    this.upDown = 0;
  }

  /**
   * Called when this spell moves onto a cell containing another spell.
   */
  resolveSpellCollision = (otherSpell: Spell): void => {
    // Absorb modifiers from the consumed spell
    otherSpell.conferModifierTo(this);

    // Destroy the other spell by removing it from the board
    otherSpell.markSpellForRemoval();
  };

  /**
   * Called when this spell moves onto an opposing player's cell.
   */
  resolvePlayerCollision = (otherPlayer: Player): void => {
    // if (otherPlayer !== this.caster) {
    // Apply damage (or healing if dmgHealth is negative)
    otherPlayer.decrementHealth(this.dmgHealth)

    // Consume/destroy this spell after collision
    this.markSpellForRemoval()
    // }
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
  abstract getModifierLogText(consumingSpell: Spell): string;
}

// Subclasses

export class Phlegm extends Spell {
  protected static readonly focusCost: number = 1;


  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift', 'speedDirection'];

  constructor(caster: Player) {
    super('Phlegm', caster);
    this.dmgHealth = -1; // Heal for 1 Health
    this.spellIconUrl = 'spell-icons/PhlegmIcon_mockup.png';
  }

  conferModifierTo = (targetSpell: Spell): void => {

    if (targetSpell.getSpellName() == 'Phlegm') {
      // Add to heal
      const currentDmgHealth = targetSpell.getPropertyValue('dmgHealth');
      targetSpell.updatePropertyValue('dmgHealth', currentDmgHealth + this.dmgHealth);
    }

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

  getModifierLogText = (consumingSpell: Spell): string => {
    if (consumingSpell.getSpellName() == 'Phlegm') {
      return 'been reversed and become more powerful!'
    } else {
      return 'been reversed!'
    }
  }
}

export class Ether extends Spell {
  protected static readonly focusCost: number = 1;

  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift', 'speedDirection'];

  constructor(caster: Player) {
    super('Ether', caster);
    this.dmgHealth = 2; // Higher magic damage
    this.spellIconUrl = 'spell-icons/EtherIcon_mockup.png';
  }

  conferModifierTo = (targetSpell: Spell): void => {
    if (targetSpell.getSpellName() == 'Phlegm') {
      return; // do not make Phlegm positive dmgHealth
    }

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

  getModifierLogText = (consumingSpell: Spell): string => {
    return consumingSpell.getSpellName() == 'Phlegm' ? 'continued to ooze!' : 'been become more powerful!'
  }
}

export abstract class Gyre extends Spell {
  protected static readonly focusCost: number = 0;
  spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';

  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'rowShift'];
  secondaryModifiers: Array<SpellPropertyName> = ['dmgHealth', 'speedDirection'];

  constructor(caster: Player) {
    super('Gyre', caster);
    this.dmgHealth = 1;
  }

  moveHorizontally = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i,//this.cellIndex.j % 2 == 0 ? this.cellIndex.i : this.cellIndex.i + this.rowShift,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    });
  };

  conferModifierTo = (targetSpell: Spell): void => {
    // Gyre adds a lane/row shifting vector to the consuming spell
    // targetSpell.updatePropertyValue('upDown', this.rowShift);
    targetSpell.updatePropertyValue('rowShift', this.rowShift);
  };

  isModifierValueInvalid = (): boolean => {
    return this.rowShift == 0;
  }

  getFocusCost = (): number => {
    return Gyre.focusCost;
  }

  getModifierLogText = (): string => {
    if (this.rowShift < 0) {
      return 'been sent skyward by gale force winds!'
    } else if (this.rowShift > 0) {
      return 'been thrown downward by powerful winds!'
    } else {
      return 'been cancelled out by an opposing force!'
    }
  }
}

export class GyreUp extends Gyre {
  constructor(caster: Player) {
    super(caster);
    this.rowShift = 1;
    // this.spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';
  }
}

export class GyreDown extends Gyre {
  constructor(caster: Player) {
    super(caster);
    this.rowShift = -1;
  }
}

export class Quicken extends Spell {
  protected static readonly focusCost: number = 1;

  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth', 'speedDirection',];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift'];

  constructor(caster: Player) {
    super('Quicken', caster);
    this.dmgHealth = 1;
    this.spellIconUrl = 'spell-icons/QuickenIcon_mockup.png';
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Quicken drastically increases the velocity of the consuming spell
    const currentSpeed = targetSpell.getPropertyValue('speedDirection');
    targetSpell.updatePropertyValue('speedDirection', currentSpeed + Math.abs(this.speedDirection) * Math.sign(currentSpeed));
  };

  isModifierValueInvalid = (): boolean => {
    return this.speedDirection == 0 || this.dmgHealth <= 0;
  }

  getFocusCost = (): number => {
    return Quicken.focusCost;
  }

  getModifierLogText = (): string => {
    return 'has been sped up!'
  }
}