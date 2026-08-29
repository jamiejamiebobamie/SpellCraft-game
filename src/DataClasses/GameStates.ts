import { Player, NPCPlayer } from './Player/Player';
import { GameLog } from './GameLog';
import { GameStateProgressionPath } from './types';
import { GameBoard } from './GameBoard/GameBoard';

export interface GameContext {
  activePlayer: Player;
  opposingPlayer: Player;
  gameBoard: GameBoard;
  gameLog: GameLog;
  currentTurnCount: number;

  // Transition function provided by your global engine loop
  changeState: (newState: GameState) => void;
}

export abstract class GameState {
  protected context: GameContext;
  protected activeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  protected progressionPath: GameStateProgressionPath = null;

  constructor(context: GameContext) {
    this.context = context;
  }

  // --- Abstract Inputs ---
  abstract doEsc: () => void;
  abstract doRightClick: () => void;
  abstract doLeftClick: () => void;
  abstract runStateLogic: (currentGlobalTurn: number) => void;

  // --- Common Infrastructure Helpers ---
  updateGameLog = (text: string, color: string = '#FFFFFF'): void => {
    this.context.gameLog.appendEntry(text, color);
  };

  updateStateTo = (nextState: GameState): void => {
    // Critical: Clean up any trailing timeout reference before departing the state
    this.clearActiveTimeout();
    this.context.changeState(nextState);
  };

  protected clearActiveTimeout = (): void => {
    if (this.activeTimeoutId !== null) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }
  };
}

// ==========================================
// 1. Human Player State Phase Flow
// ==========================================

export class PlayerDrawSpell extends GameState {
  doEsc = () => { };
  doRightClick = () => {
    // END/SKIP TURN
    this.context.changeState(new SpellCollision(this.context));
  };
  doLeftClick = () => {
    // Called on MouseUp ...after inference is run.
    this.context.changeState(new PlayerRunInference(this.context));
  };

  runStateLogic = (currentGlobalTurn: number): void => {
    this.updateGameLog(`${this.context.activePlayer.color} Player drawing gesture...`, '#3b82f6');
    // Code hook: Prompt drawing Canvas UI block interaction

    // ALL / INIT:
    // 1. Hide GameBoard
    // this.context.gameBoard.disableBoard();
    // 2. Enable: 'doRightClick' and 'doLeftClick' and 'doEsc'. HANDLED with defined functions above... 
    // 3. Turn on 2D IK Wand Arm tracking (taken care of with: 'nextPlayer.setIsTurn(true, currentGlobalTurn);')
    // TO-DO: Implement IK wand arm movement for left and right

    // 'HappyPath' -> 'doLeftClick'
    // 4. Left click DOWN: do drawing, Left click UP: trigger state change and pass inference string (ie, 'doLeftClick')
    // 5. STATE CHANGE TO: 'PlayerRunInference'

    // 'AltPath' -> 'doRightClick'
    // 4. End turn.
    // 5. STATE CHANGE TO: 'SpellCollision'

    // 'Esc' -> 'doEsc'
    // 4. Exit game or show game menu modal
    // 5. STATE CHANGE TO: 'Menu'

  };
}

export class PlayerRunInference extends GameState {
  doEsc = () => { };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (currentGlobalTurn: number): void => {


    // ALL / INIT:
    // 1. Disable: 'doRightClick' and 'doLeftClick' and 'doEsc'. Handled by defined functions above.
    // 2. Run inference.
    // 3. Instantiate a new Spell from GameSymbol (SpellFactory) from string produced from model inference.

    // 'HappyPath' -> symbol is valid.
    // 4. Spell image is placed on Player cursor for Board placement. Focus (and possibly Health) decremented.
    // 5. STATE CHANGE TO: 'PlayerPlaceSymbol'

    // 'AltPath' -> symbol is invalid or code broke
    // 3. Do Fizzle. Focus decremented.
    // 4. STATE CHANGE TO: 'PlayerDrawSpell' (to try again or end turn)

    // 'UnhappyPath' -> player dies casting spells using his own HealthPool
    // 4. STATE CHANGE TO: 'GameOver'

    // 'Esc' -> 'doEsc'
    // 3. Exit game or show game menu modal
    // 4. STATE CHANGE TO: 'Menu'


    // this.updateGameLog('Analyzing drawing geometry...', '#93c5fd');

    // // Timeout Note handling: Set up a 1.5s window for visual effects matching model prediction
    // this.activeTimeoutId = setTimeout(() => {
    //   // Logic placeholder: evaluate simulated gesture bounds checking
    //   const fakeStrokeLength = Math.random() * 100;

    //   if (fakeStrokeLength < 10) {
    //     this.context.activePlayer.addFizzle(this.context.currentTurnCount);
    //     this.updateGameLog('Drawing fizzled!', '#ef4444');
    //     this.updateStateTo(new SpellCollision(this.context));
    //   } else {
    //     this.updateStateTo(new PlayerPlaceSymbol(this.context));
    //   }
    // }, 1500);
  };
}

