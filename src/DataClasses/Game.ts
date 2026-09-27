// Game.ts
import { RefObject } from 'react';
import { GameBoard } from './GameBoard/GameBoard';
import { Cell } from './GameBoard/Cell';
import { GameLog, GameLogEntry } from './GameLog';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol } from './PlacedSpells/GameSymbol';
import { GameClock } from './GameClock'
import { Player } from './Player/Player';
import { NPCPlayer } from './Player/NpcPlayer';
import { KeyAction, useKeyPress } from '../UI_Components/UI_Elements/UseKeyPress'
import { InferenceString, CellIndex, NpcDifficulty, SpellConstructor, Point, NPCMoveData, DivRefDimensions } from './types';
import { HARDCODED_SYMBOLS } from './PlacedSpells/HardCodedSymbols'
import { proxy } from 'valtio';

// TO-DO: add back in 'tsc -b &&' for the build script options... ORIGINAL:     "build": "tsc -b && vite build",


export const GameOverStatus = {
  BothDead: 0,
  PlayerWon: 1,
  NpcWon: 2,
  TimesUp: 3,
} as const;

// Create a type out of the object if needed
export type GameOver = typeof GameOverStatus[keyof typeof GameOverStatus]; // "UP" | "DOWN"

export class Game {
  // Core Subsystem Managers
  gameBoard!: GameBoard;
  gameLog!: GameLog;
  placedSpells!: PlacedSpells;
  model!: Model;
  spellCanvas!: SpellCanvas;
  gameClock!: GameClock;
  keyActions: Array<KeyAction> = []; // TO-DO: consider KeyBindings class

  players!: [Player, Player];
  humanPlayer: Player | null = null;
  computerPlayer: NPCPlayer | null = null;

  isClickDisabled: boolean = false; // TO-DO: reduce disabled variables... to 'isGameBoardDisabled'
  isHoverDisabled: boolean = false;
  isSpellBookOpen: boolean = false;
  hoveredSpell: Spell | null = null;
  gameOver: GameOver | null = null;

  npcMoveData: Array<NPCMoveData> = [];
  gameWrapperRef: RefObject<HTMLDivElement | null> | null = null;

  forceUpdate: () => void = () => { };

  constructor() {
    this.init();
  }

  /*
  

  TO-DO: consider showing tips (that can be toggled off) for certain actions the first time they are triggered:

    - drawing off the board completely or completely off placement cells
    - casting more than 4 spells per turn (blood magic)
    - creating an "empowered" spell
    - healing with Phelgm
    - reversing with Phlegm
    - out of focus -> end turn -> progressing time necessary, but increases chances of getting caught by a teacher!
    - consuming a spell
    - NPC casting a spell -> what is the conceit of the game? what is the goal?

    TO-DO: store "toggle-off tool tips" in local storage

  
  */

  init = (): void => {
    // 1. Create a fresh instance of the Logger
    this.gameLog = proxy(new GameLog());
    this.clearLog();
    this.appendToLog('Initializing new mystical duel...', '#a78bfa');

    // 2. Spawn fresh data layers for both players
    const humanPlayer = proxy(new Player(1, '#3b82f6', './player_avatars/PlayerAvatar.png'));
    const computerPlayer = proxy(new NPCPlayer(-1, '#ef4444', './player_avatars/PlayerAvatar_NPC.png'));
    this.players = [humanPlayer, computerPlayer];
    this.humanPlayer = humanPlayer;
    this.computerPlayer = computerPlayer;

    this.gameBoard = proxy(new GameBoard(humanPlayer, computerPlayer));

    this.placedSpells = proxy(new PlacedSpells());
    this.model = proxy(new Model());
    this.model.init();

    this.spellCanvas = proxy(new SpellCanvas());

    this.gameClock = proxy(new GameClock(this.endTurn));

    this.setupGameplayKeyBindings();

    // setTimeout(() => {
    //   if (this.computerPlayer) {
    //     this.computerPlayer.resetNumRemainingMovesPerTurn(); // resets NPC moves to between 2-3
    //     this.doNpcMove();
    //   }
    // }, 1500);
  };

