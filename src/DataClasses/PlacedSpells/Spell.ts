// Spell.ts
import { CellIndex, SpellPropertyName, Direction } from '../types';
import { Player } from '../Player/Player';
import { BadgeValues } from '../GameBoard/Badge';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

export abstract class Spell extends UniqueId {
  // Constants & Core Properties
  readonly spellName: string;
  protected static readonly focusCost: number = 0;
  cellIndex!: CellIndex;
  readonly key!: string;
  isRemove: boolean = false;
  isPlaced: boolean = false;
  empoweredColor: string = '';
  /*
    Flag to render spell differently in component.
    Flag is determined by spell's cell position relative to similar spells' cell positions.
  */
  protected empoweredPng: number = 0;

  spellIconUrl: string = '';
  caster: Player;


  // Modifiers with min/max limits
  updateOrder: number = 0; // determines the order in which a spell gets to move relative to other spells, lower value = updates earlier
  speedDirection: number = 0; // horizontal movement amt, positive = right, negative = left, '0' is not valid.
  dmgHealth: number = 0; // how much dmg the spell causes on collision with player. negative values for healing.
  upDown: number = 0; // vertical movement amt, default = 0, positive = down, negative = up.
  rowShift: number = 0; // incr/decr "upDown" property
  gyreLives: number = 0; // Gyre specific property
  empoweredDmgHealth: number = 0;
  empoweredSpeedDirection: number = 0;