export class PlayerPlaceSymbol extends GameState {
  doEsc = () => { this.updateStateTo(new PlayerDrawSpell(this.context)); }; // Put spell back into hand/cursor
  doRightClick = () => { };
  doLeftClick = () => { /* Select destination grid square cellIndex to deploy */ };

  runStateLogic = (): void => {
    this.updateGameLog('Left click on an empty tile to place the spell. Right Click to Cancel and Redraw.', '#fbbf24');

    // ALL / INIT:
    // 1. Enable: 'doRightClick' and 'doLeftClick' and 'doEsc'
    // 2. Unhide GameBoard

    // 'HappyPath' -> doLeftClick (on valid/free GameBoard Cell) -> player places spell on GameBoard.
    // 3. Spell image moves from Player cursor to clicked Board cell.
    // 4. STATE CHANGE TO: 'PlayerDrawSpell' (to draw again or end turn)

    // 'AltPath' -> doRightClick player cancels Spell
    // 4. STATE CHANGE TO: 'PlayerDrawSpell' (to try again or end turn)

    // 'Esc' -> 'doEsc'
    // 3. Exit game or show game menu modal
    // 4. STATE CHANGE TO: 'Menu'
  };
}

// ==========================================
// 2. NPC AI State Phase Flow
// ==========================================

export class NPCDrawSpell extends GameState {
  doEsc = () => { }; // Cannot skip computer calculations directly via escape
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (): void => {
    this.updateGameLog('Opponent is gathering magic parameters...', '#f87171');

    // ALL / INIT:
    // 1. Hide GameBoard
    // 2. Disable: 'doRightClick' and 'doLeftClick'
    // TO-DO: implement "follow hard-coded points" for drawing shape and having arm follow it
    // 3. Turn on 2D IK Wand Arm tracking for NPC (taken care of with: 'nextPlayer.setIsTurn(true, currentGlobalTurn);')
    // 4. Determine AI Logic... DrawSpell or Skip/End turn.

    // 'HappyPath' -> Draw Spell
    // 4. Cycle through hardcoded NPC points to show IK arm movement for NPC
    // 5. STATE CHANGE TO: 'NPCRunInference'

    // 'AltPath' -> Skip turn. (Automatic if no focus or if no free cells to place)
    // 4. End turn.
    // 5. STATE CHANGE TO: 'SpellCollision'

    // 'Esc' -> 'doEsc' -> player presses 'esc'
    // 6. Exit game or show game menu modal
    // 7. STATE CHANGE TO: 'Menu'

    this.activeTimeoutId = setTimeout(() => {
      this.updateStateTo(new NPCRunInference(this.context));
    }, 1000);
  };
}

export class NPCRunInference extends GameState {
  doEsc = () => { };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (currentGlobalTurn: number): void => {

    // ALL / INIT:
    // 1. Instantiate a new Spell from GameSymbol (SpellFactory) from string produced from RNG

    // 'HappyPath' -> symbol is valid.
    // 2. Spell image is placed on Player cursor for Board placement. Focus (and possibly Health) decremented.
    // 3. STATE CHANGE TO: 'NPCPlaceSymbol'

    // 'AltPath' -> symbol is invalid or code broke
    // 2. Do Fizzle. Focus decremented.
    // 3. STATE CHANGE TO: 'NPCDrawSpell' (to try again or end turn)

    // 'UnhappyPath' -> NPC dies casting spells using his own HealthPool (maybe rare?)
    // 2. STATE CHANGE TO: 'GameOver'

    // 'Esc' -> 'doEsc'
    // 3. Exit game or show game menu modal
    // 4. STATE CHANGE TO: 'Menu'


    // Note implementation: Roll basic probability calculation
    // const isSuccess = Math.random() > 0.3;

    // if (!isSuccess) {
    //   this.context.activePlayer.addFizzle(this.context.currentTurnCount);
    //   this.updateGameLog('AI drawing pattern degraded! Spell fizzled.', '#ef4444');
    //   this.updateStateTo(new PostSymbolResolution(this.context));
    // } else {
    //   this.updateStateTo(new NPCPlaceSymbol(this.context));
    // }
  };
}

