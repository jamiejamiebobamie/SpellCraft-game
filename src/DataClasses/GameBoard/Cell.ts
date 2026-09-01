// Cell.ts
import { CellIndex } from '../types';
import { Spell } from '../PlacedSpells/Spell';
import {
  Badge, DirectionSpeedBadge,
  DmgHealthBadge,
  UpdateOrderBadge,
  RowShiftBadge
} from '../GameBoard/Badge';
import { Player } from '../Player/Player';

export class Cell {
  // Properties
  playerOfPlacementCell: Player | null = null;
  playerCellOwner: Player | null = null;
  isHighlighted: boolean = false;
  backgroundIcon: string = 'default-bg';
  color: string = '';
  cellIndex: CellIndex;

  isClickDisabled: boolean = false;
  isHoverDisabled: boolean = false;
  transparencyAmt: number = 1.0; // Normalized: [0.0, 1.0]

  spell: Spell | null = null;
  badges: Array<Badge>;

  constructor(cellIndex: CellIndex) {
    this.cellIndex = cellIndex;

    this.badges = [];
  }

  // --- Getters & Status Checks ---

  getColor = (): string => {
    return this.color;
  };

  getIsFree = (): boolean => {
    return this.spell === null;
  };

  getSpell = (): Spell | null => {
    return this.spell;
  };

  getCellIndex = (): CellIndex => {
    return this.cellIndex;
  };

  getIsPlaceCell = (player: Player): boolean => {
    return player === this.playerOfPlacementCell;
  };

  getIsHighlighted = (): boolean => {
    return this.isHighlighted;
  };

  getCellOwner = (): Player | null => {
    return this.playerCellOwner;
  };

  getPlayerAllowedToPlaceSpellsOnCell = (): Player | null => {
    return this.playerOfPlacementCell;
  };

  getIsPlayerCell = (): boolean => {
    // If there is an assigned player owner, it is a player base/endzone cell
    return this.playerCellOwner !== null;
  };

  getTransparencyAmt = (): number => {
    return this.transparencyAmt;
  };

  // --- State Changers ---

  setSpell = (spell: Spell | null): void => {
    this.spell = spell;

    if (spell) {
      // Sync spell stats directly down to the cell indicators
      this.updateBadgeValues(spell);
      this.showBadges();

      // Update cell color mapping to match the spell's caster player identity color
      this.setColor(spell.caster.getColor());
    } else {
      this.hideBadges();
      this.setColor('');
    }
  };

  setIsHighlighted = (isHighlighted: boolean): boolean => {
    this.isHighlighted = isHighlighted;
    return this.isHighlighted;
  };

  setColor = (color: string): void => {
    this.color = color;
  };

  setIsClickDisabled = (isDisabled: boolean): void => {
    this.isClickDisabled = isDisabled;
  };

  setIsHoverDisabled = (isDisabled: boolean): void => {
    this.isHoverDisabled = isDisabled;
  };

  setTransparencyAmt = (transparencyAmt: number): void => {
    this.transparencyAmt = Math.max(0.0, Math.min(1.0, transparencyAmt));
  };

  setPlayerOfPlacementCell = (playerOfPlacementCell: Player | null): void => {
    this.playerOfPlacementCell = playerOfPlacementCell;
  };

  // --- Badge Management ---

  hideBadges = (): void => {
    this.badges.forEach(badge => badge.hide());
  };

  showBadges = (): void => {
    this.badges.forEach(badge => {
      // Check if it's safe to turn back on or if zero values should keep it hidden
      if (badge.value === 0 && !badge.isVisibleIfZero) {
        badge.hide();
      } else {
        badge.display();
      }
    });
  };

  updateBadgeValues = (spell: Spell): void => {

    /*
    
      badges need to be shown when spell occupies a cell

      spell on cell determines:
        badge values
        badge order (dependent on spells 'speedDirection' value) in this.badges array
        which badges are visible if badge value is zero (dependent on spell...)

    */

    const {
      secondaryModifiers,
      updateOrder,
      speedDirection,
      dmgHealth,
      rowShift
    } = spell.getBadgeValues();

    const dmgHealthBadge = new DmgHealthBadge(dmgHealth, secondaryModifiers.includes('dmgHealth'));
    const updateOrderBadge = new UpdateOrderBadge(updateOrder);
    const rowShiftBadge = new RowShiftBadge(rowShift, secondaryModifiers.includes('rowShift'));
    const speedDirectionBadge = new DirectionSpeedBadge(speedDirection, secondaryModifiers.includes('speedDirection'));

    // speedDirection = 1 (going right)
    this.badges = speedDirection > 0 ? [
      dmgHealthBadge, // top-left
      updateOrderBadge, // top-right
      rowShiftBadge, // bottom-left
      speedDirectionBadge // bottom-right
    ] :
      // speedDirection = -1 or 0 (going left/nowhere)
      [
        updateOrderBadge, // top-left
        dmgHealthBadge, // top-right
        speedDirectionBadge, // bottom-left
        rowShiftBadge // bottom-right
      ];

      // console.log({ spellName: spell.getSpellName(), badges: this.badges })
  };

  // --- Interaction Event Stubs ---

  onHover = (): void => {
    if (this.isHoverDisabled) return;
    // console.log({ cellIndex: this.cellIndex })
    // Engine hook placeholder: compute highlighting paths, show valid moves, etc.
  };

  onClick = (): void => {
    if (this.isClickDisabled) return;
    // Engine hook placeholder: accept cursor spells, target selection, etc.
  };
}