  resetGame = (): void => {
    this.placedSpells.reset();
    this.gameBoard.reset();
    this.players.forEach(p => p.reset());
    this.resetMinuteAngleAcc();
    this.hoveredSpell = null;
    this.gameOver = null;
    this.isClickDisabled = false;
    this.isHoverDisabled = false;
    this.clearLog();
    this.appendToLog('Initializing new mystical duel...', '#a78bfa');
  };

  // --- GameLog Delegation Wrappers ---

  clearLog = (): void => {
    this.gameLog.clearAllEntries();
  };

  appendToLog = (text: string, color: string = '#FFFFFF'): void => {
    this.gameLog.appendEntry(text, color);
  };

  // --- GameState Input Delegation Wrappers ---

  setupGameplayKeyBindings = (): void => {
    const keyActions: Array<KeyAction> = [];

    /*
     READY/CLEAR <Spell> -> sets this.gameSymbol with GameSymbol of <type>.
    */
    Array.from(GameSymbol.SPELL_LOOKUP.keys()).forEach((inferenceString, i) => {
      keyActions.push({
        keycodes: [`Digit${i + 1}`], // READY spell
        action: () => this.instantiateGameSymbolFromInferenceString(inferenceString)
      });
    });
    keyActions.push({
      keycodes: ['Digit6'], // CLEAR readied spell
      action: () => this.cancelPlacingSymbol()
    });

    /*
     PLACE Readied Spell -> calls placeSpellOnBoard(<hardcoded_CellIndex>)
    */
    const placeSpellKeyActions: Array<{ keycodes: Array<string>, cellIndex: CellIndex }> = [
      // ROW 1
      { keycodes: ['KeyQ'], cellIndex: { i: 0, j: 0 } },
      { keycodes: ['KeyW'], cellIndex: { i: 0, j: 1 } },
      { keycodes: ['KeyE'], cellIndex: { i: 0, j: 2 } },
      // ROW 2
      { keycodes: ['KeyA'], cellIndex: { i: 1, j: 0 } },
      { keycodes: ['KeyS'], cellIndex: { i: 1, j: 1 } },
      { keycodes: ['KeyD'], cellIndex: { i: 1, j: 2 } },
      // ROW 3
      { keycodes: ['KeyZ'], cellIndex: { i: 2, j: 0 } },
      { keycodes: ['KeyX'], cellIndex: { i: 2, j: 1 } },
      { keycodes: ['KeyC'], cellIndex: { i: 2, j: 2 } }
    ];
    placeSpellKeyActions.forEach(({ keycodes, cellIndex }) => {
      keyActions.push({
        keycodes,
        action: () => {
          const cell = this.gameBoard.getCellAt(cellIndex);
          if (cell && this.humanPlayer) this.placeSpellOnBoard(cell);
        }
      });
    })

    // END turn
    keyActions.push({
      keycodes: ['Escape', 'Space'],
      action: this.endTurn
    });

    // CYCLE through NPC Difficulties: 'Normal' -> 'Hard' -> 'Brutal' -> 'Normal'
    keyActions.push({
      keycodes: ['ShiftLeft', 'ShiftRight'],
      action: () => this.cycleThroughDifficulties()
    });

    this.keyActions = proxy(keyActions);
  }

  useGameplayKeyBindings = (): void => {
    useKeyPress({ keyActions: this.keyActions, isDisabled: false, forceUpdate: this.forceUpdate });
  }

  setForceUpdate = (forceUpdate: () => void) => {
    this.forceUpdate = forceUpdate;
  }

  // --- Action Dispatcher Utilities ---

  getMinuteAngleAcc = (): number => {
    return this.gameClock.getMinuteAngleAcc();
  }

  incrementMinuteAngleAcc = (): void => {
    this.gameClock.incrementMinuteAngleAcc();
  }

  resetMinuteAngleAcc = (): void => {
    this.gameClock.resetMinuteAngleAcc();
  }

  getSecondsHandAngle = (): number => {
    return this.gameClock.getSecondsHandAngle();
  }

