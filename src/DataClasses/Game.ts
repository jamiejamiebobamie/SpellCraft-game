// Game.ts
import { RefObject } from 'react';
import { AudioHandler } from './AudioHandler';
import { GameBoard } from './GameBoard/GameBoard';
import { Players } from './Player/Players';
import { TooltipManager } from './TooltipManager/TooltipManager'
import { Cell } from './GameBoard/Cell';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol } from './PlacedSpells/GameSymbol';
import { GameClock } from './GameClock'
import { Player } from './Player/Player';
import { NPCPlayer } from './Player/NpcPlayer';
import { KeyAction, useKeyPress } from '../UI_Components/UseKeyPress'
import { InferenceString, CellIndex, NpcDifficulty, Point, NPCMoveData, DivRefDimensions, SoundEffectName, AudioType, GameOver, GameOverStatus } from './types';
import { Phlegm, Ether, GyreUp, GyreDown, Quicken } from './PlacedSpells/Spell';
import { proxy } from 'valtio';
import { INTRO_WALK_ANIM_TIME } from '../UI_Components/Player/CharacterParts';

/*

  Interface class for UI_Components.
  Initializes and delegates to subclasses for specific functionality.
  Wraps subclass functions enabling easy delegation.

*/
export class Game {

  // UI-SPECIFIC
  gameWrapperRef: RefObject<HTMLDivElement | null> | null = null;
  forceUpdate: () => void = () => { };
  backgroundSceneBrightness: number = 0.1;
  readonly LOW_BRIGHTNESS: number = 0.1;
  readonly HIGH_BRIGHTNESS: number = 0.4; // 0.5


  // GAME OVER
  gameOver: GameOver | null = null;

  // KEY BINDINGS
  keyActions: Array<KeyAction> = [];

  // CLASS DELEGATES
  audioHandler!: AudioHandler;
  gameBoard!: GameBoard;
  placedSpells!: PlacedSpells;
  model!: Model;
  spellCanvas!: SpellCanvas;
  gameClock!: GameClock;
  players!: Players;
  tooltipManager!: TooltipManager;

  constructor() {
    this.init();
  }

