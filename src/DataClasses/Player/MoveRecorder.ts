// MoveRecorder.ts
// While developing: the player's moves against the NPC, recorded to teach a new NPC by example (the moves
// dictionary: training/). Each of the player's casts, and each end of their turn, with the game as the NPC
// would see it from the player's side (encodeObservation), the legal moves, and the move. Kept in this
// browser (localStorage) across matches and reloads; the 8 key downloads them all as JSON.
//
// The fake-out (a cheap cast to make a waiting NPC move, then casting in reply to it) stays in the game,
// but its bait isn't taught: a turn's casts made before the NPC moved are marked bait when the player cast
// again after it (isBait), and training leaves them out. The replies are kept: moving second, as the NPC
// does on half its turns.
import { GameOverStatus, GameOver } from '../types';
import { END_TURN_ACTION, GameView, encodeObservation, getActionMask } from '../GameRules/NpcTrainingEnv';
import { PLAYER_INDEX } from '../GameRules/GameSimulation';

/** Recording on (in development only, and 1-player matches: Game). */
export const MOVE_RECORDER = { isOn: import.meta.env.DEV, storageKey: 'spellcraft-recorded-moves' };

/**
 * When in its turn a move was made: before the NPC moved ('first': moving first), after it had ('reply':
 * moving second), or while it was still drawing ('during': not used for training).
 */
export type MovePhase = 'first' | 'reply' | 'during';

export type RecordedMove = {
  match: string; // (this browser's match: its start time)
  turn: number; // turns elapsed
  phase: MovePhase;
  isBait?: boolean; // a cast before the NPC moved, in a turn the player then cast in reply (left out of training)
  obs: Array<[number, number]>; // the observation's nonzero numbers: [index, value]
  size: number; // the observation's length
  legal: string; // the legal actions: a bitmask, as hex (action 0 the lowest bit)
  action: number; // the move (a cast, or END_TURN_ACTION)
  difficulty: string; // the NPC's
  outcome?: 'win' | 'loss' | 'draw'; // the player's, once the match is over
};

/** The legal actions as a hex bitmask (4 actions a digit, action 0 the lowest bit of the first). */
const toHexMask = (mask: Array<boolean>): string => {
  let hex = '';
  for (let k = 0; k < mask.length; k += 4) hex += ((mask[k] ? 1 : 0) | (mask[k + 1] ? 2 : 0) | (mask[k + 2] ? 4 : 0) | (mask[k + 3] ? 8 : 0)).toString(16);
  return hex;
};

const OUTCOMES: Partial<Record<GameOver, 'win' | 'loss' | 'draw'>> = {
  [GameOverStatus.PlayerWon]: 'win', [GameOverStatus.CaughtNpc]: 'win', [GameOverStatus.EnemyFled]: 'win',
  [GameOverStatus.NpcWon]: 'loss', [GameOverStatus.CaughtPlayer]: 'loss',
  [GameOverStatus.BothDead]: 'draw', [GameOverStatus.TimesUp]: 'draw',
};

class MoveRecorder {
  private match = '';
  private turnMoves: Array<RecordedMove> = []; // this turn's (marked for bait once it's over)
  private matchMoves: Array<RecordedMove> = []; // this match's earlier turns (given the outcome at its end)

  /** A match begins. */
  beginMatch(): void {
    this.endMatch(null); // (one left unfinished: kept, without an outcome)
    this.match = new Date().toISOString();
  }

  /** The player's move (a cast's action, or END_TURN_ACTION), in the game as it was when they made it. */
  record(view: GameView, action: number, phase: MovePhase, difficulty: string): void {
    if (!MOVE_RECORDER.isOn || !this.match) return;
    const turn = Math.round(view.turnsElapsed);
    if (this.turnMoves.length && this.turnMoves[0].turn !== turn) this.endTurn();
    // (the game seen from the player's side: moving second once the NPC has moved)
    const observation = encodeObservation({ ...view, isMovingSecond: phase === 'reply' }, PLAYER_INDEX);
    const mask = getActionMask(view, PLAYER_INDEX);
    if (!mask[action]) return; // (a move the NPC couldn't make: not taught)
    this.turnMoves.push({
      match: this.match, turn, phase, action, difficulty,
      obs: observation.map((value, k) => [k, Math.round(value * 1000) / 1000] as [number, number]).filter(([, value]) => value !== 0),
      size: observation.length,
      legal: toHexMask(mask),
    });
  }

  /** The turn is over: casts made before the NPC moved are bait if the player cast again after it. */
  private endTurn(): void {
    const isFakeOut = this.turnMoves.some(m => m.phase === 'first' && m.action !== END_TURN_ACTION)
      && this.turnMoves.some(m => m.phase === 'reply' && m.action !== END_TURN_ACTION);
    if (isFakeOut) this.turnMoves.forEach(m => { if (m.phase === 'first') m.isBait = true; });
    this.matchMoves.push(...this.turnMoves);
    this.turnMoves = [];
  }

  /** The match is over (its game over status, null if unfinished): its moves saved, with its outcome. */
  endMatch(gameOver: GameOver | null): void {
    this.endTurn();
    if (!this.matchMoves.length) return;
    const outcome = gameOver === null ? undefined : OUTCOMES[gameOver];
    const moves = this.matchMoves.map(m => outcome ? { ...m, outcome } : m);
    this.matchMoves = [];
    try {
      const saved: Array<RecordedMove> = JSON.parse(window.localStorage.getItem(MOVE_RECORDER.storageKey) ?? '[]');
      window.localStorage.setItem(MOVE_RECORDER.storageKey, JSON.stringify([...saved, ...moves]));
      console.info(`Moves recorded: ${saved.length + moves.length} (this match ${moves.length}; the 8 key downloads them)`);
    } catch (err) {
      console.warn('Recording the moves failed (storage full?): download them (the 8 key) and clear them', err);
    }
  }

  /** All the recorded moves (this match's so far too), downloaded as a JSON file. */
  download(): void {
    let saved: Array<RecordedMove> = [];
    try { saved = JSON.parse(window.localStorage.getItem(MOVE_RECORDER.storageKey) ?? '[]'); } catch { /* (none) */ }
    const moves = [...saved, ...this.matchMoves, ...this.turnMoves];
    const url = URL.createObjectURL(new Blob([JSON.stringify({ endTurnAction: END_TURN_ACTION, moves })], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `spellcraft-moves-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json` });
    link.click();
    URL.revokeObjectURL(url);
    console.info(`Downloaded ${moves.length} recorded moves`);
  }
}

/** The recorder (one, outside the game's store: never proxied). */
export const moveRecorder = new MoveRecorder();
