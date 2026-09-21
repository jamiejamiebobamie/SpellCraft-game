// Spell.ts
import { CellIndex, SpellPropertyName, Direction } from '../types';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

// TO-DO: have Gyre up and GyreDown when placed vertically (gyredown above, gyreup below) sustain one another so that no gyreLives are spent when moving
// TO-DO: have Gyre's be like Phlegms: destroyed when consumed...
export abstract class Spell extends UniqueId {
  // Constants & Core Properties
  readonly spellName: string;
  readonly caster: Player;
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


  // Modifiers with min/max limits
  updateOrder: number = 0; // determines the order in which a spell gets to move relative to other spells, lower value = updates earlier
  speedDirection: number = 0; // horizontal movement amt, positive = right, negative = left, '0' is not valid.
  dmgHealth: number = 0; // how much dmg the spell causes on collision with player. negative values for healing.
  upDown: number = 0; // vertical movement amt, default = 0, positive = down, negative = up.
  rowShift: number = 0; // incr/decr "upDown" property
  gyreLives: number = 0; // Gyre specific property
  empoweredDmgHealth: number = 0;
  empoweredSpeedDirection: number = 0;

  // TO-DO: show on GameLog and GameBoard so player can understand a spell's current state based on past collisions...
  consumedEthers: number = 0;
  consumedPhlegms: number = 0;
  consumedQuickens: number = 0;

  // Stat Limits (Enforcing Min/Max values)
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
    /*
      'Cell' class has reference to Spell that should be cleared
        in this method, but it is not atm...
       Not sure if this is causing any issues.
    */
    this.isRemove = true;
  }

  // Dynamic Property Accessors
  getPropertyValue = (propertyName: SpellPropertyName): number => {
    const val = this[propertyName];
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
  resolveSpellCollision = (inactive: Spell): void => {
    /*
      
      active = moving
      inactive = not moving
    
    */

    const activeDir = Math.sign(this.getPropertyValue('speedDirection'));
    const inactiveDir = Math.sign(inactive.getPropertyValue('speedDirection'));

    const activeDmg = Math.abs(this.getPropertyValue('empoweredDmgHealth'));
    const inactiveDmg = Math.abs(inactive.getPropertyValue('empoweredDmgHealth'));

    // Inactive spells going the same direction are automatically consumed by Active spells
    const isSameDirection = activeDir == inactiveDir;

    /*
      Inactive spells going in the opposite direction
        as the Active spell must win a dmg comparison or be consumed.
    */
    const isActiveMorePowerful = activeDmg >= inactiveDmg;
    if (isSameDirection || isActiveMorePowerful) {
      // Active (moving) spell consumes inactive (not-moving) spell
      inactive.conferModifierToActive(this);
    } else {
      // Inactive (not-moving) spell consumes active (moving) spell
      this.conferModifierToInactive(inactive);
    }
  };

  /**
   * Conserve "buffed" property values between consumer and consumed during spell collisions
   */
  conserveGreater = (consumed: Spell, properties: Array<SpellPropertyName>): void => {
    properties.forEach(spn => {
      const sign = Math.sign(this.getPropertyValue(spn));
      const currentValue = Math.abs(this.getPropertyValue(spn));
      const otherValue = Math.abs(consumed.getPropertyValue(spn));
      if (otherValue > currentValue) {
        this.updatePropertyValue(spn, otherValue * sign);
      }
    })
  };

  /**
   * 
   * @param consumedSpell 
   * @param spn 
   * @param multiplier 
   * 
   * Accumulates the property values and updates the property with the summed value.
   */
  accumulateProperty = (consumed: Spell, spn: SpellPropertyName, multiplier: number = 1): void => {
    const currentValue = this.getPropertyValue(spn);
    const otherValue = consumed.getPropertyValue(spn);
    const newValue = (currentValue + Math.abs(otherValue) * Math.sign(currentValue)) * multiplier;
    this.updatePropertyValue(spn, newValue);
  }

  reverseDirection = (): void => {
    this.speedDirection *= -1;
  }

  /**
   * Called when this spell moves onto an opposing player's cell.
   */
  resolvePlayerCollision = (otherPlayer: Player, dmgHealth: number): void => {
    // Apply damage (or healing if dmgHealth is negative)
    otherPlayer.decrementHealth(dmgHealth)
  };

  /*
    Default implementation for Phelgm and Ether.
    Quicken and Gyre override the method with their implementations.
  */
  getEmpoweredNeighborIndexOffsets = (direction: Direction): Array<CellIndex> => {
    return [];
  }

  /**
   * Abstract hook handled by subclasses to dictate how they modify another spell upon consumption.
   */
  abstract conferModifierToActive(consumer: Spell): void;
  abstract conferModifierToInactive(consumer: Spell): void;


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
  abstract getModifierLogText(consumer: Spell): string;
}

