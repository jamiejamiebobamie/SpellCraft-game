// NpcTrainingEnv.test.ts
// The NPC's view of the game for training: observations, actions, legal-move masks, rewards.
import { describe, expect, it } from 'vitest';
import { BALANCE_REWARD, END_TURN_ACTION, INTERACTION_REWARDS, NUM_ACTIONS, NpcTrainingEnv, OBSERVATION_SIZE, REPEAT_PENALTY, decodeAction, encodeObservation, getActionMask, getActionMaskByPlanning } from './NpcTrainingEnv';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX, SpellName } from './GameSimulation';
import { CellIndex } from '../types';
import { Ether } from '../PlacedSpells/Spell';

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

describe('actions', () => {
  it('cover 5 spells x 36 zone rectangles, plus ending the turn', () => {
    expect(NUM_ACTIONS).toBe(181);
    expect(decodeAction(END_TURN_ACTION, PLAYER_INDEX)).toEqual({ kind: 'endTurn' });
  });

  it("land in the acting side's own zone (mirrored for the NPC)", () => {
    for (let action = 0; action < END_TURN_ACTION; action++) {
      const left = decodeAction(action, PLAYER_INDEX);
      const right = decodeAction(action, NPC_INDEX);
      if (left.kind !== 'cast' || right.kind !== 'cast') throw new Error('expected casts');
      expect(left.cells.every(c => c.j <= 2)).toBe(true);
      expect(right.cells.every(c => c.j >= 4)).toBe(true);
      expect(right.cells.map(c => ({ i: c.i, j: 6 - c.j }))).toEqual(left.cells);
    }
  });

  it('the fast legal-move mask matches fully planning every cast', () => {
    const env = new NpcTrainingEnv();
    for (let seed = 1; seed <= 20; seed++) {
      let result = env.reset({ seed });
      const rand = mulberry32(seed);
      while (!result.terminated) {
        [PLAYER_INDEX, NPC_INDEX].forEach(side => {
          expect(getActionMask(env.sim, side), `seed ${seed}`).toEqual(getActionMaskByPlanning(env.sim, side));
        });
        const legal = result.actionMask.map((ok, a) => ok ? a : -1).filter(a => a >= 0);
        result = env.step(legal[Math.floor(rand() * legal.length)]);
      }
    }
  });

  it('are only legal with focus left and a free cell under the drawing', () => {
    const sim = new GameSimulation();
    expect(getActionMask(sim, PLAYER_INDEX).filter(Boolean)).toHaveLength(NUM_ACTIONS); // empty board
    sim.cast(PLAYER_INDEX, 'Ether', [{ i: 0, j: 0 }]);
    const mask = getActionMask(sim, PLAYER_INDEX);
    const singleCellAt00 = Array.from({ length: END_TURN_ACTION }, (_, a) => a).filter(a => {
      const d = decodeAction(a, PLAYER_INDEX);
      return d.kind === 'cast' && d.cells.length === 1 && d.cells[0].i === 0 && d.cells[0].j === 0;
    });
    expect(singleCellAt00.every(a => !mask[a])).toBe(true); // occupied now
    sim.players[PLAYER_INDEX].depleteFocusToZero();
    expect(getActionMask(sim, PLAYER_INDEX).filter(Boolean)).toHaveLength(1); // only ending the turn
  });

  it("never include a cast whose blood magic would kill the caster", () => {
    const sim = new GameSimulation();
    const caster = sim.players[PLAYER_INDEX];
    caster.decrementHealth(caster.getHealth() - 6); // 6 health, 4 focus: 1 missing focus point costs 5
    const mask = getActionMask(sim, PLAYER_INDEX);
    const legalCasts = Array.from({ length: END_TURN_ACTION }, (_, a) => a).filter(a => mask[a]).map(a => decodeAction(a, PLAYER_INDEX));
    // A single Phlegm costs 1 (legal); a Fireball needing 2 focus more than the caster has costs 10 health
    // of its 6, so none that big is legal
    expect(legalCasts.some(d => d.kind === 'cast' && d.spellName === 'Phlegm' && d.cells.length === 1)).toBe(true);
    expect(legalCasts.every(d => d.kind !== 'cast' || !(d.spellName === 'Ether' && d.cells.length * Ether.FOCUS_COST >= 6))).toBe(true);
  });
});

