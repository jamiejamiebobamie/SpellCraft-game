// Game.ts
import { GameBoard } from './GameBoard/GameBoard';
import { Cell } from './GameBoard/Cell';
import { GameLog, GameLogEntry } from './GameLog';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol } from './PlacedSpells/GameSymbol';
import { Player } from './Player/Player';
import { NPCPlayer } from './Player/NpcPlayer';
import { KeyAction, useKeyPress } from '../UI_Components/UI_Elements/UseKeyPress'
import { InferenceString, CellIndex, NpcDifficulty } from './types';
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
  model!: Model;
  spellCanvas!: SpellCanvas;

  /*
    360 for callback to trigger every hour
      30 to trigger every 1/12th hour.
  */
  static readonly CLOCK_INCREMENT_ANGLE: number = 30;
  minuteAngleAcc: number = 0; // TO-DO: consider GameClock class

  keyActions: Array<KeyAction> = []; // TO-DO: consider KeyBindings class

  players!: [Player, Player];
  humanPlayer: Player | null = null;
  computerPlayer: NPCPlayer | null = null;

  isClickDisabled: boolean = false; // TO-DO: reduce disabled variables... to 'isGameBoardDisabled'
  isHoverDisabled: boolean = false;
  hoveredSpell: Spell | null = null;
  gameOver: GameOver | null = null;

  constructor() {
    this.init();
  }

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

    setTimeout(() => {
      this.computerPlayer?.doNextNpcMove(); // TESTING
      this.computerPlayer?.doNextNpcMove(); // TESTING
      this.computerPlayer?.doNextNpcMove(); // TESTING
      this.computerPlayer?.doNextNpcMove(); // TESTING
    }, 1000);

    this.setupGameplayKeyBindings();
  };

  resetGame = (): void => {
    this.placedSpells.reset();
    this.gameBoard.reset();
    this.players.forEach(p => p.reset());
    this.minuteAngleAcc = 0;
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
      action: forceUpdate => forceUpdate && this.endTurn(forceUpdate)
    });

    // CYCLE through NPC Difficulties: 'Normal' -> 'Hard' -> 'Brutal' -> 'Normal'
    keyActions.push({
      keycodes: ['ShiftLeft', 'ShiftRight'],
      action: () => this.cycleThroughDifficulties()
    });

    this.keyActions = proxy(keyActions);
  }

  useGameplayKeyBindings = (forceUpdate: () => void): void => {
    useKeyPress({ keyActions: this.keyActions, isDisabled: false, forceUpdate });
  }

  // --- Action Dispatcher Utilities ---

  getIsGameBoardDisabled = (): boolean => {
    return this.gameBoard.getIsHoverDisabled();
  }

  enableGameBoard = (): void => {
    this.gameBoard.enableBoard();
  }

  disableGameBoard = (): void => {
    this.gameBoard.disableBoard();
  }

  getMinuteAngleAcc = (): number => {
    return this.minuteAngleAcc;
  }

  incrementMinuteAngleAcc = (incr: number): void => {
    this.minuteAngleAcc += incr;
  }

  resetMinuteAngleAcc = (): void => {
    this.minuteAngleAcc = 0;
  }

  isCanPlaceGameSymbolOn = (cell: Cell, player?: Player): boolean => {
    const p = player ? player : this.humanPlayer;
    return !!p && !!p.getGameSymbol() && !this.getIsGameBoardDisabled() && cell.getIsFree() && cell.getIsPlaceCell(p);
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
      return this.humanPlayer?.getFocus() > 0;
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
    }
  }

  getRandomPlacementCell = (player: Player, rowIndex?: number): Cell | null => {
    const cell = this.gameBoard.getRandomPlacementCell(player, rowIndex);
    return cell;
  }

  npcGetFutureSpellCollisionRow = (): number => {
    return this.gameBoard.npcGetFutureSpellCollisionRow();
  }

  updatePlacedSpells = async (forceUpdate: Function) => {
    // uses a generator/iterator
    await this.placedSpells.updateSpells(this.gameBoard, this.gameLog, forceUpdate);
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

  setHoveredGameboardCell = (cell: Cell | null): void => {
    this.gameBoard.hoverCell(cell);
  }

  getIsPlacing = (): boolean => {
    return this.humanPlayer?.gameSymbol != null;
  }

  cancelPlacingSymbol = (): void => {
    this.humanPlayer?.setGameSymbol(null);
  }

  runInference = async (): Promise<void> => {
    if (this.spellCanvas.getNumPoints() == 0) return;
    const rawPoints = this.spellCanvas.getRawPoints();
    this.spellCanvas.clearDrawing();
    const result = await this.model.runInference(rawPoints);
    this.instantiateGameSymbolFromInferenceString(result);
  }

  instantiateGameSymbolFromInferenceString = (inferenceString: InferenceString, player?: Player): void => {
    const p = player ? player : this.humanPlayer;
    if (p) {
      const gameSymbol = proxy(new GameSymbol(inferenceString, p));
      p.setGameSymbol(gameSymbol);
    }
  }

  endTurn = async (forceUpdate: () => void): Promise<void> => {
    if (!this.getIsGameBoardDisabled()) {
      this.incrementMinuteAngleAcc(Game.CLOCK_INCREMENT_ANGLE);
      forceUpdate();
      this.disableGameBoard();
      await this.updatePlacedSpells(forceUpdate);
      this.checkIfIsGameOver();
      this.regenFocusForPlayers();
      this.enableGameBoard();
      // TESTING - - - - -
      this.computerPlayer?.doNextNpcMove();
      this.computerPlayer?.doNextNpcMove();
      this.computerPlayer?.doNextNpcMove();
      this.computerPlayer?.doNextNpcMove();
      // TESTING - - - - -
      forceUpdate();
    }
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

      const currTotalMinutes = this.minuteAngleAcc / Game.CLOCK_INCREMENT_ANGLE;

      const isPastSunrise = currTotalMinutes > SUNRISE; // TO-DO: test this...

      if (isPastSunrise) {
        this.gameOver = GameOverStatus.TimesUp
      }
    }

    if (this.gameOver) { // TESTING
      this.disableGameBoard();
      this.appendToLog(`${GameOverStatus.toString(), this.gameOver}`, '#a78bfa');
      this.resetMinuteAngleAcc();
      setTimeout(() => {
        this.resetGame();
        this.computerPlayer?.doNextNpcMove();
        this.computerPlayer?.doNextNpcMove();
        this.computerPlayer?.doNextNpcMove();
        this.computerPlayer?.doNextNpcMove();
      }, 4500);
    }
  }
}