  resetClock = (): void => {
    this.gameClock.resetClock();
  }

  pauseClock = (): void => {
    this.gameClock.pauseClock();
  }

  unpauseClock = (): void => {
    this.gameClock.unpauseClock();
  }

  startClock = (): void => {
    this.gameClock.startClock();
  }

  stopClock = (): void => {
    this.gameClock.stopClock();
  }

  getClockChimeSeconds = (): number => {
    const numTotalMoves = this.placedSpells.spells.reduce((acc, item) => acc + Math.abs(item.speedDirection), 0);
    return Math.max(4, Math.floor(numTotalMoves * PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000));
  }

  getIsGameBoardDisabled = (): boolean => {
    return this.gameBoard.getIsHoverDisabled();
  }

  enableGameBoard = (): void => {
    this.gameBoard.enableBoard();
  }

  disableGameBoard = (): void => {
    this.gameBoard.disableBoard();
  }

  isCanPlaceGameSymbolOn = (cell: Cell, player?: Player): boolean => {
    const p = player ? player : this.humanPlayer;
    return !!p && !this.getIsGameBoardDisabled() && cell.getIsFree() && cell.getIsPlaceCell(p);
  }

  getLogEntries = (): Array<GameLogEntry> => {
    return this.gameLog.logEntries;
  };

  regenFocusForPlayers = () => {
    this.players.forEach(p => p.decrementFocus(p.getFocusRegenAmt()));
  }

  placeSpellOnBoard = async (cell: Cell, player?: Player): Promise<void> => {
    const p = player ? player : this.humanPlayer;
    if (p && this.isCanPlaceGameSymbolOn(cell, p)) {
      const gameSymbol = p.getGameSymbol();
      if (gameSymbol) {
        const spell = gameSymbol.instantiateSpell();
        if (spell instanceof Spell) {
          p.setGameSymbol(null);
          spell.setCellIndex(cell.getCellIndex());
          this.placedSpells.addSpell(spell);
          this.gameBoard.setSpellAt(spell, cell);
          spell.setIsPlaced(true);
        }
      }
    }
  }

  getCellAt = (cellIndex: CellIndex): Cell | null => {
    const cell = this.gameBoard.getCellAt(cellIndex);
    return cell;
  }

  getHasFocus = (): boolean => {
    if (this.humanPlayer) {
      return this.humanPlayer.getFocus() > 0;
    } else return false;
  }

  getHumanPlayer = (): Player | null => {
    return this.humanPlayer;
  }

  getNpcPlayer = (): NPCPlayer | null => {
    return this.computerPlayer;
  }

  getNpcDifficulty = (): NpcDifficulty => {
    if (this.computerPlayer) return this.computerPlayer.difficulty;
    else return 'Normal'
  }

  setNpcDifficulty = (difficulty: NpcDifficulty): void => {
    if (this.computerPlayer) {
      this.computerPlayer.setNpcDifficulty(difficulty)
    }
  }

  cycleThroughDifficulties = (): void => {
    if (this.computerPlayer) {
      this.computerPlayer.cycleThroughDifficulties();
      this.forceUpdate();
    }
  }

  getRandomPlacementCell = (player: Player, rowIndex?: number): Cell | null => {
    const cell = this.gameBoard.getRandomPlacementCell(player, rowIndex);
    return cell;
  }

  npcGetFutureSpellCollisionRow = (): number => {
    return this.gameBoard.npcGetFutureSpellCollisionRow();
  }

  updatePlacedSpells = async () => {
    // uses a generator/iterator
    await this.placedSpells.updateSpells(this.gameBoard, this.gameLog, this.forceUpdate);
  }

  getGameSymbolIcon = (): string => {
    if (this.humanPlayer) {
      const gameSymbol = this.humanPlayer.getGameSymbol();
      if (gameSymbol) {
        const SpellClass = GameSymbol.SPELL_LOOKUP.get(gameSymbol.symbolName)
        return SpellClass ? `spell-icons/${SpellClass.name}Icon_mockup.png` : '';
      }
    }
    return '';
  }

