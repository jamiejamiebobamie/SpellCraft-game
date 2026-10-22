// GameSimulation.test.ts
// Saved scenarios for the headless game (casting, focus, health, turns). Run: npm test
import { describe, expect, it } from 'vitest';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX, SpellName } from './GameSimulation';
import { GameOverStatus, CellIndex } from '../types';
import { CAUGHT_RULES, SUNRISE_TURNS, getCaughtGameOver, getFocusCost, getIsTimeUp } from './gameRules';
import { Player } from '../Player/Player';
import { Ether } from '../PlacedSpells/Spell';
import { CASTING_RULES, PLAYER_RULES } from '../PlacedSpells/spellRules';
import { GameBoard } from '../GameBoard/GameBoard';

/** All cells of a rectangle, as if a drawing touched them. */
const cellsOf = (i: number, j: number, w: number, h: number): Array<CellIndex> =>
  Array.from({ length: h * w }, (_, k) => ({ i: i + Math.floor(k / w), j: j + (k % w) }));

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

describe('casting', () => {
  it('rounds a fractional cast cost as CASTING_RULES.costRounding says, never below 1', () => {
    const rounding = CASTING_RULES.costRounding;
    const Fractional = { ...Ether, spellName: 'Ether', FOCUS_COST: 1.5 } as unknown as typeof Ether;
    CASTING_RULES.costRounding = 'floor';
    expect([1, 2, 3, 4, 6, 9].map(n => getFocusCost(Fractional, n))).toEqual([1, 3, 4, 6, 9, 13]);
    CASTING_RULES.costRounding = 'ceil';
    expect([1, 2, 3, 4, 6, 9].map(n => getFocusCost(Fractional, n))).toEqual([2, 3, 5, 6, 9, 14]);
    CASTING_RULES.costRounding = rounding;
  });

  it('a drawing becomes the largest allowed shapes, and costs focus', () => {
    const sim = new GameSimulation();
    const { placed, focusCost, bloodMagicCost } = sim.cast(PLAYER_INDEX, 'Ether', cellsOf(0, 0, 2, 2));
    expect(placed.map(s => [s.widthCells, s.heightCells])).toEqual([[2, 2]]);
    // (4 cells at Ether's cost each; the caster has 4 focus, and pays any more in health)
    const cost = 4 * Ether.FOCUS_COST, missing = Math.max(0, cost - 4);
    expect(focusCost).toBe(cost);
    expect(bloodMagicCost).toBe(missing * PLAYER_RULES.bloodMagicHealthPerFocus);
    expect(sim.players[PLAYER_INDEX].getFocus()).toBe(Math.max(0, 4 - cost));
    expect(sim.players[PLAYER_INDEX].getHealth()).toBe(100 - missing * PLAYER_RULES.bloodMagicHealthPerFocus);
  });

  it.runIf(CASTING_RULES.maxFocusCostPerCast === null)('costs focus per cell (cost x cells), with no cap', () => {
    const costOf = (spellName: SpellName, cells: Array<CellIndex>) => new GameSimulation().cast(PLAYER_INDEX, spellName, cells).focusCost;
    expect(costOf('Ether', cellsOf(0, 0, 1, 1))).toBe(getFocusCost(Ether, 1));
    expect(costOf('Ether', cellsOf(0, 0, 3, 3))).toBe(getFocusCost(Ether, 9));
    expect(costOf('Phlegm', cellsOf(0, 0, 2, 2))).toBe(4);
    expect(costOf('Phlegm', cellsOf(0, 0, 3, 3))).toBe(9);
    expect(costOf('GyreUp', cellsOf(0, 0, 3, 3))).toBe(9); // three 3-tall Gyres
    expect(costOf('Quicken', cellsOf(0, 0, 3, 1))).toBe(3);
    expect(costOf('Quicken', cellsOf(0, 0, 3, 3))).toBe(9);
    // The same whether drawn as one shape or as pieces (e.g. a 2x2 next to a 1x1)
    const sim = new GameSimulation();
    sim.cast(PLAYER_INDEX, 'Phlegm', [{ i: 0, j: 0 }]);
    expect(sim.cast(PLAYER_INDEX, 'Ether', cellsOf(0, 0, 2, 2)).focusCost).toBe(getFocusCost(Ether, 3)); // three 1x1s
  });

  it("only cells in the caster's own 3x3 zone are used", () => {
    const sim = new GameSimulation();
    expect(sim.cast(PLAYER_INDEX, 'Phlegm', [{ i: 0, j: 5 }]).placed).toHaveLength(0); // NPC's zone
    expect(sim.cast(NPC_INDEX, 'Phlegm', [{ i: 0, j: 5 }]).placed).toHaveLength(1);
  });

  it('occupied cells are skipped', () => {
    const sim = new GameSimulation();
    sim.cast(PLAYER_INDEX, 'Quicken', [{ i: 1, j: 1 }]);
    const { placed } = sim.cast(PLAYER_INDEX, 'Quicken', cellsOf(1, 0, 3, 1));
    expect(placed.map(s => s.cellIndex.j)).toEqual([0, 2]);
  });
});

