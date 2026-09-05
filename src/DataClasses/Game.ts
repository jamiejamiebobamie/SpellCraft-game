// Game.ts
import { GameBoard } from './GameBoard/GameBoard';
import { Cell } from './GameBoard/Cell';
import { GameLog, GameLogEntry } from './GameLog';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { GameState, GameContext, PlayerDrawSpell, NPCDrawSpell } from './GameStates';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol, NpcPlaceSpellOnBoardFunc } from './PlacedSpells/GameSymbol';
import { NPCPlayer, Player } from './Player/Player';
import { CellIndex, InferenceString } from './types';
import { proxy } from 'valtio';

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
  currentGameState!: GameState;
  model!: Model;
  spellCanvas!: SpellCanvas;
  gameSymbol!: GameSymbol | null;
  clockSpeed: number = .055;


  // Game Loop Properties
  players!: [Player, Player];
  gameTurn: number = 0;
  gameContext!: GameContext;
  isClickDisabled: boolean = false;
  isHoverDisabled: boolean = false;
  hoveredSpell: Spell | null = null;
  gameOver: GameOver | null = null;

  constructor() {
    this.init();
  }

  /**
   * Universal initializer. Handles both the fresh startup and 
   * a mid-game full state wipe/reset.
   */
  init = (): void => {
    // 1. Create a fresh instance of the Logger
    this.gameLog = new GameLog();
    this.clearLog();
    this.appendToLog('Initializing new mystical duel...', '#a78bfa');

    // 2. Spawn fresh data layers for both players
    const humanPlayer = proxy(new Player(1, '#3b82f6', './player_avatars/PlayerAvatar.png', this.checkIfIsGameOver)); // Heading right
    const computerPlayer = proxy(new NPCPlayer(-1, '#ef4444', './player_avatars/PlayerAvatar_NPC.png', this.checkIfIsGameOver, this.clockSpeed * 50000, this.npcPlaceSpellOnBoard)); // this.clockSpeed = .05, 0.05 * 100000 = 5000 milliseconds
    this.players = [humanPlayer, computerPlayer];

    // 3. Initialize the static bounding cell board layout
    this.gameBoard = new GameBoard(humanPlayer, computerPlayer);

    computerPlayer.setGameBoard(this.gameBoard);

    computerPlayer.setAppendToLogMethod(this.appendToLog);

    // 4. Pass the fully initialized cell grid back to the AI context map
    // computerPlayer.gameBoardRef = this.gameBoard.cells;

    // 5. Reset projectile tracking layer
    this.placedSpells = new PlacedSpells();
    this.gameTurn = 0;

    this.model = new Model();
    this.model.init();

    this.spellCanvas = new SpellCanvas();
    this.gameSymbol = null;

    // 6. Establish the global state context pointer map
    this.gameContext = {
      activePlayer: humanPlayer,
      opposingPlayer: computerPlayer,
      gameBoard: this.gameBoard,
      gameLog: this.gameLog,
      currentTurnCount: this.gameTurn,
      changeState: (newState: GameState) => {
        this.currentGameState = newState;
        // Boot up the entry sequence loop for the newly assigned state phase
        this.currentGameState.runStateLogic(this.gameTurn);
      }
    };

    // 7. Fire up the start of the human player turn phase machine
    humanPlayer.setIsTurn(true, this.gameTurn);
    this.gameContext.changeState(new PlayerDrawSpell(this.gameContext));

    computerPlayer.startCastingLoop();
  };

  resetGame = (): void => {
    this.clearLog();
    this.appendToLog(`${GameOverStatus.toString(), this.gameOver}`, '#a78bfa');
    this.appendToLog('Initializing new mystical duel...', '#a78bfa');
    this.players.forEach(p => p.reset());
    this.placedSpells.reset();
    this.gameBoard.reset();
    this.gameTurn = 0;
    this.gameSymbol = null;
    this.hoveredSpell = null;
    this.gameOver = null;
    this.isClickDisabled = false;
    this.isHoverDisabled = false;
  };

  // --- GameLog Delegation Wrappers ---

  clearLog = (): void => {
    this.gameLog.clearAllEntries();
  };

  appendToLog = (text: string, color: string = '#FFFFFF'): void => {
    this.gameLog.appendEntry(text, color);
  };

  // --- GameState Input Delegation Wrappers ---

  doRightClick = (): void => {
    this.currentGameState.doRightClick();
  };

  doLeftClick = (): void => {
    this.currentGameState.doLeftClick();
  };

  doEsc = (): void => {
    this.currentGameState.doEsc();
  };

  // --- Action Dispatcher Utilities ---

  /**
   * Safely modifies player parameters across complex data objects without losing context binds.
   * Leverages explicit action keys rather than risky dynamic method invocation strings.
   */
  updatePlayer = (
    player: Player,
    action: 'decrementHealth' | 'decrementFocus' | 'setIsTurn' | 'addFizzle',
    param: number | boolean
  ): void => {
    switch (action) {
      case 'decrementHealth':
        if (typeof param === 'number') {
          player.decrementHealth(param);
          this.checkIfIsGameOver();
        }
        break;
      case 'decrementFocus':
        if (typeof param === 'number') player.decrementFocus(param);
        break;
      case 'setIsTurn':
        if (typeof param === 'boolean') player.setIsTurn(param, this.gameTurn);
        break;
      case 'addFizzle':
        if (typeof param === 'boolean') player.addFizzle(this.gameTurn);
        break;
    }
  };

  getIsGameBoardDisabled = (): boolean => {
    return this.gameBoard.getIsClickDisabled();
  }

  enableGameBoard = (): void => {
    this.gameBoard.enableBoard();
  }

  disableGameBoard = (): void => {
    this.gameBoard.disableBoard();
  }

  updatePlayerTurn = () => {

    // Swap current turn pointers
    const nextPlayer = this.gameContext.opposingPlayer;
    const previousPlayer = this.gameContext.activePlayer;

    this.gameContext.activePlayer = nextPlayer;
    this.gameContext.opposingPlayer = previousPlayer;
    this.gameTurn += 1

    previousPlayer.setIsTurn(false, this.gameTurn);
    nextPlayer.setIsTurn(true, this.gameTurn);

    // this.gameTurn % 2 == 0 && 
    // this.regenFocus();
  }

  getActivePlayer = (): Player => {
    return this.gameContext.activePlayer;
  }

  isCanPlaceGameSymbolOn = (cell: Cell): boolean => {
    const isHumanActivePlayer = !(this.gameContext.activePlayer instanceof NPCPlayer)
    const isPlacingGameSymbol = !!this.gameSymbol;
    return isPlacingGameSymbol && isHumanActivePlayer && cell.getIsFree() && cell.getIsPlaceCell(this.players[0]);
  }

  getLogEntries = (): Array<GameLogEntry> => {
    return this.gameLog.logEntries;
  };

  regenFocus = () => {
    this.players.forEach(p => p.decrementFocus(-2));
  }

  placeSpellOnBoard = async (cell: Cell): Promise<void> => {
    if (this.isCanPlaceGameSymbolOn(cell)) {
      // this.placedSpells.removeInvalidSpells();
      const spell = this.gameSymbol?.instantiateSpell(this.gameTurn);
      this.gameSymbol = null;
      if (spell instanceof Spell) {
        // this.appendToLog(`You have cast a ${spell.getSpellName()} spell!`, this.players[0].getColor());
        spell.setCellIndex(cell.getCellIndex());
        this.placedSpells.addSpell(spell);
        this.gameBoard.setSpellAt(spell, cell);
        // this.setIsClickDisabled(true);
        // await this.placedSpells.updateSpell(this.gameBoard, this.gameLog, spell);
        spell.setIsPlaced(true);
        // this.setIsClickDisabled(false);
      }
    }
  }

  npcPlaceSpellOnBoard: NpcPlaceSpellOnBoardFunc = async (gameSymbol: GameSymbol, cellRowIndex?: number): Promise<void> => {
    const cell = this.gameBoard.getFreeNpcPlacementCell(this.players[1], cellRowIndex);
    // this.appendToLog(`${gameSymbol.symbolName} ${cell.getCellIndex().i} ${cell.getCellIndex().j} ${cellRowIndex} isFree ${cell.getIsFree() && cell.getIsPlaceCell(this.players[1])} isPlace ${cell.getIsFree() && cell.getIsPlaceCell(this.players[1])}`, 'black');
    if (cell.getIsFree() && cell.getIsPlaceCell(this.players[1])) {
      const spell = gameSymbol.instantiateSpell(this.gameTurn);
      if (spell instanceof Spell) {
        // this.appendToLog(`Your opponents has cast a ${spell.getSpellName()} spell!`, this.players[1].getColor());
        spell.setCellIndex(cell.getCellIndex());
        this.placedSpells.addSpell(spell);
        this.gameBoard.setSpellAt(spell, cell);
        // this.setIsClickDisabled(true);
        // await this.placedSpells.updateSpell(this.gameBoard, this.gameLog, spell);
        spell.setIsPlaced(true);
        // this.setIsClickDisabled(false);
      }
    }
  }

  getIsTurn = (playerDirection: number): boolean => {
    return !this.isClickDisabled && this.getActivePlayer()?.getDirection() == playerDirection
  }

  getClockSpeed = (): number => {
    return this.getIsGameBoardDisabled() ? 0 : this.clockSpeed;
  }

  updatePlacedSpells = async () => {
    this.disableGameBoard();
    // uses a generator/iterator
    await this.placedSpells.updateSpells(this.gameBoard, this.gameLog);
    this.enableGameBoard();
  }

  getGameSymbolIcon = (): string => {
    if (!this.gameSymbol) return ''
    const spellName = GameSymbol.SPELL_NAME_LOOKUP.get(this.gameSymbol.symbolName)
    return spellName ? `spell-icons/${spellName}Icon_mockup.png` : '';
  }

  getIsHumanPlayerTurn = () => {
    return !(this.gameContext.activePlayer instanceof NPCPlayer);
  }

  beginDrawing = (): void => {
    this.spellCanvas.setIsShowCanvas(true);
    this.spellCanvas.setIsDrawing(true);
  }

  endDrawing = (): void => {
    this.spellCanvas.setIsShowCanvas(false);
    this.spellCanvas.setIsDrawing(false);
  }

  getIsDrawing = (): boolean => {
    return this.spellCanvas.getIsDrawing();
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

  getHoveredSpell = (): Spell | null => {
    return this.gameBoard.hoveredCell?.getSpell() || null;
  }

  // getHoveredCellPath = (): Array<CellIndex> => {
  //   return this.gameBoard.getHoveredCellPath();
  // }

  setHoveredGameboardCell = (cell: Cell | null): void => {
    // console.log({ i })
    this.gameBoard.hoverCell(cell);
  }

  getIsPlacing = (): boolean => {
    return this.gameSymbol != null;
  }

  cancelPlacingSymbol = (): void => {
    this.gameSymbol = null;
  }

  // TO-DO: fix this...
  hideGameBoard = (): void => {
    this.gameBoard.disableBoard();
  }

  runInference = async (): Promise<void> => {
    if (this.spellCanvas.getNumPoints() == 0) return;
    const rawPoints = this.spellCanvas.getRawPoints();
    this.spellCanvas.clearDrawing();
    const result = await this.model.runInference(rawPoints);
    this.instantiateSpellFromInferenceString(result);
  }

  instantiateSpellFromInferenceString = (inferenceString: InferenceString): void => {
    if (GameSymbol.FIZZLE_INFERENCES.includes(inferenceString)) {
      if (this.players[0].getFizzleCount() == 3) {
        this.appendToLog(`The spellcasting gods recoil at your malfeasance. BACKLASH!`, 'purple');
      } else {
        this.appendToLog(`You drew an unknown spell! And gained a Fizzle.`, 'purple');
      }
      this.gameSymbol = new GameSymbol(inferenceString, this.players[0]);
      this.gameSymbol.instantiateSpell(this.gameTurn);
    } else {
      this.gameSymbol = new GameSymbol(inferenceString, this.players[0]);
    }
  }


  /**
   * Steps the turn cycle forward. Called by the Finite State Machine 
   * once the full round-trip execution phase resolves.
   */
  incrementGameTurn = (): void => {
    this.gameTurn += 1;
    this.players.forEach(p => p.updateFizzles(this.gameTurn))
  };

  getCurrentGameTurn = (): number => {
    return this.gameTurn;
  };

  setGameOver = (status: GameOver): void => {
    this.gameOver = status;
  }

  //CHECK FOR GAME OVER CONDITION...
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
      const isSunrise = this.gameTurn > SUNRISE;

      if (isSunrise) {
        this.gameOver = GameOverStatus.TimesUp
      }
    }

    if (this.gameOver) this.resetGame(); // TESTING
  }
}