  beginDrawing = (): void => {
    this.spellCanvas.setIsShowCanvas(true);
    this.spellCanvas.setIsDrawing(true);
  }

  endDrawing = (): void => {
    this.spellCanvas.setIsShowCanvas(false);
    this.spellCanvas.setIsDrawing(false);
  }

  setGameBoardRef = (gameBoardRef: RefObject<HTMLDivElement | null>): void => {
    this.gameBoard.setGameBoardRef(gameBoardRef);
  }

  setGameWrapperRef = (gameWrapperRef: RefObject<HTMLDivElement | null>): void => {
    this.gameWrapperRef = gameWrapperRef;
  }

  addRawPoint(x: number, y: number): void {
    /*
    
      continously check if mouse is over gameboard
      if mouse is over gameboard:
        store cell index
        mark rawPoint index (start of points for that cell)

        if cell index is different than stored:
          store cell index
          mark rawPoint index (start of points for that cell)

    */

    const nextPoint = { x, y };
    let lastPoint = undefined;
    const rawPoints = this.spellCanvas.getRawPoints();

    if (rawPoints.length > 1) {
      lastPoint = rawPoints[rawPoints.length - 1];
    }

    if (lastPoint) {
      const numMorePoints = 10;
      const vec: Point = { x: nextPoint.x - lastPoint.x, y: nextPoint.y - lastPoint.y };
      // generate more points for board interaction...
      for (let i = 0; i < numMorePoints; i++) {
        const x = lastPoint.x + i * vec.x / numMorePoints;
        const y = lastPoint.y + i * vec.y / numMorePoints
        this.spellCanvas.addRawPoint(x, y);
        const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(x, y);
        if (cellIndex) this.spellCanvas.updateCellPointsIfDifferent(cellIndex);
      }
    }
    this.spellCanvas.addRawPoint(x, y);

  }

  getIsDrawing = (): boolean => {
    return this.spellCanvas.getIsDrawing();
  }


  getPlayerRawPoints(): Array<Point> {
    return this.spellCanvas.getRawPoints();
  }

  getIsClickDisabled = (): boolean => {
    return this.isClickDisabled;
  }

  setIsClickDisabled = (isClickDisabled: boolean): void => {
    this.isClickDisabled = isClickDisabled;
  }

  getIsHoverDisabled = (): boolean => {
    return this.isHoverDisabled;
  }

  setIsHoverDisabled = (isHoverDisabled: boolean): void => {
    this.isHoverDisabled = isHoverDisabled;
  }

  getHoveredPlacedSpell = (): Spell | null => {
    return this.gameBoard.hoveredCell?.getSpell() || null;
  }

  getHoveredSpellBookSpell = (): SpellConstructor | null => {
    return this.gameLog.getHoveredSpellBookSpell();
  }

  setHoveredSpellBookSpell = (hoveredSpell: SpellConstructor | null): void => {
    this.gameLog.setHoveredSpellBookSpell(hoveredSpell);
  }

  setHoveredGameboardCell = (cell: Cell | null): void => {
    this.gameBoard.hoverCell(cell);
  }

  getIsPlacing = (): boolean => {
    return this.humanPlayer?.gameSymbol != null;
  }

  cancelPlacingSymbol = (player?: Player): void => {
    const p = player ? player : this.humanPlayer;
    p?.setGameSymbol(null);
  }

  placeSpellAt = (inferenceString: InferenceString, cellIndex: CellIndex, player?: Player): void => {
    const p = player ? player : this.humanPlayer;
    if (p) {
      this.instantiateGameSymbolFromInferenceString(inferenceString, p);
      const cell = this.getCellAt(cellIndex);
      if (cell) {
        if (this.isCanPlaceGameSymbolOn(cell, p)) {
          this.placeSpellOnBoard(cell, p);
        }
      }
      // clear gameSymbol regardless...
      // this.cancelPlacingSymbol(p);
    }
  }