describe('observations', () => {
  it('have a fixed size, with every value in [0, 1]', () => {
    const env = new NpcTrainingEnv();
    let result = env.reset({ seed: 1 });
    const rand = mulberry32(1);
    while (!result.terminated) {
      expect(result.observation).toHaveLength(OBSERVATION_SIZE);
      expect(result.observation.every(v => v >= 0 && v <= 1)).toBe(true);
      const legal = result.actionMask.map((ok, a) => ok ? a : -1).filter(a => a >= 0);
      result = env.step(legal[Math.floor(rand() * legal.length)]);
    }
  });

  it('are the same from either side of a mirrored board (so a left-side agent can play the NPC)', () => {
    const SPELLS: Array<SpellName> = ['Phlegm', 'Ether', 'Quicken', 'GyreUp', 'GyreDown'];
    for (let seed = 1; seed <= 50; seed++) {
      const rand = mulberry32(seed);
      const board = new GameSimulation({ random: () => 0.99 });
      const mirrored = new GameSimulation({ random: () => 0.99 });
      for (let turn = 0; turn < 4; turn++) {
        [PLAYER_INDEX, NPC_INDEX].forEach(side => {
          const zoneJ = side === PLAYER_INDEX ? 0 : 4;
          const w = 1 + Math.floor(rand() * 3), h = 1 + Math.floor(rand() * 3);
          const i = Math.floor(rand() * (4 - h)), j = zoneJ + Math.floor(rand() * (4 - w));
          const cells: Array<CellIndex> = Array.from({ length: w * h }, (_, k) => ({ i: i + Math.floor(k / w), j: j + (k % w) }));
          const spellName = SPELLS[Math.floor(rand() * 5)];
          board.cast(side, spellName, cells);
          mirrored.cast(1 - side, spellName, cells.map(c => ({ i: c.i, j: 6 - c.j })));
        });
        board.endTurn();
        mirrored.endTurn();
        expect(encodeObservation(mirrored, NPC_INDEX), `seed ${seed}`).toEqual(encodeObservation(board, PLAYER_INDEX));
        expect(getActionMask(mirrored, NPC_INDEX), `seed ${seed}`).toEqual(getActionMask(board, PLAYER_INDEX));
      }
    }
  });
});

describe('interactions (combos)', () => {
  const { AGENT, OPPONENT } = NpcTrainingEnv;

  /** Sets up a board with `setup`, then plays `turns` turns with no other casts. */
  const playOut = (setup: (sim: GameSimulation) => void, turns: number = 6) => {
    const env = new NpcTrainingEnv();
    let result = env.reset({ seed: 1, opponent: 'none' });
    env.sim.players.forEach(p => p.decrementFocus(-4)); // plenty of focus for the setup
    setup(env.sim);
    let totalReward = 0;
    for (let t = 0; t < turns && !result.terminated; t++) {
      result = env.step(END_TURN_ACTION);
      totalReward += result.reward;
    }
    return { ...result.info.interactions, totalReward, info: result.info };
  };

  it("counts the agent's Phlegm reflecting an enemy spell (for both sides)", () => {
    const { agent, opponent } = playOut(sim => {
      sim.cast(AGENT, 'Phlegm', [{ i: 0, j: 1 }, { i: 1, j: 2 }]); // 2x2
      sim.cast(OPPONENT, 'Ether', [{ i: 0, j: 4 }]);
    });
    expect(agent.reflectedEnemySpells).toBe(1);
    expect(opponent.reflectedByEnemy).toBe(1);
  });

  it("counts the agent's spell finishing a lift on the board (a Quicken sent through a Gyre)", () => {
    const { agent, opponent } = playOut(sim => {
      sim.cast(AGENT, 'Quicken', [{ i: 1, j: 2 }]); // power 5
      sim.cast(OPPONENT, 'GyreDown', [{ i: 1, j: 4 }]); // power 4: lifts it down to row 2
    });
    expect(agent.ownSpellsLiftedByEnemyGyres).toBe(1);
    expect(agent.ownSpellsLiftedSafely).toBe(1);
    expect(opponent.liftsByOwnGyres).toBe(1);
  });

  it("counts the agent's Gyre pushing an enemy spell off the board", () => {
    const { agent } = playOut(sim => {
      sim.cast(AGENT, 'GyreUp', [{ i: 0, j: 2 }]); // on the top row: lifts to row -1
      sim.cast(OPPONENT, 'Ether', [{ i: 0, j: 4 }]);
    });
    expect(agent.liftsByOwnGyres).toBe(1);
    expect(agent.enemySpellsLiftedOffBoard).toBe(1);
    expect(agent.ownSpellsLiftedSafely).toBe(0);
  });

  it('counts buffs from enemy spells', () => {
    const { agent, opponent } = playOut(sim => {
      sim.cast(AGENT, 'Ether', [{ i: 2, j: 2 }]); // power 10
      sim.cast(OPPONENT, 'Quicken', [{ i: 2, j: 4 }]); // power 5: absorbed, electrifying the Ether
    });
    expect(agent.buffsFromEnemySpells).toBe(1);
    expect(opponent.buffsFromEnemySpells).toBe(0);
  });

  it('rewards combos only when turned on, capped per game below a win', () => {
    const setup = (sim: GameSimulation) => {
      sim.cast(AGENT, 'Ether', [{ i: 2, j: 2 }]);
      sim.cast(OPPONENT, 'Quicken', [{ i: 2, j: 4 }]);
    };
    const off = playOut(setup, 1).totalReward;
    INTERACTION_REWARDS.buffsFromEnemySpells = 0.1;
    expect(playOut(setup, 1).totalReward).toBeCloseTo(off + 0.1, 9);
    INTERACTION_REWARDS.buffsFromEnemySpells = 10;
    expect(playOut(setup, 1).totalReward).toBeCloseTo(off + INTERACTION_REWARDS.maxPerGame, 9);
    INTERACTION_REWARDS.buffsFromEnemySpells = 0;
  });
});

