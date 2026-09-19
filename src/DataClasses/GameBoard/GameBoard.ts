// GameBoard.ts
import { RefObject } from 'react';
import { CellIndex, SpellPropertyName, GameBoardRefDimensions, Point, NPCMoveData } from '../types';
import { Cell } from './Cell';
import { Spell, Ether, Phlegm, Quicken, Gyre } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { proxy } from 'valtio';

export class GameBoard {
  // Config Constants
  static readonly NUM_ROWS: number = 3;
  static readonly NUM_COLS: number = 7;

  static readonly NUM_PLAYER_CELLS: number = 1;
  static readonly NUM_PLACEMENT_CELLS: number = 3;

  readonly numPlayerCells: number = GameBoard.NUM_PLAYER_CELLS;     // Column size for endzones/home bases
  readonly numPlacementCells: number = GameBoard.NUM_PLACEMENT_CELLS;  // Column depth allowing spell spawning

  static readonly HIDDEN_TRANSPARENCY_AMT = .3;
  static readonly SHOWN_TRANSPARENCY_AMT = .9;

  // Board Data Layers
  readonly cells: Array<Cell> = [];

  // Interactive Overrides
  private isClickDisabled: boolean = false;
  private isHoverDisabled: boolean = false;
  private transparencyAmt: number = GameBoard.SHOWN_TRANSPARENCY_AMT;