  runInference = async (mouseCoords?: Point): Promise<void> => {

    // Single click on cell creates Ether
    if (mouseCoords && this.spellCanvas.getNumPoints() == 0) {
      const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(mouseCoords.x, mouseCoords.y);
      if (cellIndex) {
        this.placeSpellAt('circle', cellIndex);
        if (this.humanPlayer) {
          if (this.humanPlayer.getFocus() < 1) {
            this.setIsDoneWithTurn(true, this.humanPlayer);
          }
        }
      }
    }

    if (this.spellCanvas.getNumPoints() == 0) return;

    const rawPoints = this.spellCanvas.getRawPoints();
    const rawPointsSubsets = this.spellCanvas.getRawPointSubsets();
    this.spellCanvas.clearDrawing();

    const results: Array<[CellIndex, any]> = [];

    try {
      // Process each subset one by one to avoid concurrent ONNX sessions
      for (const { cellIndex, rawPointsSubset } of rawPointsSubsets) {
        const result = await this.model.runInference(rawPointsSubset);
        results.push([cellIndex, result]);
      }
    } catch (_) {
      // Matches your original catch fallback block structure
      // Adjust types if your layout expects specific fallback objects
      results.push([{ i: -1, j: -1 }, '']);
    }

    // Run the final inference on the full dataset
    const result = await this.model.runInference(rawPoints);

    if (!GameSymbol.FIZZLE_INFERENCES.includes(result)) {
      // Place single spell on multiple cells
      results.forEach(([cellIndex]) => this.placeSpellAt(result, cellIndex))
    }
    // else {
    //   // Place different(?) spells on multiple cells... TEST...
    //   results.filter(([_, inferenceString]) => !GameSymbol.FIZZLE_INFERENCES.includes(inferenceString)).forEach(([_, inferenceString]) =>
    //     results.forEach(([cellIndex]) => this.placeSpellAt(inferenceString, cellIndex)))
    // }

    if (this.humanPlayer) {
      if (this.humanPlayer.getFocus() < 1) {
        this.setIsDoneWithTurn(true, this.humanPlayer);
      }
    }
    this.forceUpdate();
  }

  instantiateGameSymbolFromInferenceString = (inferenceString: InferenceString, player?: Player): void => {
    const p = player ? player : this.humanPlayer;
    if (p) {
      const gameSymbol = proxy(new GameSymbol(inferenceString, p));
      p.setGameSymbol(gameSymbol);
    }
  }

  /*
   
    TO-DO: Consider having a turn be a single placed spell move, not all placed spells move
   
    Every turn keep a curr index into placed spells and it goes around "round rob" (?)
   
   
    TO-DO: Consider undo last move(?)
   
    TO-DO: ensure that endTurn is not being called on a Fizzle inference...

    TO-DO: consider having left over focus from a turn become health points. example: 2 left over focus = +2 health at start of next turn.
   
  */
  endTurn = async (): Promise<void> => {
    if (!this.getIsGameBoardDisabled()) {

      this.resetNpcMove();

      this.checkIfIsGameOver();
      if (this.gameOver) {
        this.forceUpdate();
        return;
      }

      this.setHoveredGameboardCell(null);
      this.resetClock();
      this.pauseClock();
      this.incrementMinuteAngleAcc();
      this.forceUpdate();
      this.disableGameBoard();
      await this.updatePlacedSpells();
      this.regenFocusForPlayers();
      this.enableGameBoard();

      this.checkIfIsGameOver();
      if (this.gameOver) {
        this.forceUpdate();
        return;
      }

      // TESTING - - - - -
      // this.resetNpcMove();
      if (this.computerPlayer && this.humanPlayer) {
        this.setIsDoneWithTurn(false, this.computerPlayer);
        this.setIsDoneWithTurn(false, this.humanPlayer);
        this.computerPlayer.setGameSymbol(null);
        this.humanPlayer.setGameSymbol(null);
        this.computerPlayer.resetNumRemainingMovesPerTurn(); // resets NPC moves to between 2-3
        setTimeout(() => this.doNpcMove(), 1000);
      }
      // TESTING - - - - -

      if (!this.isSpellBookOpen) this.unpauseClock();
      this.forceUpdate();
    }
  }

  getCellWidth = (): number | null => {
    const cellWidth = this.gameBoard.getCellWidth()
    return cellWidth;
  }

