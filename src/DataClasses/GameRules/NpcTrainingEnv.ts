// NpcTrainingEnv.ts
// The NPC's view of the game, for training (via training/bridge) and later for running a trained
// model in the browser: what it sees (observation), what it can do (actions, and which are legal
// right now), and what it is rewarded for.
//
// The agent always sees the board from the left player's side. The rules are mirror-symmetric
// (see the fairness tests), so an agent trained on the left plays the right side (the NPC) by
// mirroring the board.
import { CellIndex, GameOverStatus } from '../types';
import { Spell, Phlegm, Ether, Quicken, GyreUp, GyreDown } from '../PlacedSpells/Spell';
import { InteractionEvent } from '../PlacedSpells/SpellMovementEngine';
import { GameBoard } from '../GameBoard/GameBoard';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX, SPELL_CLASSES, SpellName } from './GameSimulation';
import { SpellClass, getFocusCost, getIsBlockedForCasting, getPlacementFocusCost, planSpellPlacement } from './gameRules';
import { Player } from '../Player/Player';
import { playScriptedTurn } from './scriptedOpponent';

const ROWS = GameBoard.NUM_ROWS;
const COLS = GameBoard.NUM_COLS;
const ZONE = GameBoard.NUM_PLACEMENT_CELLS;

/**
 * What the NPC needs to see of a game: a GameSimulation (training), or the live game (Game.getNpcGameView)
 * so a trained model sees the real game exactly as it saw games in training.
 */
export type GameView = Pick<GameSimulation, 'spells' | 'players' | 'turnsElapsed' | 'gameOver' | 'getIsOccupied'> & {
  /** Whether the side choosing moves second this turn (its opponent has already cast): see getIsMovingSecond. */
  isMovingSecond?: boolean;
};

/**
 * Who moves first each turn, as in the game (NPC_TURN_ORDER 'alternateTurns'): the player (the
 * agent's opponent) on odd turns (turnsElapsed 0, 2, ...), so the NPC (the agent) moves second,
 * having seen the player's casts; the NPC first on even turns.
 */
export const getIsMovingSecond = (turnsElapsed: number): boolean => turnsElapsed % 2 === 0;

// --- Actions -----------------------------------------------------------------------------------

export const SPELL_ORDER: Array<SpellName> = ['Phlegm', 'Ether', 'Quicken', 'GyreUp', 'GyreDown'];

type ZoneRect = { i: number; j: number; w: number; h: number };

/** Every rectangle in the 3x3 placement zone (as seen from the left side): 36 of them. */
const ZONE_RECTS: Array<ZoneRect> = (() => {
  const rects: Array<ZoneRect> = [];
  for (let h = 1; h <= ZONE; h++) for (let w = 1; w <= ZONE; w++)
    for (let i = 0; i + h <= ROWS; i++) for (let j = 0; j + w <= ZONE; j++) rects.push({ i, j, w, h });
  return rects;
})();

/** Actions: cast spell type s over zone rectangle r (index s * 36 + r), or end the turn (last). */
export const NUM_ACTIONS = SPELL_ORDER.length * ZONE_RECTS.length + 1;
export const END_TURN_ACTION = NUM_ACTIONS - 1;

/** Mirrors a column left-right if `side` is the right side (the NPC). */
const toSideColumn = (j: number, side: number): number => side === PLAYER_INDEX ? j : COLS - 1 - j;

export type DecodedAction = { kind: 'endTurn' } | { kind: 'cast'; spellName: SpellName; cells: Array<CellIndex> };

/** What an action means for `side`: the spell and the cells its drawing touches. */
export const decodeAction = (action: number, side: number): DecodedAction => {
  if (action === END_TURN_ACTION) return { kind: 'endTurn' };
  const spellName = SPELL_ORDER[Math.floor(action / ZONE_RECTS.length)];
  const rect = ZONE_RECTS[action % ZONE_RECTS.length];
  const cells: Array<CellIndex> = [];
  for (let r = 0; r < rect.h; r++) for (let c = 0; c < rect.w; c++) cells.push({ i: rect.i + r, j: toSideColumn(rect.j + c, side) });
  return { kind: 'cast', spellName, cells };
};

