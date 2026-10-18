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
import { planSpellPlacement } from './gameRules';

const ROWS = GameBoard.NUM_ROWS;
const COLS = GameBoard.NUM_COLS;
const ZONE = GameBoard.NUM_PLACEMENT_CELLS;

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

/**
 * Which actions `side` may take now. Ending the turn is always allowed; casting needs the game to
 * be on, the caster alive with some focus left, and at least one free cell under the drawing
 * (every spell type can fill a single free cell). Equivalent to getActionMaskByPlanning, but fast.
 */
export const getActionMask = (sim: GameSimulation, side: number): Array<boolean> => {
  const caster = sim.players[side];
  const canCast = sim.gameOver === null && !caster.getIsDead() && caster.getFocus() > 0;
  const mask = new Array<boolean>(NUM_ACTIONS).fill(false);
  mask[END_TURN_ACTION] = true;
  if (!canCast) return mask;

  const isFree = Array.from({ length: ROWS }, (_, i) => Array.from({ length: ZONE }, (_, j) => !sim.getIsOccupied({ i, j: toSideColumn(j, side) })));
  ZONE_RECTS.forEach((rect, r) => {
    let hasFreeCell = false;
    for (let dr = 0; dr < rect.h && !hasFreeCell; dr++) for (let dc = 0; dc < rect.w; dc++) if (isFree[rect.i + dr][rect.j + dc]) hasFreeCell = true;
    if (hasFreeCell) SPELL_ORDER.forEach((_, s) => { mask[s * ZONE_RECTS.length + r] = true; });
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
    return planSpellPlacement(SPELL_CLASSES[decoded.spellName], decoded.cells, caster.getDirection(), sim.getIsOccupied).length > 0;
  });
};

// --- Observation -------------------------------------------------------------------------------

const CHANNELS = [
  // spell type, moving toward the opponent (5), then toward the agent (5)
  'Phlegm>', 'Ether>', 'Quicken>', 'GyreUp>', 'GyreDown>',
  'Phlegm<', 'Ether<', 'Quicken<', 'GyreUp<', 'GyreDown<',
  'power', 'onFire', 'electrified', 'empowered', 'width', 'height',
] as const;
const SCALARS = ['ownHealth', 'opponentHealth', 'ownFocus', 'opponentFocus', 'turnsElapsed'] as const;

export const OBSERVATION_SIZE = ROWS * COLS * CHANNELS.length + SCALARS.length;

const SPELL_TYPES = [Phlegm, Ether, Quicken, GyreUp, GyreDown];

/**
 * What `side` sees, as numbers in [0, 1]: for each board cell (from its own side: its zone on the
 * left), the spell covering it, then health, focus, and the clock.
 */
export const encodeObservation = (sim: GameSimulation, side: number): Array<number> => {
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
  [own.getHealth() / 100, opponent.getHealth() / 100, own.getFocus() / maxFocus, opponent.getFocus() / maxFocus, sim.turnsElapsed / 72]
    .forEach((value, k) => { obs[ROWS * COLS * CHANNELS.length + k] = value; });
  return obs;
};

// --- Opponents ---------------------------------------------------------------------------------

export type OpponentName = 'none' | 'random';

/** Plays the opponent's casts for one turn. */
const playOpponent = (sim: GameSimulation, side: number, opponent: OpponentName, random: () => number): void => {
  if (opponent === 'none') return;
  // 'random': one random legal cast most turns, like the original NPC
  if (random() >= 0.7) return;
  const mask = getActionMask(sim, side);
  const legalCasts = mask.map((ok, action) => ok && action !== END_TURN_ACTION ? action : -1).filter(a => a >= 0);
  if (!legalCasts.length) return;
  const decoded = decodeAction(legalCasts[Math.floor(random() * legalCasts.length)], side);
  if (decoded.kind === 'cast') sim.cast(side, decoded.spellName, decoded.cells);
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
  enemySpellsLiftedOffBoard: number; // its Gyre pushed an enemy spell off the board
  buffsFromEnemySpells: number; // its spell absorbed an enemy Ether/Quicken
  buffsFromOwnSpells: number; // its spell absorbed its own Ether/Quicken
};

