// scriptedOpponent.test.ts
// The rule-based opponent used for training and benchmarking.
import { describe, expect, it } from 'vitest';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX } from './GameSimulation';
import { NpcTrainingEnv, END_TURN_ACTION } from './NpcTrainingEnv';
import { playScriptedTurn } from './scriptedOpponent';
import { GameOverStatus } from '../types';

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const noRandomCasts = () => { throw new Error('should not cast randomly at 0% random moves'); };

describe('scripted opponent', () => {
  it('never pays for spells with blood magic', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const sim = new GameSimulation({ random: mulberry32(seed) });
      while (sim.gameOver === null) {
        [PLAYER_INDEX, NPC_INDEX].forEach(side => {
          const healthBefore = sim.players[side].getHealth();
          playScriptedTurn(sim, side, mulberry32(seed), 0, noRandomCasts);
          expect(sim.players[side].getHealth(), `seed ${seed}`).toBe(healthBefore); // casting alone never costs health
        });
        sim.endTurn();
      }
    }
  });

  it('defends a threatened row', () => {
    const sim = new GameSimulation();
    sim.cast(PLAYER_INDEX, 'Ether', [{ i: 1, j: 2 }]); // heading at the NPC's middle row
    playScriptedTurn(sim, NPC_INDEX, () => 0.99, 0, noRandomCasts);
    const npcSpellsInRow1 = sim.spells.filter(s => s.caster === sim.players[NPC_INDEX] && s.cellIndex.i === 1);
    expect(npcSpellsInRow1.length).toBeGreaterThan(0);
  });

  it('beats the random opponent almost every time', () => {
    let wins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed);
      const env = new NpcTrainingEnv();
      env.reset({ seed, opponent: 'random' });
      // The scripted player plays the agent's side; the env's random opponent plays the other
      while (env.sim.gameOver === null) {
        playScriptedTurn(env.sim, NpcTrainingEnv.AGENT, random, 0, noRandomCasts);
        env.step(END_TURN_ACTION);
      }
      const [own, opponent] = env.sim.players.map(p => p.getHealth());
      if (env.sim.gameOver === GameOverStatus.PlayerWon || (env.sim.gameOver === GameOverStatus.TimesUp && own > opponent)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(90);
  });
});

describe('scripted opponent variety', () => {
  it("doesn't play the same game every time (a fixed agent must face different games)", () => {
    const playOut = (seed: number) => {
      const env = new NpcTrainingEnv();
      env.reset({ seed, opponent: 'scripted' });
      const history: Array<string> = [];
      for (let t = 0; t < 10 && env.sim.gameOver === null; t++) {
        env.sim.cast(NpcTrainingEnv.AGENT, 'Ether', [{ i: t % 3, j: 2 }]); // the same agent moves every game
        env.step(END_TURN_ACTION);
        history.push(env.sim.spells.map(s => `${s.getSpellName()}${s.cellIndex.i},${s.cellIndex.j}`).sort().join(' '));
      }
      return history.join('|');
    };
    const distinctGames = new Set(Array.from({ length: 10 }, (_, k) => playOut(k + 1)));
    expect(distinctGames.size).toBeGreaterThan(5);
  });
});

describe("'mixed' opponent", () => {
  it('picks a different opponent from game to game, and reports which', () => {
    const env = new NpcTrainingEnv();
    const picked = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) picked.add(env.reset({ seed, opponent: 'mixed' }).info.opponent);
    expect([...picked].sort()).toEqual(['random', 'scripted', 'scriptedNormal']);
  });
});