/** Whether a cast costing `focusCost` would kill its caster with blood magic (never allowed for the AI). */
const getIsLethalCast = (caster: Player, focusCost: number): boolean =>
  Math.max(0, focusCost - caster.getFocus()) * caster.getBloodMagicCost() >= caster.getHealth();

/**
 * Which actions `side` may take now. Ending the turn is always allowed; casting needs the game to
 * be on, the caster alive with some focus left, at least one cell it can cast onto under the
 * drawing (every spell type can fill a single cell), and blood magic that wouldn't kill it. A cast
 * fills every free cell under the drawing, so its cost is the spell's cost per cell x the free cells.
 * Equivalent to getActionMaskByPlanning, but fast.
 */
export const getActionMask = (sim: GameView, side: number): Array<boolean> => {
  const caster = sim.players[side];
  const canCast = sim.gameOver === null && !caster.getIsDead() && caster.getFocus() > 0;
  const mask = new Array<boolean>(NUM_ACTIONS).fill(false);
  mask[END_TURN_ACTION] = true;
  if (!canCast) return mask;

  const direction = caster.getDirection();
  const isFree = Array.from({ length: ROWS }, (_, i) => Array.from({ length: ZONE }, (_, j) =>
    !getIsBlockedForCasting({ i, j: toSideColumn(j, side) }, direction, sim.getIsOccupied, sim.spells)));
  ZONE_RECTS.forEach((rect, r) => {
    let freeCells = 0;
    for (let dr = 0; dr < rect.h; dr++) for (let dc = 0; dc < rect.w; dc++) if (isFree[rect.i + dr][rect.j + dc]) freeCells++;
    if (!freeCells) return;
    SPELL_ORDER.forEach((spellName, s) => {
      mask[s * ZONE_RECTS.length + r] = !getIsLethalCast(caster, getFocusCost(SPELL_CLASSES[spellName] as SpellClass, freeCells));
    });
  });
  return mask;
};

/** The legal-move mask by fully planning every cast (slow; used by tests to check getActionMask). */
export const getActionMaskByPlanning = (sim: GameSimulation, side: number): Array<boolean> => {
  const caster = sim.players[side];
  const canCast = sim.gameOver === null && !caster.getIsDead() && caster.getFocus() > 0;
  return Array.from({ length: NUM_ACTIONS }, (_, action) => {
    if (action === END_TURN_ACTION) return true;
    if (!canCast) return false;
    const decoded = decodeAction(action, side) as Extract<DecodedAction, { kind: 'cast' }>;
    const SpellType = SPELL_CLASSES[decoded.spellName];
    const rects = planSpellPlacement(SpellType, decoded.cells, caster.getDirection(), sim.getIsOccupied, sim.spells);
    return rects.length > 0 && !getIsLethalCast(caster, getPlacementFocusCost(SpellType, rects));
  });
};

// --- Observation -------------------------------------------------------------------------------

const CHANNELS = [
  // spell type, moving toward the opponent (5), then toward the agent (5)
  'Phlegm>', 'Ether>', 'Quicken>', 'GyreUp>', 'GyreDown>',
  'Phlegm<', 'Ether<', 'Quicken<', 'GyreUp<', 'GyreDown<',
  'power', 'onFire', 'electrified', 'empowered', 'width', 'height',
] as const;
const SCALARS = ['ownHealth', 'opponentHealth', 'ownFocus', 'opponentFocus', 'turnsElapsed', 'isMovingSecond'] as const;

export const OBSERVATION_SIZE = ROWS * COLS * CHANNELS.length + SCALARS.length;

const SPELL_TYPES = [Phlegm, Ether, Quicken, GyreUp, GyreDown];

/**
 * What `side` sees, as numbers in [0, 1]: for each board cell (from its own side: its zone on the
 * left), the spell covering it, then health, focus, the clock, and whether it moves second this turn
 * (its opponent has already cast).
 */
