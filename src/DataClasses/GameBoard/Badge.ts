/*

different placed spells require different 'isHideIfZero' values
different placed spells are destroyed when their states reach zero
(examples: ether destroyed if dmg == 0, but speedDirection can reach 0 and the spell will remain on board)
player needs to see the 0 speedDirection Badge value on the cell...

TO-DO:
1. update 'setSpell' method on 'Cell' class to update the Badge's 'isHideIfZero' accordingly
2. implement "stat destruction" after spell collision due to stats reaching zero (dependent on spell type)
3. implement 'updateOrder' to show on Cell Badge. update the updateOrder when the placedSpells are added or removed.
updateOrder = spells index in "PlacedSpelld"

*/


// Badge.ts
export abstract class Badge {
  value: number = 0;
  isVisibleIfZero: boolean;
  transparencyAmt: number = 1.0; // 0.0 to 1.0
  backgroundIcon: string;
  color: string;

  // Configuration constants
  protected readonly defaultTransparency = 1.0;
  protected readonly positiveColor = '#00FF00'; // Green
  protected readonly negativeColor = '#FF0000'; // Red
  protected readonly neutralColor = '#FFFFFF';  // White

  constructor(isVisibleIfZero: boolean, backgroundIcon: string) {
    this.isVisibleIfZero = isVisibleIfZero;
    this.backgroundIcon = backgroundIcon;
    this.color = this.neutralColor;
  }

  // --- Methods (Arrow functions to safely preserve 'this' context) ---

  /**
   * Updates the value and automatically evaluates the matching color state.
   */
  updateValue = (newValue: number): void => {
    this.value = newValue;
    this.evaluateColor();

    // Note: If using Valtio, mutating this property will automatically 
    // flag your React/Styled-Components layer to trigger an animation.
  };

  setTransparencyAmt = (amt: number): void => {
    // Clamp between 0.0 and 1.0
    this.transparencyAmt = Math.max(0.0, Math.min(1.0, amt));
  };

  hide = (): void => {
    this.setTransparencyAmt(0.0);
  };

  display = (): void => {
    this.setTransparencyAmt(this.defaultTransparency);
  };

  updateColor = (newColor: string): void => {
    this.color = newColor;
  };

  updateBackgroundIcon = (newIcon: string): void => {
    this.backgroundIcon = newIcon;
  };

  /**
   * Evaluates if the text color should shift depending on positive or negative values.
   */
  protected evaluateColor = (): void => {
    if (this.value > 0) {
      this.color = this.positiveColor;
    } else if (this.value < 0) {
      this.color = this.negativeColor;
    } else {
      this.color = this.neutralColor;
    }
  };
}

// BadgeSubclasses.ts
// import { Badge } from './Badge';

export class DirectionSpeedBadge extends Badge {
  constructor() {
    // defaults: hide if zero, custom speed icon asset string
    super(false, 'icon-speed-arrow'); 
  }
}

export class DmgHealthBadge extends Badge {
  constructor() {
    // defaults: always show if zero (crucial stat), custom heart icon
    super(true, 'icon-heart-shield'); 
  }
}

export class UpdateOrderBadge extends Badge {
  constructor() {
    // defaults: hide if zero, priority/clock tracking icon
    super(false, 'icon-clock-priority');
  }
}

export class RowShiftBadge extends Badge {
  constructor() {
    // defaults: hide if zero, lane dynamic shift indicator icon
    super(false, 'icon-lane-shift');
  }
}