export class NPCPlaceSymbol extends GameState {
  doEsc = () => { };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (currentGlobalTurn: number): void => {

    // ALL / INIT:
    // 1. Unhide GameBoard

    // 'HappyPath' -> NPC places spell on valid/free GameBoard cell.
    // 3. Spell image appears on board cell from place in air(?)
    // 4. STATE CHANGE TO: 'NPCDrawSpell' (to draw again or end turn)

    // 'Esc' -> 'doEsc'
    // 3. Exit game or show game menu modal
    // 4. STATE CHANGE TO: 'Menu'


    // if (this.context.activePlayer instanceof NPCPlayer) {
    //   this.context.activePlayer.doMove(currentGlobalTurn); // Triggers automated vector movement choice
    // }
    // this.updateStateTo(new SpellCollision(this.context));
  };
}

// ==========================================
// 3. Match Logic Evaluation and Endzones
// ==========================================

export class SpellCollision extends GameState {
  doEsc = () => { this.clearActiveTimeout(); this.updateStateTo(new PostSymbolResolution(this.context)); };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (): void => {

    // ALL / INIT:
    // 1. Show GameBoard
    // 2. Disable: 'doRightClick' and 'doLeftClick'
    // 3. TO-DO: use async await with a generator function to step through the forLoop of PlaceSpells.updateSpells (eg. stagger the updates to show spell collisions and reactions)
    // 4. CHANGE STATE TO: PostSymbolResolution

    // this.updateGameLog('Advancing layout track projectile layers...', '#c084fc');

    // // Engine loop: step spell.move(), compute collision overlaps
    // this.activeTimeoutId = setTimeout(() => {
    //   this.updateStateTo(new PostSymbolResolution(this.context));
    // }, 800);
  };
}

export class PostSymbolResolution extends GameState {
  doEsc = () => { };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (currentGlobalTurn: number): void => {


    // ALL / INIT:
    // 1. Determine if GameOver state

    // 'HappyPath' -> not GameOver state
    // 2. Regen focus and remove expired Fizzles
    // 3. STATE CHANGE TO: 'NPCDrawSpell' or 'PlayerDrawSpell'

    // 'UnhappyPath' -> NPC or player dies
    // 2. STATE CHANGE TO: 'GameOver'

    // 'Esc' -> 'doEsc'
    // 3. Exit game or show game menu modal
    // 4. STATE CHANGE TO: 'Menu'




    // // 1. Check health conditions to establish match status limits
    // if (this.context.activePlayer.getIsDead() || this.context.opposingPlayer.getIsDead()) {
    //   this.updateStateTo(new GameOver(this.context));
    //   return;
    // }

    // // 2. Regenerate resources safely using negative decrements
    // this.context.activePlayer.decrementFocus(-1);

    // // 3. Swap current turn pointers cleanly
    // const nextPlayer = this.context.opposingPlayer;
    // const previousPlayer = this.context.activePlayer;

    // this.context.activePlayer = nextPlayer;
    // this.context.opposingPlayer = previousPlayer;
    // this.context.currentTurnCount += 1;

    // previousPlayer.setIsTurn(false, currentGlobalTurn);
    // nextPlayer.setIsTurn(true, currentGlobalTurn);

    // // 4. Branch execution loop layout to determine if human or computer handles the upcoming turn
    // if (nextPlayer instanceof NPCPlayer) {
    //   this.updateStateTo(new NPCDrawSpell(this.context));
    // } else {
    //   this.updateStateTo(new PlayerDrawSpell(this.context));
    // }
  };
}

export class GameOver extends GameState {
  doEsc = () => { /* Prompt return to main hub menu */ };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (): void => {
    const winner = this.context.activePlayer.getIsDead() ? this.context.opposingPlayer : this.context.activePlayer;
    this.updateGameLog(`MATCH CONCLUDED. Victor: ${winner.color}`, '#4ade80');
  };
}

export class ShowMenu extends GameState {
  doEsc = () => { /* Prompt return to main hub menu */ };
  doRightClick = () => { };
  doLeftClick = () => { };

  runStateLogic = (): void => {

  };
}