export const encodeObservation = (sim: GameView, side: number): Array<number> => {
  const obs = new Array<number>(OBSERVATION_SIZE).fill(0);
  const set = (i: number, j: number, channel: number, value: number) => { obs[(i * COLS + j) * CHANNELS.length + channel] = value; };

  sim.spells.filter(s => !s.getIsRemove()).forEach((spell: Spell) => {
    const typeIndex = SPELL_TYPES.findIndex(T => spell instanceof T);
    // A spell moving away from `side` is heading toward the opponent
    const isTowardOpponent = Math.sign(spell.speedDirection) === sim.players[side].getDirection();
    const channelValues: Array<[number, number]> = [
      [(isTowardOpponent ? 0 : 5) + typeIndex, 1],
      [10, Math.min(1, spell.getPower() / 50)],
      [11, spell instanceof Ether || spell.consumedEthers > 0 ? 1 : 0],
      [12, spell instanceof Quicken || spell.consumedQuickens > 0 ? 1 : 0],
      [13, spell.consumedPhlegms > 0 ? 1 : 0],
      [14, spell.widthCells / COLS],
      [15, spell.heightCells / ROWS],
    ];
    for (let r = 0; r < spell.heightCells; r++) for (let c = 0; c < spell.widthCells; c++) {
      const i = spell.cellIndex.i + r, j = spell.cellIndex.j + c;
      if (i < 0 || i >= ROWS || j < 0 || j >= COLS) continue;
      channelValues.forEach(([channel, value]) => set(i, toSideColumn(j, side), channel, value));
    }
  });

  const own = sim.players[side], opponent = sim.players[1 - side];
  const maxFocus = own.getMaxFocus() + own.getMaxExcessFocus();
  [own.getHealth() / 100, opponent.getHealth() / 100, own.getFocus() / maxFocus, opponent.getFocus() / maxFocus, sim.turnsElapsed / 72, sim.isMovingSecond ? 1 : 0]
    .forEach((value, k) => { obs[ROWS * COLS * CHANNELS.length + k] = value; });
  return obs;
};

// --- Opponents ---------------------------------------------------------------------------------

/**
 * - 'none': never casts
 * - 'random': one random legal cast most turns, like the current in-game NPC
 * - 'scripted': defends its most threatened row, otherwise attacks (scriptedOpponent.ts); 10% of its casts are random
 * - 'scriptedNormal': 'scripted', but half its casts are random (the original NPC's 'Normal')
 * - 'mixed': each game, one of the above (except 'none'), per MIXED_OPPONENT_WEIGHTS
 */
export type OpponentName = 'none' | 'random' | 'scripted' | 'scriptedNormal' | 'mixed';
export const OPPONENTS: Array<OpponentName> = ['none', 'random', 'scripted', 'scriptedNormal', 'mixed'];

/** How often each opponent is picked for a game when training against 'mixed'. */
export const MIXED_OPPONENT_WEIGHTS: Array<[OpponentName, number]> = [['random', 0.2], ['scriptedNormal', 0.3], ['scripted', 0.5]];

const pickMixedOpponent = (random: () => number): OpponentName => {
  let roll = random();
  for (const [name, weight] of MIXED_OPPONENT_WEIGHTS) {
    if (roll < weight) return name;
    roll -= weight;
  }
  return MIXED_OPPONENT_WEIGHTS[MIXED_OPPONENT_WEIGHTS.length - 1][0];
};

/** Casts a random legal spell for `side`, if it can. */
const castRandomly = (sim: GameSimulation, side: number, random: () => number): void => {
  const mask = getActionMask(sim, side);
  const legalCasts = mask.map((ok, action) => ok && action !== END_TURN_ACTION ? action : -1).filter(a => a >= 0);
  if (!legalCasts.length) return;
  const decoded = decodeAction(legalCasts[Math.floor(random() * legalCasts.length)], side);
  if (decoded.kind === 'cast') sim.cast(side, decoded.spellName, decoded.cells);
};

/** Plays the opponent's casts for one turn. */
const playOpponent = (sim: GameSimulation, side: number, opponent: OpponentName, random: () => number): void => {
  if (opponent === 'random') {
    if (random() < 0.7) castRandomly(sim, side, random);
  } else if (opponent === 'scripted' || opponent === 'scriptedNormal') {
    playScriptedTurn(sim, side, random, opponent === 'scripted' ? 0.1 : 0.5, () => castRandomly(sim, side, random));
  }
};