  gameBoardRef: RefObject<HTMLDivElement | null> | null = null;
  npcMoveData: NPCMoveData | null = null;

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
    for (let i = 0; i < GameBoard.NUM_ROWS; i++) {
      for (let j = 0; j < GameBoard.NUM_COLS; j++) {
        const cell = proxy(new Cell({ j, i })); // Map (j, i) matching coordinate logic

        // 1. Assign Home-Bases / Player Owners (First columns vs Last columns)
        if (j < this.numPlayerCells) {
          cell.playerCellOwner = p1;
          cell.backgroundIcon = 'p1-home-zone';
        } else if (j >= GameBoard.NUM_COLS - this.numPlayerCells) {
          cell.playerCellOwner = p2;
          cell.backgroundIcon = 'p2-home-zone';
        }

        // 2. Assign Spawnable Deployment Zones (Within placement column boundaries)
        const isP1SpellPlacementZone = j < this.numPlacementCells;
        const isP2SpellPlacementZone = j >= GameBoard.NUM_COLS - this.numPlacementCells;

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

  setGameBoardRef = (gameBoardRef: RefObject<HTMLDivElement | null>): void => {
    this.gameBoardRef = gameBoardRef;
  }

  getNPCMoveData = (): NPCMoveData | null => {
    return this.npcMoveData;
  }

  setNPCMoveData = (npcMoveData: NPCMoveData | null) => {
    this.npcMoveData = npcMoveData;
  }

  getBoardRefDimensions = (): GameBoardRefDimensions | null => {
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

  getScreenCoordFromCellIndex = (cellIndex: CellIndex): Point | null => {
    if (!this.gameBoardRef || !this.gameBoardRef.current) {
      return null;
    }
    const { left, top, width, height } = this.gameBoardRef.current.getBoundingClientRect();
    const cellWidth = width / GameBoard.NUM_COLS
    const cellHeight = height / GameBoard.NUM_ROWS
    const x = left + cellIndex.j * cellWidth // x
    const y = top + cellIndex.i * cellHeight // y
    return { x, y }
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

  getTwoDIndexFrom = (index: number): CellIndex | null => {
    if (index < 0 || index >= GameBoard.NUM_COLS * GameBoard.NUM_ROWS) return null;
    const i = Math.floor(index / GameBoard.NUM_COLS);
    const j = index % GameBoard.NUM_COLS;
    return { i, j };
  };


  getCellAt = (index: CellIndex): Cell | null => {
    const idx1D = this.getOneDIndexFrom(index);
    if (idx1D === -1) return null;
    return this.cells[idx1D];
  };

  addCellIndices = (cell1: CellIndex, cell2: CellIndex): CellIndex => {
    return { i: cell1.i + cell2.i, j: cell1.j + cell2.j };
  }

  // --- Spell Management Hooks ---

  getSpellAt = (index: CellIndex): Spell | null => {
    const cell = this.getCellAt(index);
    return cell ? cell.getSpell() : null;
  };

  setSpellAt = (spell: Spell | null, cell: Cell): void => {
    if (cell) {
      cell.setSpell(spell);
      this.setEmpoweredSpells();
    }
  };

  clearEmpoweredPngStatus = (params: { cell: Cell, spell: Spell | null }) => {
    params.cell.setEmpoweredColor('');
    if (!!params.spell) {
      params.spell.setEmpoweredPng(0);
    }
  }

  /*
    Gets the spell's <property> given the board state.
    "Empowered" spells are empowered due to their position relative to a group of the same spell type.
    Their dmg values are summed and their speed values are collectively the max of the group.
  */
  getSpellProperty = (spell: Spell, spellProperty: SpellPropertyName): number => {
    let propertyValue = spell.getPropertyValue(spellProperty);
    if (!(spell instanceof Quicken || spell instanceof Gyre)) return propertyValue;

    let doAction = (propVal1: number, propVal2: number): number => 0;
    if (spellProperty == 'speedDirection') doAction = (propVal1: number, propVal2: number): number => Math.max(propVal1, propVal2);
    if (spellProperty == 'dmgHealth') doAction = (propVal1: number, propVal2: number): number => propVal1 + propVal2;

    const cellIndex = spell.getCellIndex();
    const uniqueSpells = new Set<Spell>([spell]);

    const recur = (cellIndexOffset: CellIndex, originalCellIndexOffset: CellIndex, lastValidSpell: Spell): void => {
      if (lastValidSpell && spell.isConditionToEmpower(lastValidSpell)) uniqueSpells.add(lastValidSpell);
      const ci = this.addCellIndices(cellIndex, cellIndexOffset);
      const neighborCell = this.getCellAt(ci);
      if (!neighborCell) {
        return;
      }
      const neighborSpell = neighborCell.getSpell();
      if (!neighborSpell) {
        return;
      }
      const offset = this.addCellIndices(cellIndexOffset, originalCellIndexOffset);
      recur(offset, originalCellIndexOffset, neighborSpell);
      return;
    }

    const direction = spell.getEmpoweredDirection();
    const cellIndexOffsets = spell.getEmpoweredNeighborIndexOffsets(direction);
    const [offsetBackward, offsetForward] = cellIndexOffsets;
    const backwardSpell = this.getCellAt(this.addCellIndices(cellIndex, offsetBackward))?.getSpell();
    const forwardSpell = this.getCellAt(this.addCellIndices(cellIndex, offsetForward))?.getSpell();

    !!backwardSpell && recur(offsetBackward, structuredClone(offsetBackward), backwardSpell)
    !!forwardSpell && recur(offsetForward, structuredClone(offsetForward), forwardSpell);

    propertyValue = Array.from(uniqueSpells).reduce((acc, spell) => {
      const propertyValue = spell.getPropertyValue(spellProperty);
      return doAction(acc, propertyValue);
    }, 0);
    return propertyValue;
  }

  setEmpoweredSpells = () => {
    this.cells.forEach(cell => {
      const spell = cell.getSpell();

      if (!spell) {
        this.clearEmpoweredPngStatus({ cell, spell: null });
        return;
      }

      // Direction property ensures returned array is going from "back to front" based on given 'direction'.
      const direction = spell.getEmpoweredDirection();
      const cellIndexOffsets = spell.getEmpoweredNeighborIndexOffsets(direction);
      if (!cellIndexOffsets.length) {
        this.clearEmpoweredPngStatus({ cell, spell });
        return;
      }

      // Clear current cell/spell before iterating and setting empoweredPng data.
      // 'setConditionallyEmpoweredPng' requires default state intially.
      this.clearEmpoweredPngStatus({ cell, spell });

      const cellIndex = cell.getCellIndex();
      const neighborSpells: Array<Spell | null> = cellIndexOffsets.map(offset => {
        const ci = this.addCellIndices(cellIndex, offset);
        const neighborCell = this.getCellAt(ci);
        if (!neighborCell) return null;
        const neighborSpell = neighborCell.getSpell();
        if (!neighborSpell) return null;
        return neighborSpell;
      });

      spell.setConditionallyEmpoweredPng(neighborSpells);

      if (spell.getIsEmpowered()) {
        cell.setEmpoweredColor(spell.getEmpoweredColor());
      }
    });

    this.cells.forEach(cell => {
      const spell = cell.getSpell();
      if (!spell) return;

      if (spell.getIsRemove()) {
        spell.updatePropertyValue('empoweredDmgHealth', 0);
        spell.updatePropertyValue('empoweredSpeedDirection', 0);
      }

      // Update "empowered" spell properties 
      if (spell.getIsEmpowered()) {
        const empoweredSpeedDirection = this.getSpellProperty(spell, 'speedDirection');
        const empoweredDmgHealth = this.getSpellProperty(spell, 'dmgHealth');
        spell.updatePropertyValue('empoweredDmgHealth', empoweredDmgHealth);
        spell.updatePropertyValue('empoweredSpeedDirection', empoweredSpeedDirection);
      } else {
        spell.updatePropertyValue('empoweredDmgHealth', 0);
        spell.updatePropertyValue('empoweredSpeedDirection', 0);
      }
    });
  }

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

  getRandomPlacementCell = (player: Player, rowIndex?: number): Cell => {
    let placeCells = this.cells.filter(c =>
      c.getIsFree() &&
      c.getIsPlaceCell(player) &&
      (rowIndex != undefined ?
        c.getCellIndex().i == rowIndex
        : true));
    if (!placeCells.length) {
      placeCells = this.cells.filter(c =>
        c.getIsFree() &&
        c.getIsPlaceCell(player));
    }

    const rand = Math.floor(Math.random() * placeCells.length);
    return placeCells[rand];
  }

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

  npcGetHealingRow = (): number | undefined => {

    const healingRows: Set<number> = new Set()

    const outgoingSpells: Array<Spell> = this.npcGetOutgoingSpells();
    outgoingSpells.filter(s => s.getPropertyValue('dmgHealth') < 0).map(s => healingRows.add(s.getCellIndex().i));

    return Array.from(healingRows.keys())[0];
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

  reset = (): void => {
    this.isHoverDisabled = false;
    this.isClickDisabled = false;
    this.transparencyAmt = GameBoard.SHOWN_TRANSPARENCY_AMT;
    this.hoveredCell = null;
    this.clickedCell = null;
    this.cells.forEach(c => c.reset())
  }

  enableBoard = (): void => {
    // this.setIsClickDisabled(false);
    this.setIsHoverDisabled(false);
    // this.setBoardTransparencyAmt(GameBoard.SHOWN_TRANSPARENCY_AMT)
  }

  disableBoard = (): void => {
    // this.setIsClickDisabled(true);
    this.setIsHoverDisabled(true);
    // this.setBoardTransparencyAmt(GameBoard.HIDDEN_TRANSPARENCY_AMT)
  }

  // --- Note: Handling hoveredCell and clickedCell updates ---
  // Rather than managing dynamic indexing hooks directly via setters here, 
  // you can simply capture cell instances explicitly directly within your engine loops:

  selectCell = (cell: Cell): void => {
    this.clickedCell = cell;
    cell.onClick();
  };

  hoverCell = (cell: Cell | null): void => {
    const oldHoveredCell = this.hoveredCell;
    this.hoveredCell = cell;

    // turn off any path that was highlighted
    if (oldHoveredCell)
      this.cells.forEach(c => c.setIsHighlighted(false));

    // turn on new cells for path
    if (cell) {
      const spell = cell.getSpell();
      if (!spell) return;
      const numMoves = Math.abs(spell.getPropertyValue('empoweredSpeedDirection'));
      const sign = Math.sign(spell.getPropertyValue('empoweredSpeedDirection'));

      const { i, j } = cell.getCellIndex();
      for (let k = 0; k < numMoves; k++) {
        const pathCell = this.getCellAt({ i: i, j: j + k * sign + 1 * sign });
        if (pathCell) pathCell.setIsHighlighted(true);
      }
    }

    if (cell) cell.onHover(); // does nothing atm...
  };
}