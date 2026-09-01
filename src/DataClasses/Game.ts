// Game.ts
import { GameBoard } from './GameBoard/GameBoard';
import { Cell } from './GameBoard/Cell';
import { GameLog } from './GameLog';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { GameState, GameContext, PlayerDrawSpell, NPCDrawSpell } from './GameStates';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol } from './PlacedSpells/GameSymbol';
import {
  NPCPlayer,
  Player
  // , NPCPlayer
} from './Player/Player';

export class Game {
  // Core Subsystem Managers
  gameBoard!: GameBoard;
  gameLog!: GameLog;
  placedSpells!: PlacedSpells;
  currentGameState!: GameState;
  model!: Model;
  spellCanvas!: SpellCanvas;
  gameSymbol!: GameSymbol | null;

  // Game Loop Properties
  players!: [Player, Player];
  gameTurn: number = 0;
  gameContext!: GameContext;

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
    const humanPlayer = new Player(1, '#3b82f6'); // Heading right
    const computerPlayer = new Player(-1, '#ef4444'); //new NPCPlayer(-1, '#ef4444', []); // Heading left (grid reference mapped below)
    this.players = [humanPlayer, computerPlayer];

    // 3. Initialize the static bounding cell board layout
    this.gameBoard = new GameBoard(humanPlayer, computerPlayer);

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
  };

  resetGame = (): void => {
    this.init(); // Reuse the baseline path cleanly
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
        if (typeof param === 'number') player.decrementHealth(param);
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

  updatePlayerTurn = () => {

    // Swap current turn pointers
    const nextPlayer = this.gameContext.opposingPlayer;
    const previousPlayer = this.gameContext.activePlayer;

    this.gameContext.activePlayer = nextPlayer;
    this.gameContext.opposingPlayer = previousPlayer;
    this.gameTurn += 1

    previousPlayer.setIsTurn(false, this.gameTurn);
    nextPlayer.setIsTurn(true, this.gameTurn);

    this.gameTurn % 2 == 0 && this.regenFocus();
  }

  getActivePlayer = (): Player => {
    return this.gameContext.activePlayer;
  }

  isCanPlaceGameSymbolOn = (cell: Cell): boolean => {
    const isHumanActivePlayer = !(this.gameContext.activePlayer instanceof NPCPlayer)
    const isPlacingGameSymbol = !!this.gameSymbol;
    return isPlacingGameSymbol && isHumanActivePlayer && cell.getIsFree() && cell.getIsPlaceCell(this.gameContext.activePlayer);
  }

  regenFocus = () => {
    this.appendToLog('You and your opponent have regained some focus.', '#3b82f6');
    this.players.forEach(p => p.decrementFocus(-1));
  }

  placeSpellOnBoard = async (cell: Cell): Promise<void> => {
    if (this.isCanPlaceGameSymbolOn(cell)) {
      this.placedSpells.removeInvalidSpells();
      const spell = this.gameSymbol?.instantiateSpell(this.gameTurn);
      this.gameSymbol = null;

      if (spell instanceof Spell) {
        this.appendToLog(`You have cast a ${spell.getSpellName()} spell!`, '#3b82f6');
        spell.setCellIndex(cell.getCellIndex());
        this.placedSpells.addSpell(spell);
        this.gameBoard.setSpellAt(spell, cell);
        this.gameBoard.setIsClickDisabled(true);
        // uses a generator/iterator
        await this.placedSpells.updateSpell(this.gameBoard, this.gameLog, spell);
        spell.setIsPlaced(true);
        // this.placedSpells.removeInvalidSpells();
      }

      if (this.placedSpells.spells.length > 1) {
        // uses a generator/iterator
        await this.placedSpells.updateSpells(this.gameBoard, this.gameLog);
      }
      
      // TO-DO: allow for multiple spells drawn/placed per turn...
      // create "End Turn" button
      this.gameBoard.setIsClickDisabled(false);
      this.updatePlayerTurn();
      // this.hideGameBoard();
      this.spellCanvas.toggleShowCanvas();
    }
  }

  getGameSymbolIcon = (): string => {
    if (!this.gameSymbol) return ''
    const spellName = GameSymbol.SPELL_NAME_LOOKUP.get(this.gameSymbol.symbolName)
    return spellName ? `spell-icons/${spellName}Icon_mockup.png` : '';
  }

  hideGameBoard = (): void => {
    this.gameBoard.disableBoard();
  }

  enableGameBoard = (): void => {
    this.gameBoard.enableBoard();
  }

  runInference = async (): Promise<void> => {
    const rawPoints = this.spellCanvas.getRawPoints();
    const result = await this.model.runInference(rawPoints);

    if (GameSymbol.FIZZLE_INFERENCES.includes(result)) {
      this.appendToLog(`You drew an unknown spell! And gained a Fizzle`, 'black');
      this.appendToLog(`Don't get 3 Fizzles...`, 'black');
      this.gameSymbol = new GameSymbol(result, this.getActivePlayer()); //null;
      this.gameSymbol.instantiateSpell(this.gameTurn);
    } else {
      const spellName = GameSymbol.SPELL_NAME_LOOKUP.get(result);
      this.appendToLog(`You drew ${spellName}!`, 'black');
      this.gameSymbol = new GameSymbol(result, this.getActivePlayer()); //null;
    }
    this.spellCanvas.toggleShowCanvas();
    this.enableGameBoard();
  }


  /**
   * Steps the turn cycle forward. Called by the Finite State Machine 
   * once the full round-trip execution phase resolves.
   */
  incrementGameTurn = (): void => {
    this.gameTurn += 1;
    this.appendToLog(`--- Global Turn Wheel Advanced to Cycle [${this.gameTurn}] ---`, '#6b7280');
  };
}