const emptyCounts = (): InteractionCounts => ({
  reflectedEnemySpells: 0, selfHeals: 0, reflectedOwnSpells: 0, reflectedByEnemy: 0,
  liftsByOwnGyres: 0, ownSpellsLiftedByEnemyGyres: 0, ownSpellsLiftedSafely: 0, enemySpellsLiftedOffBoard: 0,
  buffsFromEnemySpells: 0, buffsFromOwnSpells: 0,
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
      else if (e.gyreSide === side && e.spellSide !== side && !e.isSurvived) counts.enemySpellsLiftedOffBoard++;
    } else if (e.consumerSide === side) {
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
  enemySpellsLiftedOffBoard: 0,
  buffsFromEnemySpells: 0,
  buffsFromOwnSpells: 0,
  maxPerGame: 0.5,
};

// --- Environment -------------------------------------------------------------------------------

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
 * One game, from the agent's side (the left). Each step the agent casts a spell or ends its turn;
 * ending the turn lets the opponent cast, then moves the spells.
 *
 * Reward: (damage dealt - damage taken) / 100 each turn (healing counts the other way), plus +1 for
 * a win and -1 for a loss, plus any interaction rewards (INTERACTION_REWARDS, off by default).
 */
export class NpcTrainingEnv {
  static readonly AGENT = PLAYER_INDEX;
  static readonly OPPONENT = NPC_INDEX;

  sim: GameSimulation = new GameSimulation();
  private opponent: OpponentName = 'random';
  private random: () => number = Math.random;
  private interactionRewardScale: number = 1;
  private interactionRewardGiven: number = 0;
  private interactions = { agent: emptyCounts(), opponent: emptyCounts() };

  reset = ({ seed, opponent, interactionRewardScale }: EnvOptions = {}): EnvStepResult => {
    this.random = seed === undefined ? Math.random : mulberry32(seed);
    this.opponent = opponent ?? this.opponent;
    this.interactionRewardScale = interactionRewardScale ?? this.interactionRewardScale;
    this.interactionRewardGiven = 0;
    this.interactions = { agent: emptyCounts(), opponent: emptyCounts() };
    this.sim = new GameSimulation({ random: this.random });
    return this.result(0, false);
  };

  step = (action: number): EnvStepResult => {
    const { AGENT, OPPONENT } = NpcTrainingEnv;
    if (this.sim.gameOver !== null) return this.result(0, false); // already over

    const decoded = decodeAction(action, AGENT);
    if (decoded.kind === 'cast') {
      if (!getActionMask(this.sim, AGENT)[action]) return this.result(0, false); // illegal: ignored
      const before = this.healths();
      this.sim.cast(AGENT, decoded.spellName, decoded.cells);
      return this.result(this.healthReward(before), true); // blood magic costs health
    }

    const before = this.healths();
    playOpponent(this.sim, OPPONENT, this.opponent, this.random);
    const log = this.sim.endTurn();
    const events = log ? log.frames.flatMap(f => f.interactionEvents) : [];
    const agentCounts = countInteractions(events, AGENT);
    countInteractions(events, AGENT, this.interactions.agent);
    countInteractions(events, OPPONENT, this.interactions.opponent);
    return this.result(this.healthReward(before) + this.interactionReward(agentCounts), true);
  };

  /** Interaction reward for this turn's combos, within the per-game cap. */
  private interactionReward = (counts: InteractionCounts): number => {
    const earned = (Object.keys(counts) as Array<keyof InteractionCounts>)
      .reduce((acc, key) => acc + (INTERACTION_REWARDS[key] ?? 0) * counts[key], 0) * this.interactionRewardScale;
    const reward = Math.min(earned, Math.max(0, INTERACTION_REWARDS.maxPerGame - this.interactionRewardGiven));
    this.interactionRewardGiven += reward;
    return reward;
  };

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
      observation: encodeObservation(this.sim, NpcTrainingEnv.AGENT),
      actionMask: getActionMask(this.sim, NpcTrainingEnv.AGENT),
      reward: healthReward + terminalReward,
      terminated: outcome !== null,
      info: {
        ownHealth, opponentHealth, turnsElapsed: this.sim.turnsElapsed, outcome,
        interactions: { agent: { ...this.interactions.agent }, opponent: { ...this.interactions.opponent } },
      },
    };
  };
}
