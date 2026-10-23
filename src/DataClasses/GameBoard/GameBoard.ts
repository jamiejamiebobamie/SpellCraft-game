// GameBoard.ts
import { RefObject } from 'react';
import { CellIndex, DivRefDimensions } from '../types';
import { Cell } from './Cell';
import { Spell } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { proxy } from 'valtio';

export class GameBoard {
  // Config Constants
  static readonly NUM_ROWS: number = 3;
  static readonly NUM_COLS: number = 7;
  static readonly NUM_PLACEMENT_CELLS: number = 3;
  static readonly SHOWN_TRANSPARENCY_AMT = .9;

  // Column depth allowing spell spawning
  readonly numPlacementCells: number = GameBoard.NUM_PLACEMENT_CELLS;

  readonly cells: Array<Cell> = [];
  private isGameBoardDisabled: boolean = false;
  private transparencyAmt: number = GameBoard.SHOWN_TRANSPARENCY_AMT;

  gameBoardRef: RefObject<HTMLDivElement | null> | null = null;

  constructor(player1: Player, player2: Player) {
    this.initializeGrid(player1, player2);
  }

  /**
   * Builds out a flattened multi-column 1D index array mapping tracking properties.
   */

  private initializeGrid = (p1: Player, p2: Player): void => {
    for (let i = 0; i < GameBoard.NUM_ROWS; i++) {
      for (let j = 0; j < GameBoard.NUM_COLS; j++) {
        const cell = proxy(new Cell({ j, i })); // Map (j, i) matching coordinate logic
        // 2. Assign Spawnable Deployment Zones (Within placement column boundaries)
        const isP1SpellPlacementZone = j < this.numPlacementCells;
        const isP2SpellPlacementZone = j >= GameBoard.NUM_COLS - this.numPlacementCells;

        if (isP1SpellPlacementZone)
          cell.setPlayerOfPlacementCell(p1);
        if (isP2SpellPlacementZone)
          cell.setPlayerOfPlacementCell(p2);

        this.cells.push(cell);
      }
    }
  };

  setGameBoardRef = (gameBoardRef: RefObject<HTMLDivElement | null>): void => {
    this.gameBoardRef = gameBoardRef;
  }

  getBoardRefDimensions = (): DivRefDimensions | null => {
    if (!this.gameBoardRef || !this.gameBoardRef.current) {
      return null;
    }
    const { left, top, width, height } = this.gameBoardRef.current.getBoundingClientRect();

    return { left, top, width, height };
  }

  getCellWidth = (): number | null => {
    if (!this.gameBoardRef || !this.gameBoardRef.current) {
      return null;
    }
    const { width } = this.gameBoardRef.current.getBoundingClientRect();
    return width / GameBoard.NUM_COLS;
  }

  // --- Grid Index Calculators ---

  getCellIndexFromScreenCoord = (x: number, y: number): CellIndex | null => {
    if (!this.gameBoardRef || !this.gameBoardRef.current) {
      return null;
    }
    const { left, top, width, height } = this.gameBoardRef.current.getBoundingClientRect();
    if (x < left || y < top || x > left + width || y > top + height) return null;

    const cellWidth = width / GameBoard.NUM_COLS
    const cellHeight = height / GameBoard.NUM_ROWS

    const _x = x - left;
    const _y = y - top;

    const i = Math.floor(_y / cellHeight);
    const j = Math.floor(_x / cellWidth);

    return { i, j };
  }

  getIsOffBoardAt = (index: CellIndex): boolean => {
    return (
      index.i < 0 ||
      index.i >= GameBoard.NUM_ROWS ||
      index.j < 0 ||
      index.j >= GameBoard.NUM_COLS
    );
  };

  getOneDIndexFrom = (index: CellIndex): number => {
    if (this.getIsOffBoardAt(index)) return -1;
    return index.i * GameBoard.NUM_COLS + index.j;
  };

  getCellAt = (index: CellIndex): Cell | null => {
    const idx1D = this.getOneDIndexFrom(index);
    if (idx1D === -1) return null;
    return this.cells[idx1D];
  };

  // --- Spell Management Hooks ---

  setSpellAt = (spell: Spell | null, cell: Cell): void => {
    if (cell) {
      cell.setSpell(spell);
    }
  };

  getIsGameBoardDisabled = (): boolean => {
    return this.isGameBoardDisabled;
  };

  // --- Interaction Configurations ---

  setIsGameBoardDisabled = (isDisabled: boolean): void => {
    this.isGameBoardDisabled = isDisabled;
  };

  getBoardTransparencyAmt = (): number => {
    return this.transparencyAmt;
  };

  reset = (): void => {
    this.isGameBoardDisabled = false;
    this.transparencyAmt = GameBoard.SHOWN_TRANSPARENCY_AMT;
    this.cells.forEach(c => c.reset())
  }

  enableBoard = (): void => {
    this.setIsGameBoardDisabled(false);
  }

  disableBoard = (): void => {
    this.setIsGameBoardDisabled(true);
  }

  // --- NPC Helper Functions ---

  npcGetFutureSpellCollisionRow = (): number => {

    const unguardedRows: Array<number> = [0, 0, 0];

    const incomingSpells: Array<Spell> = this.npcGetIncomingSpells();
    const outgoingSpells: Array<Spell> = this.npcGetOutgoingSpells();

    incomingSpells.forEach(s => {
      unguardedRows[s.getCellIndex().i] += 1;
    });

    outgoingSpells.forEach(s => {
      unguardedRows[s.getCellIndex().i] -= 1;
    });

    /* how close (j) and how fast (speedDirection) the spell is travelling <-- not accounting for these things... */

    const entry = unguardedRows.find(n => n > 0);
    return entry != undefined ? unguardedRows.indexOf(entry) : -1;
  }

  npcGetIncomingSpells = (): Array<Spell> => {
    return this.cells.filter(c => {
      if (c.getIsFree()) return false;
      const spell = c.getSpell();
      if (!spell) return false;
      const speedDirection = spell.getPropertyValue('speedDirection');
      const dmgHealth = spell.getPropertyValue('dmgHealth');
      const isMovingRight = speedDirection > 0;
      return isMovingRight && dmgHealth > 0;
    }).map(c => c.getSpell()).filter(s => s != null);
  }

  npcGetOutgoingSpells = (): Array<Spell> => {
    return this.cells.filter(c => {
      if (c.getIsFree()) return false;
      const spell = c.getSpell();
      if (!spell) return false;
      const speedDirection = spell.getPropertyValue('speedDirection');
      const isMovingLeft = speedDirection < 0;
      return isMovingLeft;
    }).map(c => c.getSpell()).filter(s => s != null);
  }
}