  getGameWrapperRefDims = (): DivRefDimensions => {
    return this.gameWrapperRef?.current?.getBoundingClientRect() || { width: 0, height: 0, top: 0, left: 0 };
  }

  getBoardRefDimensions = (): DivRefDimensions => {
    return this.gameBoard.getBoardRefDimensions() || { width: 0, height: 0, top: 0, left: 0 };
  }

  getIsHumanPlayerDoneWithTurn = (): boolean => {
    if (this.humanPlayer) {
      return this.humanPlayer.getIsDoneWithTurn();
    }
    return true; // default to true...
  }

  getIsComputerPlayerDoneWithTurn = (): boolean => {
    if (this.computerPlayer) {
      return this.computerPlayer.getIsDoneWithTurn();
    }
    return false; // default to false...
  }

  setIsDoneWithTurn = (isDoneWithTurn: boolean, player: Player): void => {
    player.setIsDoneWithTurn(isDoneWithTurn);
    // if (isDoneWithTurn) {
    //   const opponent = player == this.humanPlayer ? this.computerPlayer : this.humanPlayer;
    //   if (!opponent) return;
    //   const isOpponentDoneWithTurn = opponent.getIsDoneWithTurn();
    //   if (isOpponentDoneWithTurn) setTimeout(() => this.endTurn(), 1500);
    // }
  }

  // TO-DO: have end turn button enabled while NPC is drawing. if clicked, cancel the drawing and immediately place NPC symbols on board
  doNpcMove = (): void => {
    if (!this.computerPlayer) return;

    if (!this.computerPlayer.getFocus() || this.computerPlayer.getIsDead()) {
      this.computerPlayer.clearNumRemaningMovesPerTurn();
      return;
    }

    const npcMoveData = this.computerPlayer.getRandomMoveForTesting();
    const { inferenceString, translationNorm, scale, rotation } = npcMoveData;

    const cellWidth = this.gameBoard.getCellWidth()
    if (!cellWidth) return;

    const normalizedPoints = HARDCODED_SYMBOLS.get(inferenceString);
    if (!normalizedPoints) return;

    // Convert degrees to radians for Math.cos and Math.sin
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Center of rotation for normalized space
    const cx = 0.5;
    const cy = 0.5;

    const { left, top, width, height } = this.gameBoard.getBoardRefDimensions() || { left: 0, top: 0, width: 0, height: 0 };
    if (!width) return;


    const startOfNpcPlacementCellsX = left + (GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS) * cellWidth;
    const startOfNpcPlacementCellsY = top;
    const widthOfPlacementCells = GameBoard.NUM_PLACEMENT_CELLS * cellWidth;


    let lastPoint: Point | null = null;
    const rawPoints: Array<Point> = []
    normalizedPoints.forEach(({ x, y }) => {
      // Step 1: Translate point so that the center (0.5, 0.5) is at origin (0, 0)
      const tx = x - cx;
      const ty = y - cy;

      // Step 2: Apply 2D Rotation Matrix
      const rotatedX = tx * cos - ty * sin;
      const rotatedY = tx * sin + ty * cos;

      // Step 3: Translate back from origin to center space
      const finalNormX = rotatedX + cx;
      const finalNormY = rotatedY + cy;

      const newPoint = {
        x: startOfNpcPlacementCellsX + widthOfPlacementCells * translationNorm.x + finalNormX * scale.x * cellWidth,
        y: startOfNpcPlacementCellsY + height * translationNorm.y + finalNormY * scale.y * cellWidth
      }
      if (lastPoint) {
        const numMorePoints = 200;
        const vec: Point = { x: newPoint.x - lastPoint.x, y: newPoint.y - lastPoint.y };
        // generate more points for board interaction...
        for (let i = 0; i < numMorePoints; i++) {
          rawPoints.push(
            {
              x: lastPoint.x + i * vec.x / numMorePoints,
              y: lastPoint.y + i * vec.y / numMorePoints
            }
          )
        }
      }
      rawPoints.push(newPoint);
      lastPoint = newPoint
    });

    const storedSpell = () => {
      rawPoints.forEach(point => {
        if (this.computerPlayer) {
          const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(point.x, point.y);
          if (cellIndex) {
            this.placeSpellAt(inferenceString, cellIndex, this.computerPlayer);
          }
        }
      });
      if (!this.computerPlayer) return;
      this.cancelPlacingSymbol(this.computerPlayer);
      // this.computerPlayer.setNpcDrawingPoints([]);
      this.computerPlayer.decrementNumRemaningMovesPerTurn();
      if (this.computerPlayer.getNumRemainingMovesPerTurn() > 0 && this.computerPlayer.getFocus() > 0) {
        //  this.doNpcMove();
        setTimeout(() => this.doNpcMove(), Math.random() * 1000);
      } else {
        console.log({ npcMoveData })
        this.setIsDoneWithTurn(true, this.computerPlayer);
        this.forceUpdate();
      }
      // if (this.computerPlayer.getNumRemainingMovesPerTurn() < 1 || !this.computerPlayer.getFocus()) {
      //   this.setIsDoneWithTurn(true, this.computerPlayer);
      // }
    }

    this.computerPlayer.setNpcDrawingPoints(rawPoints);
    // set to get arm-wand movements while drawing
    this.computerPlayer.setGameSymbol(new GameSymbol(inferenceString, this.computerPlayer))
    this.npcMoveData.push({ ...npcMoveData, storedSpell, speed: 1.3 / scale.x });
    this.forceUpdate();
  }

