// Game.ts
import { RefObject } from 'react';
import { AudioHandler } from './AudioHandler/AudioHandler';
import { AssetLoader } from './AssetLoader/AssetLoader';
import { GameBoard } from './GameBoard/GameBoard';
import { Players } from './Player/Players';
import { TooltipManager } from './TooltipManager/TooltipManager'
import { Cell } from './GameBoard/Cell';
import { PlacedSpells } from './PlacedSpells/PlacedSpells';
import { Model } from './NN_Model/Model';
import { SpellCanvas } from './SpellCanvas/SpellCanvas';
import { Spell } from './PlacedSpells/Spell';
import { GameSymbol } from './PlacedSpells/GameSymbol';
import { GameClock } from './GameClock/GameClock'
import { Player } from './Player/Player';
import { NPCPlayer, NPC_TURN_ORDER, NPC_WAITING_TIP } from './Player/NpcPlayer';
import { KeyAction, useKeyPress } from '../UI_Components/UseKeyPress'
import { InferenceString, CellIndex, NpcDifficulty, Point, NPCMoveData, DivRefDimensions, SoundEffectName, AudioType, GameOver, GameOverStatus } from './types';
import { proxy } from 'valtio';
import { INTRO_WALK_ANIM_TIME } from '../UI_Components/Player/CharacterParts';
import { TipId, TooltipPage } from './TooltipManager/TooltipManager';
import { SpellClass, createPlacedSpells, getIsBlockedForCasting, getDeathGameOver, getIsTimeUp, getPlacementFocusCost, planSpellPlacement } from './GameRules/gameRules';
import { NPC_INDEX } from './GameRules/GameSimulation';
import { GameView } from './GameRules/NpcTrainingEnv';
import { NPC_POLICY, NpcBrain } from './Player/NpcBrain';

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

  // PLAYING
  isPlaying: boolean = false;

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
  assetLoader!: AssetLoader;
  npcBrain!: NpcBrain;

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
    this.assetLoader = proxy(new AssetLoader());

    this.model = proxy(new Model());
    this.model.init(this.assetLoader);
    this.spellCanvas = proxy(new SpellCanvas());
    this.gameClock = proxy(new GameClock(this.endTurn));
    // The turn clock holds still while the welcome story is open; while a tip card is showing (so a
    // beginner has time to read it, and it isn't swept away by the turn ending); while the Spell Book
    // is open (so a player who'd rather not be timed can take their time); and once the game is over
    this.gameClock.getIsHeld = () => this.tooltipManager.active || this.tooltipManager.lightTips.length > 0 || this.getIsSpellBookOpen() || this.gameOver !== null;
    // Two thirds of the way through a turn's time, the first time: the tip on ending your turn (and the
    // seconds hand), in case the player hasn't cast yet (which usually brings it up)
    this.gameClock.onTick = (fraction: number) => {
      if (fraction < Game.END_TURN_TIP_AT || !this.tooltipManager.getIsTooltips() || this.tooltipManager.seenTips.has('endTurn') || this.tooltipManager.lightTips.includes('endTurn')) return;
      this.tooltipManager.triggerTip('endTurn');
      this.forceUpdate();
    };
    this.audioHandler = proxy(new AudioHandler(this.assetLoader));
    this.tooltipManager = proxy(new TooltipManager());
    this.npcBrain = new NpcBrain(this.assetLoader);
    this.setupGameplayKeyBindings();
  };

  startGame = (): void => {
    this.isPlaying = true;
    this.startBackgroundMusic();
    this.forceUpdate();
  }

  resetGame = (): void => {
    this.placedSpells.reset();
    this.gameBoard.reset();
    this.players.reset();
    this.gameOver = null;
    this.resetClock();
    this.enableGameBoard();
    this.tooltipManager.reset(this.forceUpdate);
    this.spellCanvas.setIsDrawing(false);
    this.spellCanvas.clearDrawing();
    this.matchNumber++;
    this.stopNpcWaiting();
    this.startNpcTurn(3000);
    this.forceUpdate();
  };

  // NPC TURN ORDER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  private matchNumber = 0; // rematches in this session
  private isNpcWaitingForPlayer = false;
  private npcWaitingTipsShown = 0; // this session (each makes the next wait 5 seconds longer)
  private npcWaitingTipRef: number | undefined = undefined;

  /** Whether the NPC waits for the player's first cast this turn (NPC_TURN_ORDER: by default, every other turn). */
  private getIsNpcWaitingThisTurn = (): boolean => {
    if (NPC_TURN_ORDER === 'waitForPlayer') return true;
    if (NPC_TURN_ORDER === 'alternate') return this.matchNumber % 2 === 0;
    // 'alternateTurns': the player first on odd turns (turnsElapsed 0, 2, ...), the NPC on even ones
    if (NPC_TURN_ORDER === 'alternateTurns') return Math.round(this.getMinuteAngleAcc() / this.gameClock.getMinuteIncrAngle()) % 2 === 0;
    return false;
  };
  getIsNpcWaitingForPlayer = (): boolean => this.isNpcWaitingForPlayer;

  /** The NPC's turn begins: it casts after `delayMilli`, or waits for the player to cast first. */
  startNpcTurn = (delayMilli: number): void => {
    // (the player's turn begins with the NPC's: the clock's seconds hand starts counting it down)
    this.gameClock.startTurnClock();
    if (!this.getIsNpcWaitingThisTurn()) {
      setTimeout(() => this.doNpcMove(), delayMilli);
      return;
    }
    this.isNpcWaitingForPlayer = true;
    // After a while, a reminder: 10 seconds the first time, 5 more each time it shows (up to 30)
    const { firstSeconds, stepSeconds, maxSeconds } = NPC_WAITING_TIP;
    const waitSeconds = Math.min(maxSeconds, firstSeconds + stepSeconds * this.npcWaitingTipsShown);
    clearTimeout(this.npcWaitingTipRef);
    this.npcWaitingTipRef = setTimeout(() => {
      if (!this.isNpcWaitingForPlayer) return;
      this.npcWaitingTipsShown++;
      this.tooltipManager.remindTip('waitingForYou');
      this.forceUpdate();
    }, waitSeconds * 1000);
    this.forceUpdate();
  };

  /** Stops waiting (and its reminder), without starting the NPC's turn. */
  private stopNpcWaiting = (): void => {
    this.isNpcWaitingForPlayer = false;
    clearTimeout(this.npcWaitingTipRef);
    this.tooltipManager.cancelReminder('waitingForYou');
  };

  /** The player has cast (or is ending the turn): a waiting NPC now plays its turn. */
  private releaseNpc = (delayMilli: number): void => {
    if (!this.isNpcWaitingForPlayer) return;
    this.stopNpcWaiting();
    setTimeout(() => this.doNpcMove(), delayMilli);
    this.forceUpdate();
  };
  // NPC TURN ORDER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getGameOver = (): GameOver | null => this.gameOver;
  setGameOver = (status: GameOver): void => {
    this.gameOver = status;
  }

  checkIfIsGameOverFromPlayerDeath = (): void => {
    const [humanPlayer, npcPlayer] = this.players.getPlayers();
    const deathGameOver = getDeathGameOver(humanPlayer, npcPlayer);
    if (deathGameOver !== null) {
      this.gameOver = deathGameOver;
      this.forceUpdate();
    }
  }

  checkIfIsGameOverFromTime = (): void => {
    // One clock tick (5 minutes) per turn
    const turnsElapsed = this.getMinuteAngleAcc() / this.gameClock.getMinuteIncrAngle();
    if (getIsTimeUp(turnsElapsed, Math.random)) {
      this.gameOver = GameOverStatus.TimesUp
      this.forceUpdate();
    }
  }

  checkIfIsGameOver = (): boolean => {
    // - GAMEOVER CONDITION #1: One or both players are dead. <PLAYER DEATH>
    this.checkIfIsGameOverFromPlayerDeath();
    // - GAMEOVER CONDITION #2: Player is caught by teacher. <TIME'S UP>
    // (compared with null: a draw, GameOverStatus.BothDead, is 0)
    if (this.gameOver === null) this.checkIfIsGameOverFromTime();

    const isGameOver = this.gameOver !== null;
    if (this.gameOver !== null) {
      this.gameClock.stopTurnClock();
      this.tooltipManager.clearClickClockRef();
      this.disableGameBoard();
      this.forceUpdate();
    }
    return isGameOver;
  }

  endTurn = async (): Promise<void> => {
    // (the clock, the Space/Escape keys and the turn timer all end turns through here)
    const isAnyPlayerDead = this.players.getPlayers().some(p => p.getIsDead());
    // The turn is ending: the seconds hand stops (and goes back to 12)
    if (!this.getIsGameBoardDisabled()) this.gameClock.stopTurnClock();
    // The NPC was waiting for the player to cast first: it plays its turn now, then the turn ends
    if (this.isNpcWaitingForPlayer && !this.getIsGameBoardDisabled() && this.gameOver === null && !isAnyPlayerDead) {
      this.releaseNpc(0);
      const npc = this.players.getNpcPlayer();
      const endOnceNpcIsDone = () => {
        if (!npc || npc.getIsDoneWithTurn() || npc.getFocus() <= 0 || npc.getIsDead()) this.endTurn();
        else setTimeout(endOnceNpcIsDone, 200);
      };
      setTimeout(endOnceNpcIsDone, 200);
      return;
    }
    if (!this.getIsGameBoardDisabled() && this.gameOver === null && !isAnyPlayerDead) {
      this.tooltipManager.clearClickClockRef(); // turn-off helper message
      // Ending the turn closes the light tip showing (and "Ending Your Turn" won't be needed)
      this.tooltipManager.dropQueuedTip('endTurn');
      this.tooltipManager.dismissLightTip();
      const hadSpells = this.placedSpells.spells.length > 0;
      this.resetNpcMove();

      this.audioHandler.startSoundEffect('clock-chime');
      this.incrementMinuteAngleAcc();
      this.forceUpdate();
      this.disableGameBoard();
      const isCollision = await this.updatePlacedSpells();
      this.regenFocusForPlayers();
      this.enableGameBoard();

      let isGameOver = this.checkIfIsGameOver();
      if (isGameOver) {
        return;
      }

      const [humanPlayer, npcPlayer] = this.players.getPlayers();
      if (humanPlayer && npcPlayer) {
        this.setIsDoneWithTurn(false, npcPlayer);
        this.setIsDoneWithTurn(false, humanPlayer);
        npcPlayer.setGameSymbol(null);
        humanPlayer.setGameSymbol(null);
        (npcPlayer as NPCPlayer).resetNumRemainingMovesPerTurn(); // resets NPC moves to between 2-3
        this.startNpcTurn(1000);
      }

      this.tooltipManager.doClickClockFlash(this.forceUpdate);

      // Tutorial tips that this turn made relevant
      if (hadSpells) this.tooltipManager.triggerTip('spellsInMotion');
      if (isCollision) this.tooltipManager.triggerTip('collisions');
      if (this.getMinuteAngleAcc() / this.gameClock.getMinuteIncrAngle() >= Game.NIGHT_PASSING_TIP_TURN) this.tooltipManager.triggerTip('nightPassing');
      this.forceUpdate();
    }
  }

  /** How far through a turn's time (0 to 1) the "Ending Your Turn" tip shows, if it hasn't yet. */
  static readonly END_TURN_TIP_AT = 2 / 3;

  /** After this many turns (5 minutes each, from midnight), the "night is passing" tip. */
  static readonly NIGHT_PASSING_TIP_TURN = 6;

  /** Tips a cast closes (the player has done, or moved past, what they describe). */
  private static readonly TIPS_CLOSED_BY_CASTING: Array<TipId> = ['casting', 'spellBook', 'focus', 'spellSize', 'bloodMagic'];

  /**
   * The player cast a spell (their focus dropped): closes a tip the cast answers; the first time, the
   * Focus tip, then Spell Size, then Ending Your Turn.
   */
  notePlayerCast = (): void => {
    this.releaseNpc(700); // a NPC waiting for the player to cast first now answers
    const shown = [...this.tooltipManager.getLightTips()];
    const wasFocusShowing = shown.includes('focus');
    shown.filter(tip => Game.TIPS_CLOSED_BY_CASTING.includes(tip)).forEach(tip => this.tooltipManager.dismissLightTip(tip));
    if (this.isBloodMagicTipPending) {
      this.isBloodMagicTipPending = false;
      this.tooltipManager.triggerTip('bloodMagic');
    }
    if (!wasFocusShowing) {
      // (each waits its turn: Focus, then Spell Size, then Ending Your Turn)
      this.tooltipManager.triggerTip('focus');
      this.tooltipManager.triggerTip('spellSize');
      this.tooltipManager.triggerTip('endTurn');
    }
    this.forceUpdate();
  }

  /**
   * A cast cost the player Health: the Blood Magic tip (the first time), shown by notePlayerCast once
   * this same cast has closed the previous tip.
   */
  private isBloodMagicTipPending = false;
  private noteBloodMagic = (caster: Player): void => {
    if (caster.id === this.getHumanPlayer()?.id) this.isBloodMagicTipPending = true;
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
          if (cell && cell.getIsFree() && humanPlayer && !humanPlayer.getIsDead()) {
            const gameSymbol = humanPlayer.getGameSymbol();
            if (!gameSymbol) return;
            const inferenceString = gameSymbol.symbolName as InferenceString;
            const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
            if (spell) {
              const s = new spell(humanPlayer);
              const isPlayerHasFocus = humanPlayer.getFocus() != 0;
              if (isPlayerHasFocus) {
                const cost = s.getFocusCost();
                const bloodMagicCost = humanPlayer.incurPlayerCostForSpell(cost);
                if (bloodMagicCost > 0) {
                  s.flagHitImpact(true, bloodMagicCost, true);
                  this.playPlayerDmgSound(humanPlayer, bloodMagicCost);
                  this.noteBloodMagic(humanPlayer);
                }
                const spellName = s.getSpellName();
                this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
                this.placeSpellAt(inferenceString, cellIndex, s);
                this.placedSpells.combineSpellsMaximally(this.gameBoard);
                this.checkIfIsGameOverFromPlayerDeath();
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
  getIsPlaying = (): boolean => this.isPlaying;
  setIsPlaying = (isPlaying: boolean): void => { this.isPlaying = isPlaying; };

  getIsSceneImgsLoaded = (): boolean => this.assetLoader.getIsSceneImgsLoaded();
  getIsFontLoaded = (): boolean => this.assetLoader.getIsFontLoaded();
  getIsPriorityAssetsLoaded = (): boolean => this.assetLoader.getIsPriorityAssetsLoaded();
  getIsLoading = (): boolean => this.assetLoader.getIsLoading();

  getBackgroundSceneBrightness = (): number => this.backgroundSceneBrightness;
  beginIntro = (): void => {
    // begin intro walk...
    this.beginIntroWalk();
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
    this.assetLoader.setForceUpdate(forceUpdate);
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
  getIsTooltips = (): boolean => this.tooltipManager.getIsTooltips();
  getIsSpellBookOpen = (): boolean => this.tooltipManager.getIsSpellBookOpen();
  setIsSpellBookOpen = (isSpellBookOpen?: boolean): void => {
    this.tooltipManager.setIsSpellBookOpen(isSpellBookOpen);
    if (this.tooltipManager.getIsSpellBookOpen()) this.tooltipManager.dismissLightTip('spellBook'); // they found it
    this.forceUpdate();
  }
  incrementDrawingOffBoard = (): void => this.tooltipManager.incrementDrawingOffBoard(this.forceUpdate);
  getIsDrawingOffBoard = (): boolean => this.tooltipManager.getIsDrawingOffBoard();
  getIsOutOfFocus = (): boolean => this.tooltipManager.getIsOutOfFocus();
  toggleToolTips = (isOn?: boolean): void => { this.tooltipManager.toggleToolTips(isOn); this.forceUpdate(); }
  loadToolTips = (): void => { this.tooltipManager.loadToolTips(); this.forceUpdate(); }
  getIsLoreDone = (): boolean => this.tooltipManager.getIsLoreDone();
  getIsLore = (): boolean => this.tooltipManager.getIsLore();
  getIsLastTooltipPage = (): boolean => this.tooltipManager.getIsLastPage();
  showLore = (): void => { this.tooltipManager.showLore(); this.forceUpdate(); }
  chooseToolTips = (isOn: boolean): void => { this.tooltipManager.chooseToolTips(isOn); this.forceUpdate(); }
  triggerTip = (tip: TipId): void => { this.tooltipManager.triggerTip(tip); this.forceUpdate(); }
  triggerTips = (tips: Array<TipId>): void => { this.tooltipManager.triggerTips(tips); this.forceUpdate(); }
  getLightTips = (): Array<TipId> => this.tooltipManager.getLightTips();
  getIsKeyboardControlsShown = (): boolean => this.tooltipManager.getIsKeyboardControlsShown();
  setIsKeyboardControlsShown = (isShown: boolean): void => { this.tooltipManager.setIsKeyboardControlsShown(isShown); this.forceUpdate(); }
  dismissLightTip = (tip?: TipId): void => { this.tooltipManager.dismissLightTip(tip); this.forceUpdate(); }
  nextTooltipPage = (): void => { this.tooltipManager.nextPage(); this.forceUpdate(); }
  prevTooltipPage = (): void => { this.tooltipManager.prevPage(); this.forceUpdate(); }
  closeTooltip = (): void => { this.tooltipManager.closeTooltip(); this.forceUpdate(); }
  getTotalPages = (): number => this.tooltipManager.getTotalPages();
  getCurrPageNum = (): number => this.tooltipManager.getCurrPageNum();
  getCurrPageContent = (): TooltipPage | null => this.tooltipManager.getCurrPageContent();
  getIsMultiPage = (): boolean => this.tooltipManager.getIsMultiPage();
  getMultiPageProgress = (): string => this.tooltipManager.getMultiPageProgress();
  getIsNextDisabled = (): boolean => this.tooltipManager.getIsNextDisabled();
  getIsPrevDisabled = (): boolean => this.tooltipManager.getIsPrevDisabled();
  getIsClickClock = (): boolean => this.tooltipManager.getIsClickClock();
  doClickClockFlash = (waitTimeMilli?: number): void => { this.tooltipManager.doClickClockFlash(this.forceUpdate, waitTimeMilli); }
  // TOOLTIP MANAGER - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // GAMECLOCK - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getMinuteAngleAcc = (): number => this.gameClock.getMinuteAngleAcc();
  incrementMinuteAngleAcc = (): void => this.gameClock.incrementMinuteAngleAcc();
  resetMinuteAngleAcc = (): void => this.gameClock.resetMinuteAngleAcc();
  getSecondsHandAngle = (): number => this.gameClock.getSecondsHandAngle();
  resetClock = (): void => this.gameClock.resetClock();
  getTurnTimeFraction = (): number => this.gameClock.getTurnTimeFraction();
  /** Whether the turn clock's seconds hand is held still right now (a tip showing, the Spell Book open...). */
  getIsTurnClockHeld = (): boolean => this.gameClock.getIsTurnClockRunning() && this.gameClock.getIsHeld();
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
    if (!p || this.getIsGameBoardDisabled() || !cell.getIsPlaceCell(p)) return false;
    return !getIsBlockedForCasting(cell.getCellIndex(), p.getDirection(), () => !cell.getIsFree(), this.placedSpells.spells);
  }
  placeSpellOnBoard = async (cell: Cell, _spell?: Spell): Promise<void> => {
    const p = this.players.getHumanPlayer();
    if (p && this.isCanPlaceGameSymbolOn(cell, p)) {
      const gameSymbol = p.getGameSymbol();
      if (gameSymbol) {
        const spell = gameSymbol.instantiateSpell();
        if (_spell instanceof Spell || spell instanceof Spell) {
          const s = _spell || spell;
          if (!s) return;
          p.setGameSymbol(null);
          s.setCellIndex(cell.getCellIndex());
          this.placedSpells.addSpell(s);
          this.gameBoard.setSpellAt(s, cell);
        }
      }
    }
  }
  placeSpellAt = (inferenceString: InferenceString, cellIndex: CellIndex, spell?: Spell): void => {
    const p = this.players.getHumanPlayer();
    if (p) {
      this.instantiateGameSymbolFromInferenceString(inferenceString, p);
      const cell = this.getCellAt(cellIndex);
      if (cell) {
        if (this.isCanPlaceGameSymbolOn(cell, p)) {
          this.placeSpellOnBoard(cell, spell);
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
  playPlayerDmgSound = (p: Player, dmg: number) => {
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
  getHumanPlayer = (): Player | null => this.players.getHumanPlayer();
  getNpcPlayer = (): NPCPlayer | null => this.players.getNpcPlayer();
  regenFocusForPlayers = () => this.players.regenFocusForPlayers();
  decrementPlayerHealth = (playerIndex: number, dmg: number): void => {
    if ([0, 1].includes(playerIndex) && dmg) {
      const p = this.players.getPlayer(playerIndex);
      p.decrementHealth(dmg);
      this.playPlayerDmgSound(p, dmg);
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
      // (waiting for the player to cast first counts as done, so the player can end the turn)
      return npc.getIsDoneWithTurn() || this.isNpcWaitingForPlayer;
    }
    return false; // default to false...
  }
  setIsDoneWithTurn = (isDoneWithTurn: boolean, player: Player): void => {
    player.setIsDoneWithTurn(isDoneWithTurn);
  }
  setIsDoneWithIntroWalk = (bool?: boolean): void => { this.players.getPlayers().forEach(p => p.setIsDoneWithIntroWalk(bool)); this.forceUpdate(); }
  beginIntroWalk = (): void => { this.players.getPlayers().forEach(p => p.setIsBeginIntroWalk(true)); this.forceUpdate(); }
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
  /** Moves the spells for the turn; returns whether any collided. */
  updatePlacedSpells = async (): Promise<boolean> => {
    // uses a generator/iterator
    return this.placedSpells.updateSpells(this.gameBoard, this.forceUpdate, this.decrementPlayerHealth);
  }

  // Called "onMouseUp"
  runInference = async (mouseCoords?: Point): Promise<void> => {
    if (mouseCoords && this.spellCanvas.getNumPoints() == 0) {
      // IF "CLICK" -> place num key spell or Fireball if no spell readied
      const cellIndex = this.gameBoard.getCellIndexFromScreenCoord(mouseCoords.x, mouseCoords.y);
      if (cellIndex) {
        const cell = this.getCellAt(cellIndex);
        const humanPlayer = this.players.getHumanPlayer();
        if (cell && cell.getIsFree() && humanPlayer && !humanPlayer.getIsDead()) {
          const inferenceString = humanPlayer?.getGameSymbol()?.symbolName || 'circle';
          const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
          if (spell) {
            const s = new spell(humanPlayer);
            const isPlayerHasFocus = humanPlayer.getFocus() != 0;
            if (isPlayerHasFocus) {
              const cost = s.getFocusCost();
              const bloodMagicCost = humanPlayer.incurPlayerCostForSpell(cost);
              if (bloodMagicCost > 0) {
                s.flagHitImpact(true, bloodMagicCost, true);
                this.playPlayerDmgSound(humanPlayer, bloodMagicCost);
                this.noteBloodMagic(humanPlayer);
              }
              const spellName = s.getSpellName();
              this.audioHandler.startSoundEffect(`spell-${spellName}-${1}` as SoundEffectName);
              this.placeSpellAt(inferenceString, cellIndex, s);
              this.placedSpells.combineSpellsMaximally(this.gameBoard);
              this.checkIfIsGameOverFromPlayerDeath();
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

  /** Whether a cell is taken (by a placed spell, or marked on the board). */
  private getIsCellOccupied = (index: CellIndex): boolean => {
    const cell = this.gameBoard.getCellAt(index);
    if (!cell || !cell.getIsFree() || cell.getSpell() !== null) return true;
    return this.placedSpells.spells.some(s => {
      if (s.isRemove) return false;
      const root = s.getCellIndex();
      if (!root) return false;
      return index.i >= root.i && index.i < root.i + s.heightCells && index.j >= root.j && index.j < root.j + s.widthCells;
    });
  };

  /**
   * Casts a drawn spell: where it lands, its shapes and its focus cost come from the shared
   * casting rules (GameRules/gameRules.ts); this adds the effects (blood magic, sound).
   */
  private spawnSizedSpellInstance = (symbol: string, cells: CellIndex[], activeCaster: any): void => {
    if (cells.length === 0 || !activeCaster) return;
    const spell = GameSymbol.SPELL_LOOKUP.get(symbol.toLowerCase() as InferenceString);
    if (!spell) return;

    const rects = planSpellPlacement(spell as SpellClass, cells, activeCaster.getDirection(), this.getIsCellOccupied, this.placedSpells.spells);
    const placed = createPlacedSpells(spell as SpellClass, rects, activeCaster);
    placed.forEach(s => this.placedSpells.addSpell(s));

    const instance = placed[placed.length - 1];
    if (instance && !activeCaster.getIsDead()) {
      const spellName = instance.getSpellName();
      const bloodMagicCost = activeCaster.incurPlayerCostForSpell(getPlacementFocusCost(spell as SpellClass, rects));
      if (bloodMagicCost > 0) {
        instance.flagHitImpact(activeCaster.id === this.getHumanPlayer()?.id, bloodMagicCost, true);
        this.playPlayerDmgSound(activeCaster, bloodMagicCost);
        this.noteBloodMagic(activeCaster);
      }
      this.audioHandler.startSoundEffect(`spell-${spellName}-${spellName === 'Ether' ? instance.widthCells * instance.heightCells : 1}` as SoundEffectName);
      this.checkIfIsGameOverFromPlayerDeath();
    }
    this.placedSpells.combineSpellsMaximally(this.gameBoard);
    this.placedSpells.resolveCastCollisions(this.gameBoard, this.forceUpdate);
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
    if (!npc) return;
    // Each turn, the difficulty decides between a random turn and a trained one
    if (NPC_POLICY === 'trained' && this.npcBrain.getIsReady() && !npc.isRandomMove()) {
      this.doTrainedNpcMove(npc);
      return;
    }
    npc.doNpcMove(this.gameBoard, this.filterDominantCells, this.spawnSizedSpellInstance, this.isCanPlaceGameSymbolOn, this.getCellAt, this.forceUpdate);
  }

  /** The game as the NPC's brain sees it: the same view a trained model saw in training. */
  getNpcGameView = (): GameView => {
    const [humanPlayer, npcPlayer] = this.players.getPlayers();
    return {
      spells: this.placedSpells.spells.filter(s => !s.getIsRemove()),
      players: [humanPlayer, npcPlayer],
      turnsElapsed: this.getMinuteAngleAcc() / this.gameClock.getMinuteIncrAngle(),
      gameOver: this.gameOver,
      getIsOccupied: this.getIsCellOccupied,
      // (on turns the NPC waits for the player, it moves second, having seen their casts)
      isMovingSecond: this.getIsNpcWaitingThisTurn(),
    };
  }

  /** The trained NPC casts spell after spell (each drawn as usual) until it chooses to end its turn. */
  private doTrainedNpcMove = async (npc: NPCPlayer): Promise<void> => {
    const endNpcTurn = () => { npc.setIsDoneWithTurn(true); this.forceUpdate(); };
    if (this.gameOver !== null || npc.getIsDead()) return endNpcTurn();
    let cast;
    try {
      cast = await this.npcBrain.planCast(this.getNpcGameView(), NPC_INDEX);
    } catch (err) {
      // The model failed (it shouldn't): a random move instead, so the NPC's turn always ends
      console.error('The NPC model failed; playing a random move', err);
      npc.doNpcMove(this.gameBoard, this.filterDominantCells, this.spawnSizedSpellInstance, this.isCanPlaceGameSymbolOn, this.getCellAt, this.forceUpdate);
      return;
    }
    if (!cast) return endNpcTurn();
    npc.doNpcMove(this.gameBoard, this.filterDominantCells, this.spawnSizedSpellInstance, this.isCanPlaceGameSymbolOn, this.getCellAt, this.forceUpdate,
      { ...cast, onCast: () => setTimeout(() => this.doTrainedNpcMove(npc), 300) });
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