describe('turns', () => {
  it('a spell that reaches the other side damages that player', () => {
    const sim = new GameSimulation({ random: () => 0.99 });
    sim.cast(NPC_INDEX, 'Ether', [{ i: 1, j: 4 }]); // 1x1 Ether: speed 1, power 10
    for (let t = 0; t < 4; t++) sim.endTurn();
    expect(sim.players[PLAYER_INDEX].getHealth()).toBe(100);
    sim.endTurn(); // column 4 -> 0 over four turns, off the board on the fifth
    expect(sim.players[PLAYER_INDEX].getHealth()).toBe(90);
  });

  it('focus regenerates each turn (by the regen amount), up to 8', () => {
    const sim = new GameSimulation({ random: () => 0.99 });
    const regen = -sim.players[PLAYER_INDEX].getFocusRegenAmt();
    sim.endTurn();
    expect(sim.players[PLAYER_INDEX].getFocus()).toBe(Math.min(8, 4 + regen));
    sim.endTurn(); sim.endTurn();
    expect(sim.players[PLAYER_INDEX].getFocus()).toBe(8);
  });

  it('time runs out at sunrise at the latest', () => {
    const sim = new GameSimulation({ random: () => 0.99 }); // never caught early
    while (sim.gameOver === null) sim.endTurn();
    expect(sim.gameOver).toBe(GameOverStatus.TimesUp);
    expect(sim.turnsElapsed).toBe(SUNRISE_TURNS);
  });

  it('a teacher may catch them from CAUGHT_RULES.firstTurn, likelier each turn, and surely at sunrise', () => {
    const { firstTurn, chanceStep } = CAUGHT_RULES;
    expect(getIsTimeUp(firstTurn - 1, () => 0)).toBe(false); // (never before)
    expect(getIsTimeUp(firstTurn, () => chanceStep - 1e-9)).toBe(true);
    expect(getIsTimeUp(firstTurn, () => chanceStep)).toBe(false);
    expect(getIsTimeUp(firstTurn + 4, () => chanceStep * 5 - 1e-9)).toBe(true); // 5% four turns on
    expect(getIsTimeUp(SUNRISE_TURNS, () => 0.999)).toBe(true);
  });

  it('a teacher catches the weaker wizard (both, if even)', () => {
    const player = new Player(1, ''), npc = new Player(-1, '');
    player.reset(); npc.reset();
    expect(getCaughtGameOver(player, npc)).toBe(GameOverStatus.TimesUp);
    player.healthAmt -= 10;
    expect(getCaughtGameOver(player, npc)).toBe(GameOverStatus.CaughtPlayer);
    npc.healthAmt -= 20;
    expect(getCaughtGameOver(player, npc)).toBe(GameOverStatus.CaughtNpc);
  });

  it('a player who dies ends the game', () => {
    const sim = new GameSimulation({ random: () => 0.99 });
    sim.players[NPC_INDEX].decrementHealth(95);
    sim.cast(PLAYER_INDEX, 'Ether', [{ i: 0, j: 2 }]);
    while (sim.gameOver === null) sim.endTurn();
    expect(sim.gameOver).toBe(GameOverStatus.PlayerWon);
  });
});

describe('random games', () => {
  const SPELLS: Array<SpellName> = ['Phlegm', 'Ether', 'Quicken', 'GyreUp', 'GyreDown'];

  /** Plays a whole game of random casts; returns each turn's health and focus. */
  const playRandomGame = (seed: number) => {
    const rand = mulberry32(seed);
    const sim = new GameSimulation({ random: rand });
    const history: Array<Array<number>> = [];
    while (sim.gameOver === null) {
      [PLAYER_INDEX, NPC_INDEX].forEach(playerIndex => {
        if (rand() < 0.6) {
          const zoneJ = playerIndex === PLAYER_INDEX ? 0 : 4;
          const w = 1 + Math.floor(rand() * 3), h = 1 + Math.floor(rand() * 3);
          const i = Math.floor(rand() * (4 - h)), j = zoneJ + Math.floor(rand() * (4 - w));
          sim.cast(playerIndex, SPELLS[Math.floor(rand() * 5)], cellsOf(i, j, w, h));
        }
      });
      sim.endTurn();
      history.push(sim.players.flatMap(p => [p.getHealth(), p.getFocus()]));
    }
    return { sim, history };
  };

  it('always end, with health and focus in range', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { sim, history } = playRandomGame(seed);
      expect(sim.gameOver, `seed ${seed}`).not.toBeNull();
      expect(sim.turnsElapsed, `seed ${seed}`).toBeLessThanOrEqual(SUNRISE_TURNS);
      history.forEach(([playerHealth, playerFocus, npcHealth, npcFocus]) => {
        [playerHealth, npcHealth].forEach(h => expect(h >= 0 && h <= 100, `seed ${seed}`).toBe(true));
        [playerFocus, npcFocus].forEach(f => expect(f >= 0 && f <= 8, `seed ${seed}`).toBe(true));
      });
    }
  });

  it('are deterministic for a given seed', () => {
    expect(playRandomGame(42).history).toEqual(playRandomGame(42).history);
  });

  it('are fair: mirroring every cast onto the other side mirrors the whole game', () => {
    /** A random game; if mirrored, each cast is made by the other player, flipped left-right. */
    const playGame = (seed: number, isMirrored: boolean) => {
      const rand = mulberry32(seed);
      const sim = new GameSimulation({ random: rand });
      const history: Array<Array<number>> = [];
      while (sim.gameOver === null) {
        [PLAYER_INDEX, NPC_INDEX].forEach(playerIndex => {
          if (rand() >= 0.6) return;
          const zoneJ = playerIndex === PLAYER_INDEX ? 0 : 4;
          const w = 1 + Math.floor(rand() * 3), h = 1 + Math.floor(rand() * 3);
          const i = Math.floor(rand() * (4 - h)), j = zoneJ + Math.floor(rand() * (4 - w));
          const spellName = SPELLS[Math.floor(rand() * 5)];
          const cells = cellsOf(i, j, w, h);
          if (isMirrored) sim.cast(1 - playerIndex, spellName, cells.map(c => ({ i: c.i, j: 6 - c.j })));
          else sim.cast(playerIndex, spellName, cells);
        });
        sim.endTurn();
        const [left, right] = isMirrored ? [sim.players[NPC_INDEX], sim.players[PLAYER_INDEX]] : sim.players;
        history.push([left.getHealth(), left.getFocus(), right.getHealth(), right.getFocus()]);
      }
      return history;
    };
    for (let seed = 1; seed <= 200; seed++) {
      expect(playGame(seed, true), `seed ${seed}`).toEqual(playGame(seed, false));
    }
  });
});