  getNPCMoveData = (): Array<NPCMoveData> => {
    return this.npcMoveData;
  }

  getNPCMoveDatum = (i: number): NPCMoveData | null => {
    return this.npcMoveData[i] || null
  }

  getNpcMousePos = (): Point => {
    if (this.computerPlayer) {
      return this.computerPlayer.getNpcMousePos();
    }
    return { x: 0, y: 0 };
  }

  setNpcMousePos = (npcMousePos: Point) => {
    if (this.computerPlayer) {
      this.computerPlayer.setNpcMousePos(npcMousePos);
    }
  }

  getNpcDrawingPoints = (): Array<Point> | null => {
    if (this.computerPlayer)
      return this.computerPlayer.getNpcDrawingPoints();
    return null
  }

  resetNpcMove = () => {
    this.npcMoveData = proxy([]);
  }

  setIsSpellBookOpen = (isSpellBookOpen: boolean): void => {
    this.isSpellBookOpen = isSpellBookOpen;
  }

  getGameOver = (): GameOver | null => {
    return this.gameOver;
  }

  setGameOver = (status: GameOver): void => {
    this.gameOver = status;
  }

  // CHECK FOR GAME OVER CONDITION...
  checkIfIsGameOver = (): void => {
    // - GAMEOVER CONDITION #1: One or both players are dead. <PLAYER DEATH>
    const deadPlayers = this.players.filter(p => p.getHealth() <= 0);
    switch (deadPlayers.length) {
      case 2:
        this.gameOver = GameOverStatus.BothDead;
        break;
      case 1:
        this.gameOver = deadPlayers[0] instanceof NPCPlayer ? GameOverStatus.PlayerWon : GameOverStatus.NpcWon
        break;
    }

    // - GAMEOVER CONDITION #2: Time limit of match is reached (6AM on clock) <PLAYER EXPULSION>
    if (!deadPlayers.length) {

      const MINUTES_HAND = 12;
      const HOURS_HAND = 6;
      const SUNRISE = MINUTES_HAND * HOURS_HAND;

      const currTotalMinutes = this.getMinuteAngleAcc() / this.gameClock.getMinuteIncrAngle();

      const isPastSunrise = currTotalMinutes > SUNRISE; // TO-DO: test this...

      if (isPastSunrise) {
        this.gameOver = GameOverStatus.TimesUp
      }
    }

    if (this.gameOver) { // TESTING
      this.disableGameBoard();
      // this.appendToLog(`${GameOverStatus.toString(), this.gameOver}`, '#a78bfa');
      // this.resetMinuteAngleAcc();
      this.resetGame();
    }
  }
}