// Subclasses

export class Phlegm extends Spell {
  protected static readonly focusCost: number = 1;


  primaryModifiers: Array<SpellPropertyName> = ['updateOrder', 'dmgHealth'];
  secondaryModifiers: Array<SpellPropertyName> = ['rowShift', 'speedDirection'];

  constructor(caster: Player) {
    super('Phlegm', caster);
    this.dmgHealth = -4; // Heal 
    this.spellIconUrl = 'spell-icons/PhlegmIcon_mockup.png';
  }

  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);

  conferModifierTo = (consumer: Spell): void => {
    if (consumer instanceof Phlegm) {
      consumer.accumulateProperty(this, 'dmgHealth', 2);
      // Increment consumed Phlegms
      this.consumedPhlegms++;
      // ...before conferring 'consumedPhlegms' to consumer
      consumer.accumulateProperty(this, 'consumedPhlegms');
    }
    // Conserve the greater values between consumer and consumed
    consumer.conserveGreater(this, ['speedDirection']);
    consumer.reverseDirection();

    this.markSpellForRemoval();
  };

  isModifierValueInvalid = (): boolean => {
    return this.dmgHealth >= 0;
  }

  getFocusCost = (): number => {
    return Phlegm.focusCost;
  }

  getModifierLogText = (consumer: Spell): string => {
    if (consumer.getSpellName() == 'Phlegm') {
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

  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierTo = (consumer: Spell): void => {
    if (!(consumer instanceof Phlegm)) {
      consumer.accumulateProperty(this, 'dmgHealth');
      // Increment consumed Ethers
      this.consumedEthers++;
      // Before conferring consumedEthers to consumer
      consumer.accumulateProperty(this, 'consumedEthers');
    }

    // Conserve the greater values between consumer and consumed
    consumer.conserveGreater(this, ['speedDirection']);
    this.markSpellForRemoval();
  };

  isModifierValueInvalid = (): boolean => {
    return this.dmgHealth <= 0;
  }

  getFocusCost = (): number => {
    return Ether.focusCost;
  }

  getModifierLogText = (consumer: Spell): string => {
    return consumer.getSpellName() == 'Phlegm' ? 'continued to ooze!' : 'been become more powerful!'
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

  conferModifierToActive = (consumer: Spell): void => {
    this.conferModifierTo(consumer);
    if (!(consumer instanceof Gyre)) {
      // Add vertical movement to consumer if consumer is Active (ie. moving)
      consumer.updatePropertyValue('upDown', this.rowShift);
    }
    // Conditionally remove from board if out of gyreLives
    this.removeGyreIfOutOfLives();
  }

  conferModifierToInactive = (consumer: Spell): void => {
    this.conferModifierTo(consumer);
    // Automatically remove from board
    this.markSpellForRemoval();
  }

  conferModifierTo = (consumer: Spell): void => {
    // Conserve the greater values between consumer and consumed
    if (!(consumer instanceof Phlegm)) consumer.conserveGreater(this, ['dmgHealth', 'speedDirection']);
    else consumer.conserveGreater(this, ['speedDirection']);

    if (consumer instanceof Gyre) {
      consumer.accumulateProperty(this, 'gyreLives');
      this.gyreLives = 0; // consumer consumes all of consumed's 'gyreLives'
    } else {
      this.gyreLives--;
    }
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
    this.dmgHealth = 5;
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

  conferModifierToActive = (consumer: Spell): void => this.conferModifierTo(consumer);
  conferModifierToInactive = (consumer: Spell): void => this.conferModifierTo(consumer);

  conferModifierTo = (consumer: Spell): void => {
    // Increase the speed of the consumer
    consumer.accumulateProperty(this, 'speedDirection');
    // Conserve the greater 'dmgHealth' value between consumer and consumed
    if (!(consumer instanceof Phlegm)) consumer.conserveGreater(this, ['dmgHealth']);
    // Increment consumed Quickens
    this.consumedQuickens++;
    // Before conferring consumedQuickens to consumer
    consumer.accumulateProperty(this, 'consumedQuickens');

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