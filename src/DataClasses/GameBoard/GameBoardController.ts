// GameBoard.ts
import { CellIndex } from '../types';
import { Cell } from './Cell';
import { Spell } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';

export class GameBoardController {
  // Config Constants
  static readonly NUM_ROWS: number = 3;
  static readonly NUM_COLS: number = 7;
  readonly numPlayerCells: number = 1;     // Column size for endzones/home bases
  readonly numPlacementCells: number = 2;  // Column depth allowing spell spawning

  static readonly HIDDEN_TRANSPARENCY_AMT = .3;
  static readonly SHOWN_TRANSPARENCY_AMT = .8;

  // Board Data Layers
  readonly cells: Array<Cell> = [];

  // Interactive Overrides
  private isClickDisabled: boolean = false;
  private isHoverDisabled: boolean = false;
  private transparencyAmt: number = 1.0;

  // Trackers
  hoveredCell: Cell | null = null;
  clickedCell: Cell | null = null;

  constructor(player1: Player, player2: Player) {
    this.initializeGrid(player1, player2);
  }

  /**
   * Builds out a flattened multi-column 1D index array mapping tracking properties.
   */

  private initializeGrid = (p1: Player, p2: Player): void => {
    for (let i = 0; i < GameBoardController.NUM_ROWS; i++) {
      for (let j = 0; j < GameBoardController.NUM_COLS; j++) {
        const cell = new Cell({ j, i }); // Map (j, i) matching coordinate logic

        // 1. Assign Home-Bases / Player Owners (First columns vs Last columns)
        if (j < this.numPlayerCells) {
          cell.playerCellOwner = p1;
          cell.backgroundIcon = 'p1-home-zone';
        } else if (j >= GameBoardController.NUM_COLS - this.numPlayerCells) {
          cell.playerCellOwner = p2;
          cell.backgroundIcon = 'p2-home-zone';
        }

        // 2. Assign Spawnable Deployment Zones (Within placement column boundaries)
        const isP1SpellPlacementZone = j < this.numPlacementCells;
        const isP2SpellPlacementZone = j >= GameBoardController.NUM_COLS - this.numPlacementCells;

        if (isP1SpellPlacementZone) {
          cell.setPlayerOfPlacementCell(p1);
        }

        if (isP2SpellPlacementZone) {
          cell.setPlayerOfPlacementCell(p2);
        }

        this.cells.push(cell);
      }
    }
  };

  // --- Grid Index Calculators ---

  getIsOffBoardAt = (index: CellIndex): boolean => {
    return (
      index.i < 0 ||
      index.i >= GameBoardController.NUM_ROWS ||
      index.j < 0 ||
      index.j >= GameBoardController.NUM_COLS
    );
  };

  getOneDIndexFrom = (index: CellIndex): number => {
    if (this.getIsOffBoardAt(index)) return -1;
    return index.i * GameBoardController.NUM_COLS + index.j;
  };

  getCellAt = (index: CellIndex): Cell | null => {
    const idx1D = this.getOneDIndexFrom(index);
    if (idx1D === -1) return null;
    return this.cells[idx1D];
  };

  // --- Spell Management Hooks ---

  getSpellAt = (index: CellIndex): Spell | null => {
    const cell = this.getCellAt(index);
    return cell ? cell.getSpell() : null;
  };

  setSpellAt = (index: CellIndex, spell: Spell | null): void => {
    const cell = this.getCellAt(index);
    if (cell) {
      cell.setSpell(spell);
    }
  };

  getIsCellFreeAt = (index: CellIndex): boolean => {
    const cell = this.getCellAt(index);
    return cell ? cell.getIsFree() : false;
  };

  getIsClickDisabled = (): boolean => {
    return this.isClickDisabled;
  };

  getIsHoverDisabled = (): boolean => {
    return this.isHoverDisabled;
  };

  // --- Interaction Configurations ---

  setIsClickDisabled = (isDisabled: boolean): void => {
    this.isClickDisabled = isDisabled;
    this.cells.forEach(cell => cell.setIsClickDisabled(isDisabled));
  };

  setIsHoverDisabled = (isDisabled: boolean): void => {
    this.isHoverDisabled = isDisabled;
    this.cells.forEach(cell => cell.setIsHoverDisabled(isDisabled));
  };

  getBoardTransparencyAmt = (): number => {
    return this.transparencyAmt;
  };

  setBoardTransparencyAmt = (transparencyAmt: number): void => {
    this.transparencyAmt = Math.max(0.0, Math.min(1.0, transparencyAmt));
    this.cells.forEach(cell => cell.setTransparencyAmt(this.transparencyAmt));
  };

  enableBoard = (): void => {
    this.setIsClickDisabled(false);
    this.setIsHoverDisabled(false);
    this.setBoardTransparencyAmt(GameBoardController.SHOWN_TRANSPARENCY_AMT)
  }

  disableBoard = (): void => {
    this.setIsClickDisabled(true);
    this.setIsHoverDisabled(true);
    this.setBoardTransparencyAmt(GameBoardController.HIDDEN_TRANSPARENCY_AMT)
  }

  // --- Note: Handling hoveredCell and clickedCell updates ---
  // Rather than managing dynamic indexing hooks directly via setters here, 
  // you can simply capture cell instances explicitly directly within your engine loops:

  selectCell = (cell: Cell): void => {
    this.clickedCell = cell;
    cell.onClick();
  };

  hoverCell = (cell: Cell | null): void => {
    this.hoveredCell = cell;
    if (cell) cell.onHover();
  };
}