  // Stat Limits (Enforcing Min/Max values)
  readonly limits = {
    updateOrder: { min: 1, max: Number.MAX_SAFE_INTEGER /*1000*/ },
    speedDirection: { min: Number.MIN_SAFE_INTEGER/*-4*/, max: Number.MAX_SAFE_INTEGER  /*4*/ },
    dmgHealth: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },//{ min: -50, max: 50 },
    rowShift: { min: -1, max: 1 },
    upDown: { min: -1, max: 1 }, // TEST!
    gyreLives: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },//{ min: 0, max: 10 },
    empoweredPng: { min: 0, max: 3 },
    empoweredSpeedDirection: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    empoweredDmgHealth: { min: 0, max: Number.MAX_SAFE_INTEGER },
  };

  // Determines if value is shown if zero
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

  setCaster = (newCaster: Player): void => {
    this.caster = newCaster;
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

  getEmpoweredPng = (): number => {
    return this.empoweredPng;
  }

  getIsEmpowered = (): boolean => {
    return this.empoweredPng != 0;
  }

  getEmpoweredColor = (): string => {
    return this.empoweredColor;
  }

  setConditionallyEmpoweredPng = (neighborSpell: Array<Spell | null>): void => {
    const [behind, inFront] = neighborSpell;
    let isBehind = false, isInFront = false;
    if (this.isConditionToEmpower(behind)) {
      isBehind = true;
    }
    if (this.isConditionToEmpower(inFront)) {
      isInFront = true;
    }
    if (isBehind && isInFront) {
      this.empoweredPng = 2;
    } else if (isBehind) {
      this.empoweredPng = 3;
    } else if (isInFront) {
      this.empoweredPng = 1;
    } else {
      this.empoweredPng = 0;
    }
  }

  setEmpoweredPng = (empoweredPng: number): void => {
    this.empoweredPng = empoweredPng;
  }

  isConditionToEmpower = (neighborSpell: Spell | null) => {
    return false;
  }

  getEmpoweredDirection = (): Direction => {
    return 0;
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

  // Dynamic Property Accessors
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    const val = this[propertyName];;
    if (propertyName == 'empoweredDmgHealth') {
      return !!this.empoweredDmgHealth ? this.empoweredDmgHealth : this['dmgHealth'];
    } else if (propertyName == 'empoweredSpeedDirection') {
      return !!this.empoweredSpeedDirection ? this.empoweredSpeedDirection : this['speedDirection'];
    } else {
      return val;
    }
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
      i: this.cellIndex.i + this.upDown,
      j: this.cellIndex.j
    });
    this.upDown = 0;
  }

  /**
   * Called when this spell moves onto a cell containing another spell.
   */
  resolveSpellCollision = (consumedSpell: Spell, dmgHealth: number): void => {
    if (consumedSpell.getCaster() == this.getCaster() || Math.abs(consumedSpell.getPropertyValue('empoweredDmgHealth')) <= Math.abs(dmgHealth)) {
      // Confer modifiers from the consumed spell to 'this' spell
      consumedSpell.conferModifierTo(this);
    } else {
      this.conferModifierTo(consumedSpell);
      // this.markSpellForRemoval();
    }
  };

  /**
   * Called when this spell moves onto an opposing player's cell.
   */
  resolvePlayerCollision = (otherPlayer: Player, dmgHealth: number): void => {
    // Apply damage (or healing if dmgHealth is negative)
    otherPlayer.decrementHealth(dmgHealth)
  };

  getEmpoweredNeighborIndexOffsets = (direction: Direction): Array<CellIndex> => {
    return [];
  }

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
    this.dmgHealth = -5; // Heal for 1 Health
    this.spellIconUrl = 'spell-icons/PhlegmIcon_mockup.png';
  }

  conferModifierTo = (targetSpell: Spell): void => {

    if (targetSpell instanceof Phlegm) {
      // Add to heal
      const currentDmgHealth = targetSpell.getPropertyValue('dmgHealth');
      targetSpell.updatePropertyValue('dmgHealth', currentDmgHealth + this.dmgHealth);
      // Also...
    }

    // Reverse direction of spell movement
    const currentSpeed = targetSpell.getPropertyValue('speedDirection');
    targetSpell.updatePropertyValue('speedDirection', currentSpeed * - 1);

    // Update owner
    targetSpell.setCaster(this.caster);
    // TO-DO: if caster consumes his own phlegm, direction will reverse, but owner will remain the same...
    // WANT: (1) have cell colors dependent on direction.
    // (2) have same direction (not same owner) allow for instant consumes w/o dmgHealth comparison. (change in 'resolveSpellCollision'...)

    this.markSpellForRemoval();
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
    this.dmgHealth = 10;
    this.spellIconUrl = 'spell-icons/EtherIcon_mockup.png';
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // do not make Phlegm positive dmgHealth
    if (!(targetSpell instanceof Phlegm)) {
      // Ether boosts the damage of the spell that consumed it
      const currentDmg = targetSpell.getPropertyValue('dmgHealth');
      targetSpell.updatePropertyValue('dmgHealth', currentDmg + this.dmgHealth);

      // conserve buffed speed if consumed spell has greater speed than consumer
      const consumerSpeedDirection = targetSpell.getPropertyValue('speedDirection');
      const consumerSpeed = Math.abs(consumerSpeedDirection);
      const consumedSpeed = Math.abs(this.speedDirection);
      if (consumedSpeed > consumerSpeed) {
        targetSpell.updatePropertyValue('speedDirection', consumedSpeed * Math.sign(consumerSpeedDirection));
      }

      // TO-DO: Ether and Quicken conserve speed/dmgHealth (respectively), maintaing the "max" between the consumer/consumed...
      // Consider: Gyre and Phlegm also conserving "buffs" when consumed...
    }
    this.markSpellForRemoval();
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
  protected static readonly focusCost: number = 1;

  spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';

  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'rowShift'];
  secondaryModifiers: Array<SpellPropertyName> = ['dmgHealth', 'speedDirection'];

  constructor(caster: Player) {
    super('Gyre', caster);
    this.dmgHealth = 4;
    this.gyreLives = 4;
    this.empoweredColor = '#ddd8d8';
  }

  isConditionToEmpower = (spell: Spell | null) => {
    return spell instanceof Gyre && !spell.getIsRemove() && Math.sign(spell.getPropertyValue('rowShift')) == Math.sign(this.rowShift);
  }

  getEmpoweredNeighborIndexOffsets = (direction: Direction): Array<CellIndex> => {
    return direction == 1 ? [{ i: -1, j: 0 }, { i: 1, j: 0 }] : [{ i: 1, j: 0 }, { i: -1, j: 0 }];
  }

  getEmpoweredDirection = (): Direction => {
    const d = Math.sign(this.rowShift) as Direction;
    return d;
  }

  moveHorizontally = (): void => {
    this.cellIndex = proxy({
      i: this.cellIndex.i,
      j: this.cellIndex.j + Math.sign(this.speedDirection) * 1
    });
    this.gyreLives--;
    this.removeGyreIfOutOfLives();
  };

  removeGyreIfOutOfLives = (): void => {
    if (this.gyreLives < 1) this.markSpellForRemoval();
  }

  conferModifierTo = (consumerSpell: Spell): void => {
    if (consumerSpell instanceof Gyre) {
      const consumerLives = consumerSpell.getPropertyValue('gyreLives');
      const consumedLives = this.gyreLives;
      consumerSpell.updatePropertyValue('gyreLives', consumerLives + consumedLives);
      this.gyreLives = 0; // 'consumerSpell' consumes all this's 'gyreLives'
    } else {
      // Gyre adds a lane/row shifting vector to the consuming spell
      consumerSpell.updatePropertyValue('upDown', this.rowShift); // TO-DO: cause of Gyre bug... conferModifierTo when consumed is too powerful to be consumed, consumer becomes consumed... ISSUE: the consumed spell is not moving, but is getting upDown conferred to it...
      this.gyreLives--; 
    }
    this.removeGyreIfOutOfLives();
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
    this.rowShift = -1;
    this.spellIconUrl = 'spell-icons/GyreUpIcon_mockup.png';
  }
}

