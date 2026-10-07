// Cell.ts
import { CellIndex } from '../types';
import { Spell } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { UniqueId } from '../UniqeId';

export class Cell extends UniqueId {
  // Properties
  playerOfPlacementCell: Player | null = null;

  cellIndex: CellIndex;
  transparencyAmt: number = 1.0;
  spell: Spell | null = null;

  constructor(cellIndex: CellIndex) {
    super();
    this.cellIndex = cellIndex;
  }

  // --- Getters & Status Checks ---

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

  getTransparencyAmt = (): number => {
    return this.transparencyAmt;
  };

  // --- State Changers ---

  setSpell = (spell: Spell | null): void => {
    this.spell = spell;
  };

  setTransparencyAmt = (transparencyAmt: number): void => {
    this.transparencyAmt = Math.max(0.0, Math.min(1.0, transparencyAmt));
  };

  setPlayerOfPlacementCell = (playerOfPlacementCell: Player | null): void => {
    this.playerOfPlacementCell = playerOfPlacementCell;
  };

  reset = (): void => {
    this.spell = null;
  }
}