describe('episodes', () => {
  it('alternate who moves first each turn: the agent moves second on odd turns (turnsElapsed 0, 2, ...)', () => {
    const env = new NpcTrainingEnv();
    let result = env.reset({ seed: 5, opponent: 'none' });
    const isMovingSecond = () => result.observation[OBSERVATION_SIZE - 1];
    for (let turn = 0; turn < 6 && !result.terminated; turn++) {
      expect(isMovingSecond(), `turnsElapsed ${result.info.turnsElapsed}`).toBe(result.info.turnsElapsed % 2 === 0 ? 1 : 0);
      result = env.step(END_TURN_ACTION);
    }
  });

  it('reward damage dealt minus damage taken, and +1 / -1 once for a win or loss', () => {
    // (just the health and win rewards: the combo rewards, repeat penalty and balance reward off)
    const repeatPenalty = REPEAT_PENALTY.penalty, balanceScale = BALANCE_REWARD.scale;
    REPEAT_PENALTY.penalty = 0;
    BALANCE_REWARD.scale = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const env = new NpcTrainingEnv();
      let result = env.reset({ seed, opponent: 'random', interactionRewardScale: 0 });
      const rand = mulberry32(seed);
      let totalReward = 0, steps = 0;
      while (!result.terminated) {
        const legal = result.actionMask.map((ok, a) => ok ? a : -1).filter(a => a >= 0);
        result = env.step(legal[Math.floor(rand() * legal.length)]);
        totalReward += result.reward;
        steps++;
        expect(steps, `seed ${seed}`).toBeLessThan(2000);
      }
      const { ownHealth, opponentHealth, outcome } = result.info;
      const terminal = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
      expect(totalReward, `seed ${seed}`).toBeCloseTo((100 - opponentHealth - (100 - ownHealth)) / 100 + terminal, 9);
      expect(env.step(END_TURN_ACTION).reward).toBe(0); // nothing more once the game is over
    }
    REPEAT_PENALTY.penalty = repeatPenalty;
    BALANCE_REWARD.scale = balanceScale;
  });

  const castOf = (spellName: SpellName, row: number) => Array.from({ length: END_TURN_ACTION }, (_, a) => a)
    .find(a => { const d = decodeAction(a, PLAYER_INDEX); return d.kind === 'cast' && d.spellName === spellName && d.cells.length === 1 && d.cells[0].i === row; })!;

  it('penalize casting the same spell as one of the last few casts, whatever its size or place (an Updraft and a Downdraft as one)', () => {
    const balanceScale = BALANCE_REWARD.scale;
    BALANCE_REWARD.scale = 0;
    const env = new NpcTrainingEnv();
    env.reset({ seed: 3, opponent: 'none', interactionRewardScale: 0 });
    expect(env.step(castOf('Phlegm', 0)).reward).toBeCloseTo(0, 9);
    expect(env.step(castOf('Quicken', 1)).reward).toBeCloseTo(0, 9); // a different spell: no penalty
    expect(env.step(castOf('Phlegm', 2)).reward).toBeCloseTo(-REPEAT_PENALTY.penalty, 9); // again, elsewhere

    const gyres = new NpcTrainingEnv();
    gyres.reset({ seed: 3, opponent: 'none', interactionRewardScale: 0 });
    expect(gyres.step(castOf('GyreUp', 0)).reward).toBeCloseTo(0, 9);
    expect(gyres.step(castOf('GyreDown', 1)).reward).toBeCloseTo(-REPEAT_PENALTY.penalty, 9);
    BALANCE_REWARD.scale = balanceScale;
  });

  it('reward casting an underused spell a little, and an overused one costs a little (BALANCE_REWARD)', () => {
    const repeatPenalty = REPEAT_PENALTY.penalty;
    REPEAT_PENALTY.penalty = 0;
    const env = new NpcTrainingEnv();
    env.reset({ seed: 3, opponent: 'none', interactionRewardScale: 0 });
    const k = BALANCE_REWARD.scale;
    expect(env.step(castOf('Phlegm', 0)).reward).toBeCloseTo(0, 9); // (shares start even)
    expect(env.step(castOf('Phlegm', 1)).reward).toBeCloseTo(k * (1 / 5 - 2 / 6), 9); // overused
    expect(env.step(castOf('Ether', 2)).reward).toBeCloseTo(k * (1 / 5 - 1 / 7), 9); // underused
    REPEAT_PENALTY.penalty = repeatPenalty;
  });

  it('ignore illegal actions', () => {
    const env = new NpcTrainingEnv();
    env.reset({ seed: 3 });
    env.sim.players[NpcTrainingEnv.AGENT].depleteFocusToZero();
    const before = env.sim.spells.length;
    env.step(0); // a cast, but no focus
    expect(env.sim.spells.length).toBe(before);
  });
});