// --- Interactions (combos) ----------------------------------------------------------------------

/** Spell interactions in a game, from one side's point of view. */
export type InteractionCounts = {
  reflectedEnemySpells: number; // its Phlegm sent an enemy spell back
  selfHeals: number; // its Phlegm sent its own Phlegm back (the self-heal combo)
  reflectedOwnSpells: number; // its Phlegm sent another of its own spells back
  reflectedByEnemy: number; // an enemy Phlegm sent its spell back
  liftsByOwnGyres: number; // its Gyre moved a spell (either side's) to another row
  ownSpellsLiftedByEnemyGyres: number; // an enemy Gyre moved its spell to another row
  ownSpellsLiftedSafely: number; // its spell finished a lift (by either side's Gyre) still on the board
  ownSpellsThroughOwnGyres: number; // its spell went through its own Gyre and out, still on the board (with the exit bonus)
  enemySpellsLiftedOffBoard: number; // its Gyre pushed an enemy spell off the board
  buffsFromEnemySpells: number; // its spell absorbed an enemy Ether/Quicken
  buffsFromOwnSpells: number; // its spell absorbed its own Ether/Quicken
  empoweredByEther: number; // its spell absorbed an Ether (either side's), gaining its damage
};

const emptyCounts = (): InteractionCounts => ({
  reflectedEnemySpells: 0, selfHeals: 0, reflectedOwnSpells: 0, reflectedByEnemy: 0,
  liftsByOwnGyres: 0, ownSpellsLiftedByEnemyGyres: 0, ownSpellsLiftedSafely: 0, ownSpellsThroughOwnGyres: 0, enemySpellsLiftedOffBoard: 0,
  buffsFromEnemySpells: 0, buffsFromOwnSpells: 0, empoweredByEther: 0,
});

export const countInteractions = (events: Array<InteractionEvent>, side: number, counts: InteractionCounts = emptyCounts()): InteractionCounts => {
  events.forEach(e => {
    if (e.kind === 'reflect') {
      if (e.phlegmSide === side && e.spellSide !== side) counts.reflectedEnemySpells++;
      else if (e.phlegmSide === side && e.isPhlegmSpell) counts.selfHeals++;
      else if (e.phlegmSide === side) counts.reflectedOwnSpells++;
      else if (e.spellSide === side) counts.reflectedByEnemy++;
    } else if (e.kind === 'lift') {
      if (e.gyreSide === side) counts.liftsByOwnGyres++;
      else if (e.spellSide === side) counts.ownSpellsLiftedByEnemyGyres++;
    } else if (e.kind === 'liftEnd') {
      if (e.spellSide === side && e.isSurvived) counts.ownSpellsLiftedSafely++;
      if (e.spellSide === side && e.gyreSide === side && e.isSurvived) counts.ownSpellsThroughOwnGyres++;
      else if (e.gyreSide === side && e.spellSide !== side && !e.isSurvived) counts.enemySpellsLiftedOffBoard++;
    } else if (e.consumerSide === side) {
      if (e.buff === 'fire') counts.empoweredByEther++;
      if (e.consumedSide === side) counts.buffsFromOwnSpells++;
      else counts.buffsFromEnemySpells++;
    }
  });
  return counts;
};

/**
 * Optional rewards for combos (all 0: off). Turn on only if training shows the agent isn't finding
 * combos by itself. Each is per interaction; the total per game is capped well below a win (+1),
 * so winning always matters most. Interactions not listed here are tracked but never rewarded.
 */
export const INTERACTION_REWARDS: Partial<Record<keyof InteractionCounts, number>> & { maxPerGame: number } = {
  reflectedEnemySpells: 0,
  selfHeals: 0,
  liftsByOwnGyres: 0,
  ownSpellsLiftedByEnemyGyres: 0,
  ownSpellsLiftedSafely: 0, // e.g. sending a Quicken through a Gyre to change rows
  ownSpellsThroughOwnGyres: 0.15, // a "bounce": its own spell sent through its own Gyre (moving it on, with the exit bonus)
  enemySpellsLiftedOffBoard: 0.05, // a "push": its Gyre pushing an enemy spell off the board
  buffsFromEnemySpells: 0,
  buffsFromOwnSpells: 0,
  empoweredByEther: 0.1, // its spell empowered by an Ether's damage
  maxPerGame: 1, // (as much as a win: playful play counts, at some cost to playing its strongest)
};