describe('casting rules (CASTING_RULES)', () => {
  /** An enemy (NPC) spell placed by hand, e.g. one that has reached the player's side. */
  const placeNpcSpell = (sim: GameSimulation, SpellType: typeof Ether, cell: CellIndex) => {
    const spell = new SpellType(sim.players[NPC_INDEX]);
    spell.setCellIndex(cell);
    sim.spells.push(spell);
    return spell;
  };

  it.runIf(CASTING_RULES.maxQuickenCellsPerCast === 3)('a Quicken cast fills at most 3 cells, the touched ones first', () => {
    const sim = new GameSimulation();
    sim.cast(PLAYER_INDEX, 'Quicken', [{ i: 0, j: 0 }, { i: 1, j: 1 }, { i: 2, j: 2 }]); // a diagonal: a 3x3 box
    const cells = sim.spells.flatMap(s => cellsOf(s.cellIndex.i, s.cellIndex.j, s.widthCells, s.heightCells));
    expect(cells).toHaveLength(3);
    expect(cells).toEqual(expect.arrayContaining([{ i: 0, j: 0 }, { i: 1, j: 1 }, { i: 2, j: 2 }]));
  });

  it.runIf(CASTING_RULES.canCastOntoEnemiesBesideWizard)('a spell cast onto an enemy spell beside the wizard collides at once', () => {
    const sim = new GameSimulation();
    placeNpcSpell(sim, Ether, { i: 1, j: 0 });
    const { placed } = sim.cast(PLAYER_INDEX, 'Ether', [{ i: 1, j: 0 }]);
    expect(placed).toHaveLength(1);
    expect(sim.spells).toHaveLength(0); // equal Ethers destroy each other
    sim.endTurn();
    expect(sim.players[PLAYER_INDEX].getHealth()).toBe(100);
  });

  it.runIf(CASTING_RULES.canCastOntoEnemiesBesideWizard)('a Phlegm cast onto an enemy spell beside the wizard stops it hitting', () => {
    const sim = new GameSimulation();
    placeNpcSpell(sim, Ether, { i: 1, j: 0 });
    sim.cast(PLAYER_INDEX, 'Phlegm', [{ i: 1, j: 0 }]);
    sim.endTurn();
    expect(sim.players[PLAYER_INDEX].getHealth()).toBe(100);
  });

  it('never onto other spells (beside the wizard: only enemy spells, if CASTING_RULES allows)', () => {
    const sim = new GameSimulation();
    placeNpcSpell(sim, Ether, { i: 1, j: 1 });
    expect(sim.cast(PLAYER_INDEX, 'Ether', [{ i: 1, j: 1 }]).placed).toHaveLength(0);
    sim.cast(PLAYER_INDEX, 'Ether', [{ i: 0, j: 0 }]);
    expect(sim.cast(PLAYER_INDEX, 'Phlegm', [{ i: 0, j: 0 }]).placed).toHaveLength(0);
  });

  it.runIf(CASTING_RULES.canCastOntoEnemiesBesideWizard)('works the same for the NPC (beside its wizard, on the right)', () => {
    const sim = new GameSimulation();
    const enemy = new Ether(sim.players[PLAYER_INDEX]);
    enemy.setCellIndex({ i: 2, j: GameBoard.NUM_COLS - 1 });
    sim.spells.push(enemy);
    expect(sim.cast(NPC_INDEX, 'Ether', [{ i: 2, j: GameBoard.NUM_COLS - 1 }]).placed).toHaveLength(1);
    expect(sim.spells).toHaveLength(0);
  });
});
