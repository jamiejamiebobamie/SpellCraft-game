// Game.ts
import { RefObject } from 'react';
import { AudioHandler } from './AudioHandler';
import { GameBoard } from './GameBoard/GameBoard';
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
import { InferenceString, CellIndex, NpcDifficulty, Point, NPCMoveData, DivRefDimensions, SoundEffectName } from './types';
import { HARDCODED_SYMBOLS } from './PlacedSpells/HardCodedSymbols'
import { Phlegm, Ether, GyreUp, GyreDown, Quicken } from './PlacedSpells/Spell';
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
  audioHandler!: AudioHandler;
  gameBoard!: GameBoard;
  placedSpells!: PlacedSpells;
  model!: Model;
  spellCanvas!: SpellCanvas;
  gameClock!: GameClock;
  keyActions: Array<KeyAction> = []; // TO-DO: consider KeyBindings class

  players!: [Player, Player];
  humanPlayer: Player | null = null;
  computerPlayer: NPCPlayer | null = null;

  playerGameSymbolSpellName: string | null = null;

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

    this.audioHandler = new AudioHandler();
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
          if (cell && this.humanPlayer) {
            const gameSymbol = this.humanPlayer.getGameSymbol();
            if (!gameSymbol) return;
            const inferenceString = gameSymbol.symbolName as InferenceString;
            const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
            if (spell) {
              const s = new spell(this.humanPlayer);
              const isPlayerHasFocus = this.humanPlayer.getFocus() != 0;
              if (isPlayerHasFocus) {
                const cost = s.getFocusCost();
                this.humanPlayer.incurPlayerCostForSpell(cost);
                const spellName = s.getSpellName();
                this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
                this.placeSpellAt(inferenceString, cellIndex);
                this.placedSpells.combineSpellsMaximally(this.gameBoard);
                if (this.humanPlayer.getFocus() < 1) {
                  this.setIsDoneWithTurn(true, this.humanPlayer);
                }
              }
            }
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

  useGameplayKeyBindings = (): void => {
    useKeyPress({ keyActions: this.keyActions, isDisabled: false, forceUpdate: this.forceUpdate });
  }

  setForceUpdate = (forceUpdate: () => void) => {
    this.forceUpdate = forceUpdate;
  }


  startBackgroundMusic = (): void => {
    if (!this.audioHandler.getIsBackgroundMusicStarted()) {
      this.audioHandler.startBackgroundMusic()
    }
  }








  // handleAudio = () => {

  //   /*

  //   736598__gregorquendel__classical-music-collection-vol.mp3
  //   */

  //   // Create a global audio system context container
  //   const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  //   async function loadAndPlaySound(url: string) {
  //     // 1. Fetch the file data
  //     const response = await fetch(url);
  //     const arrayBuffer = await response.arrayBuffer();

  //     // 2. Decode the raw compressed file binary audio array
  //     const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  //     // 3. Create a player node source buffer
  //     const source = audioContext.createBufferSource();
  //     source.buffer = audioBuffer;

  //     // 4. Connect source directly to hardware output speaker destination nodes
  //     source.connect(audioContext.destination);

  //     // 5. Fire immediate zero-latency blast
  //     source.start(0);
  //   }
  // }

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

  regenFocusForPlayers = () => {
    this.players.forEach(p => p.decrementFocus(p.getFocusRegenAmt()));
  }

  decrementPlayerHealth = (playerIndex: number, dmg: number): void => {
    if ([0, 1].includes(playerIndex) && dmg) {
      this.players[playerIndex].decrementHealth(dmg);
      const remainingHealth = (this.players[playerIndex].getHealth() - dmg);
      if (remainingHealth <= 0) {
        // death-cry
        this.audioHandler.startSoundEffect('wizard-Death-Cry', .7);
      } else if (dmg > 10) {
        // scream
        this.audioHandler.startSoundEffect('wizard-Grunt-5', .5);
      } else {
        // grunt
        const randInt = Math.floor(Math.random() * 5);
        this.audioHandler.startSoundEffect(`wizard-Grunt-${randInt}` as SoundEffectName, .5);
      }
    }
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
          // spell.setIsPlaced(true);
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
    await this.placedSpells.updateSpells(this.gameBoard, this.forceUpdate, this.decrementPlayerHealth);
  }

  getGameSymbolIcon = (): string => {
    if (this.humanPlayer) {
      const gameSymbol = this.humanPlayer.getGameSymbol();
      if (gameSymbol) {
        const SpellClass = GameSymbol.SPELL_LOOKUP.get(gameSymbol.symbolName);
        return SpellClass ? `spell-icons/${SpellClass.spellName}Icon_mockup.png` : '';
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

  getIsPlacing = (): boolean => {
    return this.humanPlayer?.gameSymbol != null;
  }

  getReadiedSpell = (): string | null => {
    return this.playerGameSymbolSpellName;
  }

  getGameSymbol = (): GameSymbol | null => {
    const gameSymbol = this.humanPlayer?.getGameSymbol();
    return gameSymbol || null;
  }

  cancelPlacingSymbol = (player?: Player): void => {
    const p = player ? player : this.humanPlayer;
    p?.setGameSymbol(null);
    if (p === this.humanPlayer) {
      this.playerGameSymbolSpellName = null;
      // console.log({ playerGameSymbolSpellName: this.playerGameSymbolSpellName })
      this.forceUpdate();
    }
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
    }
  }

  runInference = async (mouseCoords?: Point): Promise<void> => {
    // place num key spell or Fireball if no spell readied
    if (mouseCoords && this.spellCanvas.getNumPoints() == 0) {
      const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(mouseCoords.x, mouseCoords.y);
      if (cellIndex) {
        if (this.humanPlayer) {
          const inferenceString = this.humanPlayer?.getGameSymbol()?.symbolName || 'circle';
          const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
          if (spell) {
            const s = new spell(this.humanPlayer);
            const isPlayerHasFocus = this.humanPlayer.getFocus() != 0;
            if (isPlayerHasFocus) {
              const cost = s.getFocusCost();
              this.humanPlayer.incurPlayerCostForSpell(cost);
              const spellName = s.getSpellName();
              this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
              this.placeSpellAt(inferenceString, cellIndex);
              this.placedSpells.combineSpellsMaximally(this.gameBoard);
              if (this.humanPlayer.getFocus() < 1) {
                this.setIsDoneWithTurn(true, this.humanPlayer);
              }
            }
          }
        }
        this.forceUpdate();
      }
      this.cancelPlacingSymbol();
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
      // Extract dominant layout targets from the collection stream points
      const dominantCells = this.filterDominantCells(rawPoints);
      if (dominantCells.length > 0 && this.humanPlayer) {
        const freeCells = dominantCells.map(cellIndex => this.getCellAt(cellIndex)).filter(cell => !!cell && this.isCanPlaceGameSymbolOn(cell));
        const spell = GameSymbol.SPELL_LOOKUP.get(result);
        if (this.humanPlayer && spell) {
          // const s = new spell(this.humanPlayer);
          // const focusCost = s.getFocusCost() * freeCells.length;
          // this.humanPlayer.incurPlayerCostForSpell(focusCost);
          const freePositions = freeCells.filter(c => !!c).map(c => c?.getCellIndex());
          this.spawnSizedSpellInstance(result, freePositions, this.humanPlayer);
        }
      }
    }

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

      const spellName = gameSymbol.getSpellClass()?.spellName
      this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);

      if (p === this.humanPlayer) {
        this.playerGameSymbolSpellName = gameSymbol.getSpellClass()?.spellName || null;
        this.forceUpdate();
      }
    }
  }

  endTurn = async (): Promise<void> => {
    if (!this.getIsGameBoardDisabled()) {

      this.resetNpcMove();

      let isGameOver = this.checkIfIsGameOverAndReset();
      if (isGameOver) {
        return;
      }

      this.audioHandler.startSoundEffect('clock-chime', 0.1);

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

      // TESTING - - - - -
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

    // Within doNpcMove -> storedSpell container:
    const storedSpell = () => {
      if (this.computerPlayer) {
        const dominantCells = this.filterDominantCells(rawPoints);
        if (dominantCells.length > 0) {

          const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);

          if (this.computerPlayer && spell) {
            const freeCells = dominantCells.map(cellIndex => this.getCellAt(cellIndex)).filter(cell => !!cell && this.isCanPlaceGameSymbolOn(cell, this.computerPlayer as Player));
            // const s = new spell(this.computerPlayer);
            // const focusCost = s.getFocusCost() * freeCells.length;
            const freePositions = freeCells.filter(c => !!c).map(c => c?.getCellIndex());
            // this.computerPlayer.incurPlayerCostForSpell(focusCost);
            this.spawnSizedSpellInstance(inferenceString, freePositions, this.computerPlayer);
          }
        }
      }

      if (!this.computerPlayer) return;
      this.cancelPlacingSymbol(this.computerPlayer);
      this.computerPlayer.decrementNumRemaningMovesPerTurn();

      if (this.computerPlayer.getNumRemainingMovesPerTurn() > 0 && this.computerPlayer.getFocus() > 0) {
        setTimeout(() => this.doNpcMove(), Math.random() * 1000);
      } else {
        this.setIsDoneWithTurn(true, this.computerPlayer);
        this.forceUpdate();
      }
    };


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

  getIsSpellBookOpen = (): boolean => {
    return this.isSpellBookOpen;
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

  // CHECK FOR GAME OVER CONDITION...
  checkIfIsGameOverAndReset = (): boolean => {
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

    const isGameOver = this.gameOver !== null;
    if (this.gameOver) {
      this.disableGameBoard();
      this.resetGame();
      this.forceUpdate();
    }
    return isGameOver;
  }
}