import { SpellPropertyName } from '../types';
import { UniqueId } from '../UniqeId';

export type BadgeValues = {
  secondaryModifiers: Array<SpellPropertyName>;
  updateOrder: number;
  speedDirection: number;
  dmgHealth: number;
  rowShift: number;
}

// Badge.ts
export abstract class Badge extends UniqueId {
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

  constructor(value: number, isVisibleIfZero: boolean, backgroundIcon: string) {
    super();
    this.value = value;
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

export class DirectionSpeedBadge extends Badge {
  constructor(value: number, isVisibleIfZero: boolean) {
    // defaults: hide if zero, custom speed icon asset string
    super(value, isVisibleIfZero, 'icon-speed-arrow');
  }
}

export class DmgHealthBadge extends Badge {
  constructor(value: number, isVisibleIfZero: boolean) {
    // defaults: always show if zero (crucial stat), custom heart icon
    super(value, isVisibleIfZero, 'icon-heart-shield');
  }
}

export class UpdateOrderBadge extends Badge {
  constructor(value: number) {
    // defaults: hide if zero, priority/clock tracking icon
    super(value, false, 'icon-clock-priority');
  }
}

export class RowShiftBadge extends Badge {
  constructor(value: number, isVisibleIfZero: boolean) {
    // defaults: hide if zero, lane dynamic shift indicator icon
    super(value, isVisibleIfZero, 'icon-lane-shift');
  }
}