export class GyreDown extends Gyre {
  constructor(caster: Player) {
    super(caster);
    this.rowShift = 1;
    this.spellIconUrl = 'spell-icons/GyreDownIcon_mockup.png';
  }
}

export class Quicken extends Spell {
  protected static readonly focusCost: number = 1;

  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth', 'speedDirection',];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift'];

  constructor(caster: Player) {
    super('Quicken', caster);
    this.dmgHealth = 3;
    this.spellIconUrl = 'spell-icons/QuickenIcon_mockup.png';
    this.speedDirection *= 1;
    this.empoweredColor = '#16e0d6';
  }

  getEmpoweredDirection = (): Direction => {
    const d = Math.sign(this.speedDirection) as Direction;
    return d;
  }

  getEmpoweredNeighborIndexOffsets = (direction: Direction): Array<CellIndex> => {
    return direction == 1 ? [{ i: 0, j: -1 }, { i: 0, j: 1 }] : [{ i: 0, j: 1 }, { i: 0, j: -1 }];
  }

  isConditionToEmpower = (spell: Spell | null) => {
    return spell instanceof Quicken && !spell.getIsRemove() && Math.sign(spell.getPropertyValue('speedDirection')) == Math.sign(this.speedDirection);
  }

  conferModifierTo = (targetSpell: Spell): void => {
    // Quicken drastically increases the velocity of the consuming spell
    const currentSpeed = targetSpell.getPropertyValue('speedDirection');
    targetSpell.updatePropertyValue('speedDirection', currentSpeed + Math.abs(this.speedDirection) * Math.sign(currentSpeed));

    // buff for Gyre and Ether
    if (!(targetSpell instanceof Phlegm)) {
      // conserve buffed dmgHealth if consumed spell has greater dmg than consumer
      const consumerDmgHealth = targetSpell.getPropertyValue('dmgHealth');
      if (this.dmgHealth > consumerDmgHealth) {
        targetSpell.updatePropertyValue('dmgHealth', this.dmgHealth);
      }
    }

    this.markSpellForRemoval();
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