// --- Environment -------------------------------------------------------------------------------

/**
 * Casting the same spell (whatever its size or place) as one of its last `window` casts costs `penalty`
 * (0: off): a nudge toward using all its spells. (For scale: a point of damage is 0.01, a win 1.)
 */
export const REPEAT_PENALTY = { window: 3, penalty: 0.03 };

export type EnvStepResult = {
  observation: Array<number>;
  actionMask: Array<boolean>;
  reward: number;
  terminated: boolean;
  info: {
    ownHealth: number;
    opponentHealth: number;
    turnsElapsed: number;
    outcome: 'win' | 'loss' | 'draw' | null;
    opponent: OpponentName; // this game's opponent (for 'mixed', the one picked)
    interactions: { agent: InteractionCounts; opponent: InteractionCounts }; // this game so far
  };
};

export type EnvOptions = {
  seed?: number;
  opponent?: OpponentName;
  /** Scales the interaction rewards (e.g. faded from 1 to 0 over training). */
  interactionRewardScale?: number;
};

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/**
 * One game, from the agent's side (the left). Each step the agent casts a spell or ends its turn.
 * Who moves first alternates each turn (getIsMovingSecond): on the agent's second-mover turns the
 * opponent casts as the turn begins, and the agent sees it; otherwise the opponent casts once the agent
 * ends its turn. Then the spells move.
 *
 * Reward: (damage dealt - damage taken) / 100 each turn (healing counts the other way), plus +1 for
 * a win and -1 for a loss, plus any interaction rewards (INTERACTION_REWARDS, off by default).
 */
export class NpcTrainingEnv {
  static readonly AGENT = PLAYER_INDEX;
  static readonly OPPONENT = NPC_INDEX;

  sim: GameSimulation = new GameSimulation();
  private opponent: OpponentName = 'random';
  private gameOpponent: OpponentName = 'random'; // this game's ('mixed' picks one per game)
  private random: () => number = Math.random;
  private interactionRewardScale: number = 1;
  private interactionRewardGiven: number = 0;
  private interactions = { agent: emptyCounts(), opponent: emptyCounts() };
  private hasOpponentPlayedThisTurn = false;
  private recentCasts: Array<SpellName> = []; // the agent's last casts (REPEAT_PENALTY)
  /** Health changes before the agent's first step (the opponent casting first on turn 1): given with that step. */
  private pendingReward = 0;

  reset = ({ seed, opponent, interactionRewardScale }: EnvOptions = {}): EnvStepResult => {
    this.random = seed === undefined ? Math.random : mulberry32(seed);
    this.opponent = opponent ?? this.opponent;
    this.gameOpponent = this.opponent === 'mixed' ? pickMixedOpponent(this.random) : this.opponent;
    this.interactionRewardScale = interactionRewardScale ?? this.interactionRewardScale;
    this.interactionRewardGiven = 0;
    this.interactions = { agent: emptyCounts(), opponent: emptyCounts() };
    this.sim = new GameSimulation({ random: this.random });
    this.hasOpponentPlayedThisTurn = false;
    this.recentCasts = [];
    const before = this.healths();
    this.beginTurn();
    this.pendingReward = this.healthReward(before);
    return this.result(0, false);
  };

  /** A turn begins: if the agent moves second this turn, the opponent casts first. */
  private beginTurn = (): void => {
    this.hasOpponentPlayedThisTurn = false;
    if (this.sim.gameOver !== null || !getIsMovingSecond(this.sim.turnsElapsed)) return;
    playOpponent(this.sim, NpcTrainingEnv.OPPONENT, this.gameOpponent, this.random);
    this.hasOpponentPlayedThisTurn = true;
  };

