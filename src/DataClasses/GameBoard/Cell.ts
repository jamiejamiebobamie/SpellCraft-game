// Cell.ts
import { CellIndex, BadgeValues } from '../types';
import { Spell } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqeId';

// TO-DO: Cell hover speedDirection progress highlight is not working...
export class Cell extends UniqueId {
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

  constructor(cellIndex: CellIndex) {
    super();
    this.cellIndex = cellIndex;
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

  getTransparencyAmt = (): number => {
    return this.transparencyAmt;
  };

  // --- State Changers ---

  setSpell = (spell: Spell | null): void => {
    this.spell = spell;
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

  reset = (): void => {
    this.isHighlighted = false;
    this.isClickDisabled = false;
    this.isHoverDisabled = false;
    this.spell = null;
  }
}