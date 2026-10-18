// NpcTrainingEnv.test.ts
// The NPC's view of the game for training: observations, actions, legal-move masks, rewards.
import { describe, expect, it } from 'vitest';
import { END_TURN_ACTION, NUM_ACTIONS, NpcTrainingEnv, OBSERVATION_SIZE, decodeAction, encodeObservation, getActionMask, getActionMaskByPlanning } from './NpcTrainingEnv';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX, SpellName } from './GameSimulation';
import { CellIndex } from '../types';

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

describe('episodes', () => {
  it('reward damage dealt minus damage taken, and +1 / -1 once for a win or loss', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const env = new NpcTrainingEnv();
      let result = env.reset({ seed, opponent: 'random' });
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