  step = (action: number): EnvStepResult => {
    const { AGENT, OPPONENT } = NpcTrainingEnv;
    if (this.sim.gameOver !== null) return this.result(0, false); // already over
    const pending = this.pendingReward;
    this.pendingReward = 0;

    const decoded = decodeAction(action, AGENT);
    if (decoded.kind === 'cast') {
      if (!getActionMask(this.sim, AGENT)[action]) return this.result(pending, false); // illegal: ignored
      const before = this.healths();
      this.sim.cast(AGENT, decoded.spellName, decoded.cells);
      const repeatPenalty = this.recentCasts.includes(decoded.spellName) ? REPEAT_PENALTY.penalty : 0;
      this.recentCasts = [...this.recentCasts, decoded.spellName].slice(-REPEAT_PENALTY.window);
      return this.result(pending + this.healthReward(before) - repeatPenalty, true); // blood magic costs health
    }

    const before = this.healths();
    if (!this.hasOpponentPlayedThisTurn) playOpponent(this.sim, OPPONENT, this.gameOpponent, this.random);
    const log = this.sim.endTurn();
    this.beginTurn(); // (the next turn: the opponent may cast first, its blood magic counting in this step)
    const events = log ? log.frames.flatMap(f => f.interactionEvents) : [];
    const agentCounts = countInteractions(events, AGENT);
    countInteractions(events, AGENT, this.interactions.agent);
    countInteractions(events, OPPONENT, this.interactions.opponent);
    return this.result(pending + this.healthReward(before) + this.interactionReward(agentCounts), true);
  };

  /** Interaction reward for this turn's combos, within the per-game cap. */
  private interactionReward = (counts: InteractionCounts): number => {
    const earned = (Object.keys(counts) as Array<keyof InteractionCounts>)
      .reduce((acc, key) => acc + (INTERACTION_REWARDS[key] ?? 0) * counts[key], 0) * this.interactionRewardScale;
    const reward = Math.min(earned, Math.max(0, INTERACTION_REWARDS.maxPerGame - this.interactionRewardGiven));
    this.interactionRewardGiven += reward;
    return reward;
  };

  /** The game as the agent sees it. */
  private simView = (): GameView => ({
    spells: this.sim.spells, players: this.sim.players, turnsElapsed: this.sim.turnsElapsed,
    gameOver: this.sim.gameOver, getIsOccupied: this.sim.getIsOccupied,
  });

  private healths = (): [number, number] => [this.sim.players[NpcTrainingEnv.AGENT].getHealth(), this.sim.players[NpcTrainingEnv.OPPONENT].getHealth()];

  private healthReward = ([ownBefore, opponentBefore]: [number, number]): number => {
    const [own, opponent] = this.healths();
    return ((opponentBefore - opponent) - (ownBefore - own)) / 100;
  };

  private getOutcome = (): EnvStepResult['info']['outcome'] => {
    const status = this.sim.gameOver;
    if (status === null) return null;
    if (status === GameOverStatus.PlayerWon) return 'win';
    if (status === GameOverStatus.NpcWon) return 'loss';
    if (status === GameOverStatus.BothDead) return 'draw';
    // Time's up: whoever has more health
    const [own, opponent] = this.healths();
    return own > opponent ? 'win' : own < opponent ? 'loss' : 'draw';
  };

  /** `canEndGame`: whether this step could have ended the game (the win/loss reward is given once). */
  private result = (healthReward: number, canEndGame: boolean): EnvStepResult => {
    const outcome = this.getOutcome();
    const terminalReward = !canEndGame ? 0 : outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
    const [ownHealth, opponentHealth] = this.healths();
    return {
      observation: encodeObservation({ ...this.simView(), isMovingSecond: this.hasOpponentPlayedThisTurn }, NpcTrainingEnv.AGENT),
      actionMask: getActionMask(this.sim, NpcTrainingEnv.AGENT),
      reward: healthReward + terminalReward,
      terminated: outcome !== null,
      info: {
        ownHealth, opponentHealth, turnsElapsed: this.sim.turnsElapsed, outcome, opponent: this.gameOpponent,
        interactions: { agent: { ...this.interactions.agent }, opponent: { ...this.interactions.opponent } },
      },
    };
  };
}