  // GAME - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  init = (): void => {
    this.players = proxy(new Players());
    this.players.init();
    const humanPlayer = this.players.getHumanPlayer(), npcPlayer = this.players.getNpcPlayer();
    if (humanPlayer && npcPlayer)
      this.gameBoard = proxy(new GameBoard(humanPlayer, npcPlayer as Player));
    this.placedSpells = proxy(new PlacedSpells());
    this.model = proxy(new Model());
    this.model.init();
    this.spellCanvas = proxy(new SpellCanvas());
    this.gameClock = proxy(new GameClock(this.endTurn));
    this.audioHandler = proxy(new AudioHandler());
    this.tooltipManager = proxy(new TooltipManager());
    this.setupGameplayKeyBindings();
  };
  resetGame = (): void => {
    this.placedSpells.reset();
    this.gameBoard.reset();
    this.players.reset();
    this.resetMinuteAngleAcc();
    this.gameOver = null;
    this.resetClock();
    this.enableGameBoard();
  };
  getGameOver = (): GameOver | null => this.gameOver;
  setGameOver = (status: GameOver): void => {
    this.gameOver = status;
  }
  checkIfIsGameOverAndReset = (): boolean => {
    // - GAMEOVER CONDITION #1: One or both players are dead. <PLAYER DEATH>
    const deadPlayers = this.players.getDeadPlayers();
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

      const isPastSunrise = currTotalMinutes > SUNRISE;

      if (isPastSunrise) {
        this.gameOver = GameOverStatus.TimesUp
      }
    }

    const isGameOver = this.gameOver !== null;
    if (this.gameOver) {
      this.disableGameBoard();
      setTimeout(() => { this.resetGame(); this.forceUpdate(); }, 3000); // TESTING
      this.forceUpdate();
    }
    return isGameOver;
  }

  endTurn = async (): Promise<void> => {
    if (!this.getIsGameBoardDisabled()) {
      this.resetNpcMove();
      let isGameOver = this.checkIfIsGameOverAndReset();
      if (isGameOver) {
        return;
      }
      this.audioHandler.startSoundEffect('clock-chime', this.audioHandler.getEffectsAudioLevel() / 10);
      this.resetClock();
      this.pauseClock();
      this.incrementMinuteAngleAcc();
      this.forceUpdate();
      this.disableGameBoard();
      await this.updatePlacedSpells();
      this.regenFocusForPlayers();
      this.enableGameBoard();
      isGameOver = this.checkIfIsGameOverAndReset();
      if (isGameOver) {
        return;
      }
      const [humanPlayer, npcPlayer] = this.players.getPlayers();
      // TESTING - - - - -
      if (humanPlayer && npcPlayer) {
        this.setIsDoneWithTurn(false, npcPlayer);
        this.setIsDoneWithTurn(false, humanPlayer);
        npcPlayer.setGameSymbol(null);
        humanPlayer.setGameSymbol(null);
        (npcPlayer as NPCPlayer).resetNumRemainingMovesPerTurn(); // resets NPC moves to between 2-3
        setTimeout(() => this.doNpcMove(), 1000);
      }
      // TESTING - - - - -
      this.forceUpdate();
    }
  }
  // GAME - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // KEY BINDINGS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
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
          const humanPlayer = this.players.getHumanPlayer();
          if (cell && humanPlayer) {
            const gameSymbol = humanPlayer.getGameSymbol();
            if (!gameSymbol) return;
            const inferenceString = gameSymbol.symbolName as InferenceString;
            const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
            if (spell) {
              const s = new spell(humanPlayer);
              const isPlayerHasFocus = humanPlayer.getFocus() != 0;
              if (isPlayerHasFocus) {
                const cost = s.getFocusCost();
                humanPlayer.incurPlayerCostForSpell(cost);
                const spellName = s.getSpellName();
                this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
                this.placeSpellAt(inferenceString, cellIndex);
                this.placedSpells.combineSpellsMaximally(this.gameBoard);
                if (humanPlayer.getFocus() < 1) {
                  this.setIsDoneWithTurn(true, humanPlayer);
                }
              } else {
                this.tooltipManager.doOutOfFocusFlash(this.forceUpdate);
              }
            }
            this.cancelPlacingSymbol();
            this.forceUpdate();
          }
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

  useGameplayKeyBindings = (): void => useKeyPress({ keyActions: this.keyActions, isDisabled: false, forceUpdate: this.forceUpdate });
  // KEY BINDINGS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // UI SPECIFIC - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getBackgroundSceneBrightness = (): number => this.backgroundSceneBrightness;
  beginIntro = (): void => {
    // begin intro walk...
    this.setIsDoneWithIntroWalk(false);
    this.forceUpdate();

    /*
      after 4 seconds, begin brightening scene
      full brightness after 8 seconds from start of begin brightening scene
    */ 
    setTimeout(() => {
      this.backgroundSceneBrightness = this.HIGH_BRIGHTNESS;
      this.forceUpdate();
    }, INTRO_WALK_ANIM_TIME * 500);

    /*
      turn-off walk anim after 8 seconds after turning it on.
    */
    setTimeout(() => { 
      this.setIsDoneWithIntroWalk(); 
    }, INTRO_WALK_ANIM_TIME * 1000);

  }
  setGameBoardRef = (gameBoardRef: RefObject<HTMLDivElement | null>): void => this.gameBoard.setGameBoardRef(gameBoardRef);
  setGameWrapperRef = (gameWrapperRef: RefObject<HTMLDivElement | null>): void => {
    this.gameWrapperRef = gameWrapperRef;
  }
  setForceUpdate = (forceUpdate: () => void) => {
    this.forceUpdate = forceUpdate;
  }
  resetBackgroundSceneBrightnessToDarkness = (): void => { this.backgroundSceneBrightness = this.LOW_BRIGHTNESS; }
  // UI SPECIFIC - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // AUDIO MANAGER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  startBackgroundMusic = (): void => {
    if (!this.audioHandler.getIsBackgroundMusicStarted()) {
      this.audioHandler.startBackgroundMusic()
    }
  }
  getIsMusicMuted = (): boolean => this.audioHandler.getIsMusicMuted()
  getIsFxMuted = (): boolean => this.audioHandler.getIsFxMuted();
  toggleAudio = (audioType: AudioType, isMuted?: boolean): void => {
    this.audioHandler.toggleAudio(audioType, isMuted);
    this.forceUpdate();
  }
  // AUDIO MANAGER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // TOOLTIP MANAGER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getIsSpellBookOpen = (): boolean => this.tooltipManager.getIsSpellBookOpen();
  setIsSpellBookOpen = (isSpellBookOpen?: boolean): void => { this.tooltipManager.setIsSpellBookOpen(isSpellBookOpen); this.forceUpdate(); }
  incrementDrawingOffBoard = (): void => this.tooltipManager.incrementDrawingOffBoard(this.forceUpdate);
  getIsDrawingOffBoard = (): boolean => this.tooltipManager.getIsDrawingOffBoard();
  getIsOutOfFocus = (): boolean => this.tooltipManager.getIsOutOfFocus();
  // TOOLTIP MANAGER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // GAMECLOCK - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getMinuteAngleAcc = (): number => this.gameClock.getMinuteAngleAcc();
  incrementMinuteAngleAcc = (): void => this.gameClock.incrementMinuteAngleAcc();
  resetMinuteAngleAcc = (): void => this.gameClock.resetMinuteAngleAcc();
  getSecondsHandAngle = (): number => this.gameClock.getSecondsHandAngle();
  resetClock = (): void => this.gameClock.resetClock();
  pauseClock = (): void => this.gameClock.pauseClock();
  unpauseClock = (): void => this.gameClock.unpauseClock();
  startClock = (): void => this.gameClock.startClock();
  stopClock = (): void => this.gameClock.stopClock();
  getClockChimeSeconds = (): number => {
    const numTotalMoves = this.placedSpells.spells.reduce((acc, item) => acc + Math.abs(item.speedDirection), 0);
    return Math.max(4, Math.floor(numTotalMoves * PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000));
  }
  // GAMECLOCK - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // GAMEBOARD - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getCellWidth = (): number | null => this.gameBoard.getCellWidth();
  getBoardRefDimensions = (): DivRefDimensions => this.gameBoard.getBoardRefDimensions() || { width: 0, height: 0, top: 0, left: 0 };
  getIsGameBoardDisabled = (): boolean => this.gameBoard.getIsGameBoardDisabled();
  enableGameBoard = (): void => this.gameBoard.enableBoard();
  disableGameBoard = (): void => this.gameBoard.disableBoard();
  isCanPlaceGameSymbolOn = (cell: Cell, player?: Player): boolean => {
    const p = player ? player : this.players.getHumanPlayer();
    return !!p && !this.getIsGameBoardDisabled() && cell.getIsFree() && cell.getIsPlaceCell(p);
  }
  placeSpellOnBoard = async (cell: Cell, player?: Player): Promise<void> => {
    const p = player ? player : this.players.getHumanPlayer();
    if (p && this.isCanPlaceGameSymbolOn(cell, p)) {
      const gameSymbol = p.getGameSymbol();
      if (gameSymbol) {
        const spell = gameSymbol.instantiateSpell();
        if (spell instanceof Spell) {
          p.setGameSymbol(null);
          spell.setCellIndex(cell.getCellIndex());
          this.placedSpells.addSpell(spell);
          this.gameBoard.setSpellAt(spell, cell);
        }
      }
    }
  }
  placeSpellAt = (inferenceString: InferenceString, cellIndex: CellIndex, player?: Player): void => {
    const p = player ? player : this.players.getHumanPlayer();
    if (p) {
      this.instantiateGameSymbolFromInferenceString(inferenceString, p);
      const cell = this.getCellAt(cellIndex);
      if (cell) {
        if (this.isCanPlaceGameSymbolOn(cell, p)) {
          this.placeSpellOnBoard(cell, p);
        }
      }
    }
  }
  getCellAt = (cellIndex: CellIndex): Cell | null => this.gameBoard.getCellAt(cellIndex);
  npcGetFutureSpellCollisionRow = (): number => this.gameBoard.npcGetFutureSpellCollisionRow();
  // GAMEBOARD - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // PLAYERS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getIsDoneWithIntroWalk = (): boolean => { const isDone = this.players.getPlayers().every(p => p.getIsDoneWithIntroWalk()); return isDone; }
  getHasFocus = (): boolean => {
    const humanPlayer = this.players.getHumanPlayer();
    if (humanPlayer) {
      return humanPlayer.getFocus() > 0;
    } else return false;
  }
  getGameSymbolIcon = (): string => this.players.getGameSymbolIcon();
  getHumanPlayer = (): Player | null => this.players.getHumanPlayer();
  getNpcPlayer = (): NPCPlayer | null => this.players.getNpcPlayer();
  regenFocusForPlayers = () => this.players.regenFocusForPlayers();
  decrementPlayerHealth = (playerIndex: number, dmg: number): void => {
    if ([0, 1].includes(playerIndex) && dmg) {
      const p = this.players.getPlayer(playerIndex);
      p.decrementHealth(dmg);
      const remainingHealth = (p.getHealth() - dmg);
      if (remainingHealth <= 0) {
        // death-cry
        this.audioHandler.startSoundEffect('wizard-Death-Cry');
      } else if (dmg > 10) {
        // scream
        this.audioHandler.startSoundEffect('wizard-Grunt-5');
      } else if (dmg > 0) {
        // grunt
        const randInt = Math.floor(Math.random() * 5);
        this.audioHandler.startSoundEffect(`wizard-Grunt-${randInt}` as SoundEffectName);
      } else {
        // heal
        this.audioHandler.startSoundEffect('wizard-Heal');
      }
    }
  }
  getReadiedSpell = (): string | null => this.players.getReadiedSpell();
  getGameSymbol = (): GameSymbol | null => this.players.getGameSymbol();
  cancelPlacingSymbol = (player?: Player): void => {
    this.players.cancelPlacingSymbol(player);
    this.forceUpdate();
  }
  getIsComputerPlayerDoneWithTurn = (): boolean => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      return npc.getIsDoneWithTurn();
    }
    return false; // default to false...
  }
  setIsDoneWithTurn = (isDoneWithTurn: boolean, player: Player): void => {
    player.setIsDoneWithTurn(isDoneWithTurn);
  }
  setIsDoneWithIntroWalk = (bool?: boolean): void => { this.players.getPlayers().forEach(p => p.setIsDoneWithIntroWalk(bool)); this.forceUpdate(); }
  // PLAYERS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // SPELL CANVAS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  beginDrawing = (): void => this.spellCanvas.setIsDrawing(true);
  endDrawing = (): void => this.spellCanvas.setIsDrawing(false);
  getIsDrawing = (): boolean => this.spellCanvas.getIsDrawing();
  getPlayerRawPoints = (): Array<Point> => this.spellCanvas.getRawPoints();
  addRawPoint(x: number, y: number): void {
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
  // SPELL CANVAS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // PLACED SPELLS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
  updatePlacedSpells = async () => {
    // uses a generator/iterator
    await this.placedSpells.updateSpells(this.gameBoard, this.forceUpdate, this.decrementPlayerHealth);
  }

  // Called "onMouseUp"
  runInference = async (mouseCoords?: Point): Promise<void> => {
    if (mouseCoords && this.spellCanvas.getNumPoints() == 0) {
      // IF "CLICK" -> place num key spell or Fireball if no spell readied
      const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(mouseCoords.x, mouseCoords.y);
      if (cellIndex) {
        const humanPlayer = this.players.getHumanPlayer();
        if (humanPlayer) {
          const inferenceString = humanPlayer?.getGameSymbol()?.symbolName || 'circle';
          const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
          if (spell) {
            const s = new spell(humanPlayer);
            const isPlayerHasFocus = humanPlayer.getFocus() != 0;
            if (isPlayerHasFocus) {
              const cost = s.getFocusCost();
              humanPlayer.incurPlayerCostForSpell(cost);
              const spellName = s.getSpellName();
              this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
              this.placeSpellAt(inferenceString, cellIndex);
              this.placedSpells.combineSpellsMaximally(this.gameBoard);
              if (humanPlayer.getFocus() < 1) {
                this.setIsDoneWithTurn(true, humanPlayer);
              }
            }
          }
        }
        this.forceUpdate();
      } else {
        this.incrementDrawingOffBoard();
      }
      this.cancelPlacingSymbol();
    }

    if (this.spellCanvas.getNumPoints() == 0) return;

    // ELSE -> user drew symbol. runInference
    const humanPlayer = this.players.getHumanPlayer();
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
      // Extract dominant layout targets from the collection stream points
      const dominantCells = this.filterDominantCells(rawPoints);
      if (dominantCells.length > 0 && humanPlayer) {
        const freeCells = dominantCells.map(cellIndex => this.getCellAt(cellIndex)).filter(cell => !!cell && this.isCanPlaceGameSymbolOn(cell));
        const spell = GameSymbol.SPELL_LOOKUP.get(result);
        if (humanPlayer && spell) {
          const freePositions = freeCells.filter(c => !!c).map(c => c?.getCellIndex());
          this.spawnSizedSpellInstance(result, freePositions, humanPlayer);
        }
      } else {
        this.incrementDrawingOffBoard();
      }
    }

    if (humanPlayer) {
      if (humanPlayer.getFocus() < 1) {
        this.setIsDoneWithTurn(true, humanPlayer);
      }
    }
    this.forceUpdate();
  }

  /**
 * Filters cell lists to discard accidental clipping boundaries based on point counts
 */
  private filterDominantCells = (points: Array<{ x: number; y: number }>): CellIndex[] => {
    if (points.length === 0) return [];

    const cellFrequency: Map<string, { count: number; index: CellIndex }> = new Map();

    // 1. Group point occurrences across cell indices
    points.forEach(p => {
      const idx = this.gameBoard.getCellIndexFromScreenCoord(p.x, p.y);
      if (idx) {
        const cell = this.gameBoard.getCellAt(idx);
        if (cell) {
          const existing = cellFrequency.get(cell.id) || { count: 0, index: idx };
          existing.count++;
          cellFrequency.set(cell.id, existing);
        }
      }
    });

    const totalPoints = points.length;
    const dominantCells: CellIndex[] = [];

    // 2. Filter out cells that fall beneath our 15% dominance threshold
    cellFrequency.forEach(data => {
      if (data.count / totalPoints >= 0.07) {
        dominantCells.push(data.index);
      }
    });

    // Fallback protection: if filtering leaves nothing, keep the single absolute highest count cell
    if (dominantCells.length === 0 && cellFrequency.size > 0) {
      let bestId: string = '';
      let maxCount = -1;
      cellFrequency.forEach((data, id) => {
        if (data.count > maxCount) {
          maxCount = data.count;
          bestId = id;
        }
      });
      if (bestId) dominantCells.push(cellFrequency.get(bestId)!.index);
    }

    return dominantCells;
  };

  /**
   * Instantiates the sizing constraints and evaluates focus expenses cleanly
   */
  private spawnSizedSpellInstance = (symbol: string, cells: CellIndex[], activeCaster: any): void => {
    if (cells.length === 0 || !activeCaster) return;

    let instance, count = 0;

    // 1. Establish absolute placement boundaries by caster direction / side
    const isHuman = activeCaster.getDirection() === 1;
    const minAllowedI = 0;
    const maxAllowedI = GameBoard.NUM_ROWS - 1; // 2
    const minAllowedJ = isHuman ? 0 : 4;
    const maxAllowedJ = isHuman ? 2 : GameBoard.NUM_COLS - 1; // 6

    // 2. Filter out gesture points that fall outside the caster's legal 3x3 deployment zone
    const validZoneCells = cells.filter(c =>
      c.i >= minAllowedI && c.i <= maxAllowedI &&
      c.j >= minAllowedJ && c.j <= maxAllowedJ
    );

    if (validZoneCells.length === 0) return;

    // 3. Compute the structural bounding box of the valid cells touched
    let minI = Number.MAX_SAFE_INTEGER, maxI = Number.MIN_SAFE_INTEGER;
    let minJ = Number.MAX_SAFE_INTEGER, maxJ = Number.MIN_SAFE_INTEGER;

    validZoneCells.forEach(c => {
      if (c.i < minI) minI = c.i;
      if (c.i > maxI) maxI = c.i;
      if (c.j < minJ) minJ = c.j;
      if (c.j > maxJ) maxJ = c.j;
    });

    let widthSpan = (maxJ - minJ) + 1;
    let heightSpan = (maxI - minI) + 1;
    const lowerSymbol = symbol.toLowerCase();

    // --- LAYER 4: SCAN OCCUPIED SUB-CELL MATRIX BOUNDS (WITH ACCURATE ROW CAP PROTECTION) ---
    const footprintMatrix: boolean[][] = Array(heightSpan).fill(null).map(() => Array(widthSpan).fill(false));

    for (let r = 0; r < heightSpan; r++) {
      for (let c = 0; c < widthSpan; c++) {
        const boardI = minI + r;
        const boardJ = minJ + c;

        // FIXED CAP: If a multi-cell placement calculation leaks past the 3-row grid limit, block it instantly
        if (boardI >= GameBoard.NUM_ROWS || boardJ >= GameBoard.NUM_COLS) {
          footprintMatrix[r][c] = true;
          continue;
        }

        const cell = this.gameBoard.getCellAt({ i: boardI, j: boardJ });

        // Safety block if it touches unfree tiles or any existing spell reference
        if (!cell || !cell.getIsFree() || cell.getSpell() !== null) {
          footprintMatrix[r][c] = true;
          continue;
        }

        // SIZED ACCURATE EVALUATION: Double check multi-cell spatial overlaps across the entire board array
        const overlappingActiveSpell = this.placedSpells.spells.find(s => {
          if (s.isRemove) return false;
          const root = s.getCellIndex();
          if (!root) return false;

          const sMaxI = root.i + s.heightCells - 1;
          const sMaxJ = root.j + s.widthCells - 1;

          return boardI >= root.i && boardI <= sMaxI && boardJ >= root.j && boardJ <= sMaxJ;
        });

        if (overlappingActiveSpell) {
          footprintMatrix[r][c] = true;
        }
      }
    }

    const spell = GameSymbol.SPELL_LOOKUP.get(lowerSymbol as InferenceString);
    if (!spell) return;

    // --- LAYER 5: TYPE-SPECIFIC COMPONENT DEPLOYMENT PASSTHROUGHS ---

    // A. ETHER & PHLEGM MAXIMAL SPATIAL GRID SWEEPER
    if (spell.spellName == 'Phlegm' || spell.spellName == 'Ether') {
      const isPhlegm = spell.spellName == 'Phlegm';

      const canFitSquare = (startR: number, startC: number, size: number): boolean => {
        // 1. Structural Boundary Cap Check
        if (startR + size > heightSpan || startC + size > widthSpan) return false;

        // 2. ABSOLUTE VERIFICATION LOOP
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            // If ANY cell inside this proposed square size is blocked or occupied, reject the placement
            if (footprintMatrix[startR + r][startC + c] === true) {
              return false;
            }
          }
        }
        return true;
      };

      const placeSquare = (startR: number, startC: number, size: number): void => {
        instance = isPhlegm ? new Phlegm(activeCaster) : new Ether(activeCaster);
        instance.widthCells = size;
        instance.heightCells = size;

        instance.setCellIndex({ i: minI + startR, j: minJ + startC });
        this.placedSpells.addSpell(instance);
        count++;

        // Mark the local matrix slots as locked so smaller sizes don't stack inside it
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            footprintMatrix[startR + r][startC + c] = true;
          }
        }
      };

      const allowedSizes = [3, 2, 1];
      allowedSizes.forEach(size => {
        for (let r = 0; r < heightSpan; r++) {
          for (let c = 0; c < widthSpan; c++) {
            if (canFitSquare(r, c, size)) {
              placeSquare(r, c, size);
            }
          }
        }
      });
    }

    // B. GYREUP & GYREDOWN VERTICAL COLUMNS TRACKER
    else if (spell.spellName == 'GyreUp' || spell.spellName == 'GyreDown') {
      const isGyreUp = spell.spellName == 'GyreUp';

      for (let c = 0; c < widthSpan; c++) {
        let r = 0;
        while (r < heightSpan) {
          if (footprintMatrix[r][c]) {
            r++;
            continue;
          }

          let contiguousHeight = 0;
          while (r + contiguousHeight < heightSpan && !footprintMatrix[r + contiguousHeight][c]) {
            contiguousHeight++;
          }

          if (contiguousHeight > 0) {
            instance = isGyreUp ? new GyreUp(activeCaster) : new GyreDown(activeCaster);
            instance.widthCells = 1;
            instance.heightCells = contiguousHeight;

            instance.setCellIndex({ i: minI + r, j: minJ + c });

            // Clear any lingering stale cells in this column slot
            for (let h = 0; h < contiguousHeight; h++) {
              const targetCell = this.gameBoard.getCellAt({ i: minI + r + h, j: minJ + c });
              if (targetCell) targetCell.setSpell(null);
            }

            this.placedSpells.addSpell(instance);
            count++;
            r += contiguousHeight;
          } else {
            r++;
          }
        }
      }
    }

    // C. QUICKEN HORIZONTAL CHAINS & VERTICAL ROW SPLITTING PASSTHROUGH
    else if (spell.spellName == 'Quicken') {
      for (let r = 0; r < heightSpan; r++) {
        let c = 0;
        while (c < widthSpan) {
          if (footprintMatrix[r][c]) {
            c++;
            continue;
          }

          let contiguousWidth = 0;
          while (c + contiguousWidth < widthSpan && !footprintMatrix[r][c + contiguousWidth]) {
            contiguousWidth++;
          }

          if (contiguousWidth > 0) {
            const finalWidth = heightSpan > 1 ? 1 : contiguousWidth;

            instance = new Quicken(activeCaster);
            instance.widthCells = finalWidth;
            instance.heightCells = 1;

            instance.setCellIndex({ i: minI + r, j: minJ + c });

            for (let w = 0; w < finalWidth; w++) {
              const targetCell = this.gameBoard.getCellAt({ i: minI + r, j: minJ + c + w });
              if (targetCell) targetCell.setSpell(null);
            }

            this.placedSpells.addSpell(instance);
            count++;
            c += finalWidth;
          } else {
            c++;
          }
        }
      }
    }
    if (instance && activeCaster) {
      const s = new spell(activeCaster);
      const spellName = s.getSpellName();
      const focusCost = s.getFocusCost() * instance.widthCells * instance.heightCells * count;
      activeCaster.incurPlayerCostForSpell(focusCost);
      this.audioHandler.startSoundEffect(`spell-${spellName}-${spellName === 'Ether' ? instance.widthCells * instance.heightCells : 1}` as SoundEffectName);
    }
    this.placedSpells.combineSpellsMaximally(this.gameBoard);
  };


  instantiateGameSymbolFromInferenceString = (inferenceString: InferenceString, player?: Player): void => {
    const p = player ? player : this.players.getHumanPlayer();
    if (p) {
      const gameSymbol = proxy(new GameSymbol(inferenceString, p));
      p.setGameSymbol(gameSymbol);

      const spellName = gameSymbol.getSpellClass()?.spellName
      this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);

      if (p === this.players.getHumanPlayer()) {
        this.players.setReadiedSpell(gameSymbol.getSpellClass()?.spellName || null);
        this.forceUpdate();
      }
    }
  }
  // PLACED SPELLS - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 


  // NPC PLAYER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
  getNpcDifficulty = (): NpcDifficulty => {
    const npc = this.players.getNpcPlayer();
    if (npc) return npc.difficulty;
    else return 'Normal'
  }
  setNpcDifficulty = (difficulty: NpcDifficulty): void => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      npc.setNpcDifficulty(difficulty)
    }
  }
  cycleThroughDifficulties = (): void => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      npc.cycleThroughDifficulties();
      this.forceUpdate();
    }
  }
  doNpcMove = (): void => {
    const npc = this.players.getNpcPlayer();
    if (npc) npc.doNpcMove(this.gameBoard, this.filterDominantCells, this.spawnSizedSpellInstance, this.isCanPlaceGameSymbolOn, this.getCellAt, this.forceUpdate);
  }
  getNPCMoveData = (): Array<NPCMoveData> => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      return npc.getNPCMoveData();
    } else {
      return [];
    }
  }
  getNPCMoveDatum = (i: number): NPCMoveData | null => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      return npc.getNPCMoveDatum(i)
    } else {
      return null;
    }
  }
  getNpcMousePos = (): Point => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      return npc.getNpcMousePos();
    }
    return { x: 0, y: 0 };
  }
  setNpcMousePos = (npcMousePos: Point) => {
    const npc = this.players.getNpcPlayer();
    if (npc) {
      npc.setNpcMousePos(npcMousePos);
    }
  }
  getNpcDrawingPoints = (): Array<Point> | null => {
    const npc = this.players.getNpcPlayer();
    if (npc)
      return npc.getNpcDrawingPoints();
    return null
  }
  resetNpcMove = (): void => {
    const npc = this.players.getNpcPlayer();
    if (npc)
      npc.resetNpcMove();
  }
  // NPC PLAYER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
}