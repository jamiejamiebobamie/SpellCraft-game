// SpellMovementEngine.test.ts
// Saved scenarios for the spell-movement rules (see spell-movement-requirements.md). Run: npm test
import { afterEach, describe, expect, it } from 'vitest';
import { Ether, Gyre, GyreDown, GyreUp, Phlegm, Quicken, Spell } from './Spell';
import { Player } from '../Player/Player';
import { SpellMovementEngine, SpellTurnFrame } from './SpellMovementEngine';
import { GYRE_RULES, PHLEGM_RULES } from './spellRules';

const player = new Player(1, ''); // moves right
const npc = new Player(-1, ''); // moves left

type SpellClass = typeof Ether | typeof Phlegm | typeof Quicken | typeof GyreUp | typeof GyreDown;

/** `size` is the width of a Quicken chain, the height of a Gyre, or the side of a square spell. */
const place = (SpellType: SpellClass, caster: Player, i: number, j: number, size: number = 1): Spell => {
  const spell = new SpellType(caster);
  const isGyre = SpellType === GyreUp || SpellType === GyreDown;
  spell.widthCells = isGyre ? 1 : size;
  spell.heightCells = SpellType === Quicken ? 1 : size;
  spell.setCellIndex({ i, j });
  return spell;
};

/** Runs `numTurns` turns, feeding each turn's final board into the next. */
const runTurns = (spells: Array<Spell>, numTurns: number = 1): Array<Array<SpellTurnFrame>> => {
  const turns: Array<Array<SpellTurnFrame>> = [];
  let board = spells;
  for (let t = 0; t < numTurns; t++) {
    const { frames } = new SpellMovementEngine(board).simulateTurn();
    turns.push(frames);
    board = frames[frames.length - 1].spells;
  }
  return turns;
};

const finalBoard = (turns: Array<Array<SpellTurnFrame>>): Array<Spell> => {
  const lastTurn = turns[turns.length - 1];
  return lastTurn[lastTurn.length - 1].spells;
};

const byId = (frame: SpellTurnFrame, spell: Spell): Spell | undefined => frame.spells.find(s => s.id === spell.id);

/** Every state a spell was in across the given turns, in order. */
const statesOf = (turns: Array<Array<SpellTurnFrame>>, spell: Spell): Array<Spell> =>
  turns.flat().map(f => byId(f, spell)).filter(Boolean) as Array<Spell>;

const DEFAULT_PHLEGM_RULES = { ...PHLEGM_RULES };
const DEFAULT_GYRE_RULES = { ...GYRE_RULES };
afterEach(() => {
  Object.assign(PHLEGM_RULES, DEFAULT_PHLEGM_RULES);
  Object.assign(GYRE_RULES, DEFAULT_GYRE_RULES);
});

describe('1a. collision detection', () => {
  it('catches spells that swap places head-on instead of letting them pass through', () => {
    const ether = place(Ether, player, 0, 3);
    const quicken = place(Quicken, npc, 0, 4);
    const [frames] = runTurns([ether, quicken]);

    const firstStep = frames[0];
    expect(byId(firstStep, quicken)?.isRemove).toBe(true);
    expect(byId(firstStep, ether)?.isRemove).toBe(false);
    expect(byId(firstStep, ether)?.consumedQuickens).toBeGreaterThan(0);
  });

  it('does not collide spells moving the same direction side by side', () => {
    const a = place(Quicken, player, 0, 1);
    const b = place(Quicken, player, 0, 2);
    const [frames] = runTurns([a, b]);
    // (they merge into a chain at end of turn, so only movement frames are checked)
    const stepFrames = frames.filter(f => f.kind === 'step');
    expect(stepFrames.every(f => f.spells.every(s => !s.isRemove || s.isOpponentHitImpact))).toBe(true);
  });

  it('destroys both spells on equal power', () => {
    const a = place(Quicken, player, 1, 2);
    const b = place(Quicken, npc, 1, 4);
    const [frames] = runTurns([a, b]);
    const removedAt = frames.findIndex(f => f.spells.every(s => s.isRemove));
    expect(removedAt).toBeGreaterThanOrEqual(0);
    expect(frames[removedAt].healthEvents).toEqual([]);
  });
});

describe('1b. resolution order', () => {
  it('resolves the weakest pair first, so the strongest spell inherits earlier spoils', () => {
    // Step 1: B swaps with A (A-B, weakest 5) while C moves onto B (B-C, weakest 10)
    const b = place(Ether, player, 0, 3);
    const a = place(Quicken, npc, 0, 4);
    const c = place(Ether, npc, 0, 5, 2);
    const [frames] = runTurns([a, b, c]);

    const firstStep = frames[0];
    expect(byId(firstStep, a)?.isRemove).toBe(true);
    expect(byId(firstStep, b)?.isRemove).toBe(true);
    const survivor = byId(firstStep, c)!;
    expect(survivor.isRemove).toBe(false);
    expect(survivor.consumedQuickens).toBeGreaterThan(0); // A's speed bonus, passed on through B
    expect(survivor.consumedEthers).toBeGreaterThan(0);
  });
});

describe('2. Phlegm power and collision modes', () => {
  it("'alwaysLoses': a large Phlegm still loses to (and reflects) a small attacker", () => {
    const phlegm = place(Phlegm, player, 0, 1, 2);
    const ether = place(Ether, npc, 0, 4);
    const turns = runTurns([phlegm, ether], 2);
    const etherStates = turns.flat().map(f => byId(f, ether)).filter(Boolean) as Array<Spell>;
    expect(etherStates.some(s => s.isInPhlegmField)).toBe(true);
  });

  it("'power': a stronger Phlegm absorbs a weaker attacker and gains its bonus", () => {
    PHLEGM_RULES.collisionMode = 'power';
    const phlegm = place(Phlegm, player, 0, 1, 2); // power 20
    const ether = place(Ether, npc, 0, 4); // power 10
    const turns = runTurns([phlegm, ether], 2);

    const board = finalBoard(turns);
    const survivingPhlegm = board.find(s => s.id === phlegm.id)!;
    expect(board.some(s => s.id === ether.id)).toBe(false);
    expect(survivingPhlegm.consumedEthers).toBeGreaterThan(0);
    expect(survivingPhlegm.getPower()).toBe(25); // 2x2 × 5 + fire bonus
  });

  it("'power' + absorbCostsPower: absorbing drains the Phlegm's power before bonuses", () => {
    PHLEGM_RULES.collisionMode = 'power';
    PHLEGM_RULES.absorbCostsPower = true;
    const phlegm = place(Phlegm, player, 0, 1, 2);
    const ether = place(Ether, npc, 0, 4);
    const survivingPhlegm = finalBoard(runTurns([phlegm, ether], 2)).find(s => s.id === phlegm.id)!;
    expect(survivingPhlegm.getPower()).toBe(15); // 20 − 10 absorbed + 5 fire bonus
  });

  it('Phlegms heal: their damage is negative while their power is positive', () => {
    const phlegm = place(Phlegm, player, 0, 0, 2);
    expect(phlegm.getPower()).toBe(20);
    expect(phlegm.getPropertyValue('dmgHealth')).toBe(-20);
  });

  it("'alwaysLoses': the smaller Phlegm consumes the larger and heals its caster, empowered (self-heal)", () => {
    const small = place(Phlegm, player, 0, 2); // speed 1
    const large = place(Phlegm, player, 0, 0, 2); // speed 2, catches up on step 2
    const turns = runTurns([small, large], 2);

    // Once empowered, it stays empowered
    const smallStates = statesOf(turns, small);
    const empoweredAt = smallStates.findIndex(s => s.consumedPhlegms > 0);
    expect(empoweredAt).toBeGreaterThanOrEqual(0);
    expect(smallStates.slice(empoweredAt).every(s => s.consumedPhlegms > 0)).toBe(true);
    expect(smallStates[empoweredAt].getPower()).toBe(5 + PHLEGM_RULES.empoweredBonus);

    // It exits on its left side, reversed (7a), and heals its own caster
    expect(turns.flat().flatMap(f => f.healthEvents)).toEqual([{ playerIndex: 0, dmg: -(5 + PHLEGM_RULES.empoweredBonus) }]);
  });

  it("7a: a spell exits a Phlegm on the side it faces after reversing", () => {
    const phlegm = place(Phlegm, player, 0, 0, 2);
    const ether = place(Ether, npc, 0, 4); // enters on the Phlegm's right side, reverses to face right
    const states = statesOf(runTurns([phlegm, ether], 1), ether);
    const exitIndex = states.findIndex(s => s.isInPhlegmField) + states.filter(s => s.isInPhlegmField).length;
    expect(states[exitIndex].speedDirection).toBeGreaterThan(0);
    expect(states[exitIndex].cellIndex.j).toBeGreaterThanOrEqual(states.find(s => s.isInPhlegmField)!.cellIndex.j);
  });

  it('10b: a Phlegm is removed the moment its last spell exits, and is not re-entered', () => {
    const phlegm = place(Phlegm, player, 0, 0, 2);
    const ether = place(Ether, npc, 0, 4);
    const [frames] = runTurns([phlegm, ether]);
    const exitFrame = frames.findIndex(f => {
      const e = byId(f, ether);
      return !!e && !e.isInPhlegmField && e.speedDirection > 0;
    });
    expect(exitFrame).toBeGreaterThanOrEqual(0);
    expect(byId(frames[exitFrame], phlegm)?.isRemove).toBe(true);
    // Orbited exactly once
    const orbitStarts = frames.filter((f, k) => byId(f, ether)?.isInPhlegmField && !(k > 0 && byId(frames[k - 1], ether)?.isInPhlegmField));
    expect(orbitStarts).toHaveLength(1);
  });

  it('blood magic only affects casting: it is cleared when spell movement starts', () => {
    const ether = place(Ether, npc, 0, 4);
    ether.flagHitImpact(false, 5, true);
    const [frames] = runTurns([ether]);
    expect(frames.every(f => f.spells.every(s => !s.isBloodMagic))).toBe(true);
  });

  it("7b: a reflected spell gets bonus moves (powerDiff, at least 1)", () => {
    const run = () => {
      const phlegm = place(Phlegm, player, 0, 0, 2); // power 20
      const ether = place(Ether, npc, 0, 4); // power 10: bonus |10 - 20| / 5 = 2
      return statesOf(runTurns([phlegm, ether], 1), ether);
    };
    const withBonus = run();
    PHLEGM_RULES.reflectBonusMode = 'none';
    const withoutBonus = run();
    const lastColumn = (states: Array<Spell>) => states[states.length - 1].cellIndex.j;
    expect(lastColumn(withBonus) - lastColumn(withoutBonus)).toBe(2);
  });
});

describe('13. sized spells hitting a Phlegm', () => {
  it('a spell whose every row touches the Phlegm bounces off it as one block', () => {
    const phlegm = place(Phlegm, player, 0, 0, 3);
    const ether = place(Ether, npc, 0, 4, 3);
    const turns = runTurns([phlegm, ether], 2);
    const frames = turns.flat();

    // Never breaks into pieces, and the Phlegm survives the hit
    expect(frames.every(f => f.spells.filter(s => s instanceof Ether).length <= 1)).toBe(true);
    const bounceStart = frames.findIndex(f => (byId(f, ether)?.phlegmDwellStepsRemaining || 0) > 0);
    expect(bounceStart).toBeGreaterThanOrEqual(0);
    expect(byId(frames[bounceStart], phlegm)?.isRemove).toBe(false);

    // Reflected back at the NPC as a whole 3x3 Ether (next turn, until 7b bonus moves exist)
    expect(frames.flatMap(f => f.healthEvents)).toEqual([{ playerIndex: 1, dmg: 50 }]);
  });

  it('a bouncing block slides to the Phlegm\'s center before swirling', () => {
    const phlegm = place(Phlegm, player, 0, 0, 3);
    const ether = place(Ether, npc, 0, 4, 2);
    const [frames] = runTurns([phlegm, ether]);
    const swirlStart = frames.find(f => {
      const e = byId(f, ether);
      return !!e && e.phlegmDwellStepsRemaining > 0 && e.phlegmEntryStepsRemaining === 0;
    })!;
    const phlegmAtSwirl = byId(swirlStart, phlegm)!;
    expect(byId(swirlStart, ether)!.cellIndex.j).toBe(phlegmAtSwirl.cellIndex.j + 0); // centered: floor((3 - 2) / 2) = 0
  });

  it('a 1x1 Phlegm reflects only one spell, then is passed through (capacity)', () => {
    const phlegm = place(Phlegm, player, 1, 1);
    const first = place(Ether, npc, 1, 4);
    const second = place(Ether, npc, 1, 5);
    const turns = runTurns([phlegm, first, second], 2);
    const states = (spell: Spell) => turns.flat().map(f => byId(f, spell)).filter(Boolean) as Array<Spell>;
    expect(states(first).some(s => s.speedDirection > 0)).toBe(true); // reflected
    expect(states(second).every(s => s.speedDirection < 0)).toBe(true); // never reflected
  });

  it('a 1x1 Phlegm reflects one cell of a 2x2 Ether, which then destroys its sibling head-on', () => {
    const phlegm = place(Phlegm, player, 1, 1);
    const ether = place(Ether, npc, 0, 4, 2);
    const turns = runTurns([phlegm, ether], 2);
    const frames = turns.flat();

    // Exactly one piece is ever reflected
    const reflectedIds = new Set(frames.flatMap(f => f.spells.filter(s => s instanceof Ether && s.speedDirection > 0).map(s => s.id)));
    expect(reflectedIds.size).toBe(1);

    // The bottom row cancels out; the top row keeps going toward the player
    const survivors = finalBoard(turns).filter(s => s instanceof Ether && !s.isRemove);
    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors.every(s => s.cellIndex.i === 0 && s.speedDirection < 0)).toBe(true);
  });

  it('partial overlap: rows touching the Phlegm bounce back, the other rows keep going', () => {
    const phlegm = place(Phlegm, player, 0, 0, 2); // rows 0-1
    const ether = place(Ether, npc, 0, 4, 3); // rows 0-2
    const [frames] = runTurns([phlegm, ether]);
    const ethers = frames.flatMap(f => f.spells.filter(s => s instanceof Ether && !s.isRemove));

    // Some pieces in the touching rows get reflected; nothing in row 2 ever is
    expect(ethers.some(s => s.cellIndex.i < 2 && s.speedDirection > 0)).toBe(true);
    expect(ethers.filter(s => s.cellIndex.i === 2).length).toBeGreaterThan(0);
    expect(ethers.filter(s => s.cellIndex.i === 2).every(s => s.speedDirection < 0)).toBe(true);
  });

  it('a Quicken chain enters cell by cell, orbits in single file, and recombines', () => {
    const phlegm = place(Phlegm, player, 0, 0, 3);
    const quicken = place(Quicken, npc, 1, 4, 3);
    const turns = runTurns([phlegm, quicken], 2);

    // First contact: one cell breaks off, the rest stays chained
    const firstSplit = turns[0].find(f => f.spells.filter(s => s instanceof Quicken && !s.isRemove).length > 1)!;
    expect(firstSplit.spells.filter(s => s instanceof Quicken && !s.isRemove).map(s => s.widthCells).sort()).toEqual([1, 2]);

    // Recombines into one reflected chain, which hits the NPC once (its bonus moves carry it there)
    const isRecombined = (s: Spell) => s instanceof Quicken && !s.isRemove && s.widthCells === 3 && s.speedDirection > 0;
    expect(turns.flat().some(f => f.spells.some(isRecombined))).toBe(true);
    expect(turns.flat().flatMap(f => f.healthEvents)).toEqual([{ playerIndex: 1, dmg: 15 }]);
  });
});

describe('4-5. Gyres', () => {
  it('GyreUp lifts a spell to one cell past its tip, with no extra horizontal moves', () => {
    const gyre = place(GyreUp, player, 1, 1, 2); // rows 1-2
    const ether = place(Ether, npc, 2, 4); // enters at row 2
    const turns = runTurns([gyre, ether], 3);
    const etherStates = statesOf(turns, ether).filter(s => !s.isRemove);
    expect(Math.min(...etherStates.map(s => s.cellIndex.i))).toBe(0); // 2 - 1 + 1 = 2 moves up
    // After the lift it carries on along row 0 at its normal speed (1 per turn)
    const liftedAt = etherStates.findIndex(s => s.cellIndex.i === 0);
    const columnsAfterLift = etherStates.slice(liftedAt).filter((s, k, all) => k === 0 || s.cellIndex.j !== all[k - 1].cellIndex.j);
    expect(columnsAfterLift.every((s, k) => k === 0 || s.cellIndex.j === columnsAfterLift[k - 1].cellIndex.j - 1)).toBe(true);
  });

  it('GyreDown pushes a spell entering at its base to one cell past its tip', () => {
    const gyre = place(GyreDown, player, 0, 1, 2); // rows 0-1, base at row 0
    const ether = place(Ether, npc, 0, 4);
    const turns = runTurns([gyre, ether], 3);
    expect(Math.max(...statesOf(turns, ether).map(s => s.cellIndex.i))).toBe(2); // 1 - 0 + 1 = 2 moves down
  });

  it("'destroy': a spell pushed off the board is destroyed; 'clamp': it stops at the edge", () => {
    // A 1x1 GyreUp on the top row lifts anything that enters it to row -1
    const destroyed = place(Ether, npc, 0, 4);
    const destroyRun = runTurns([place(GyreUp, player, 0, 1), destroyed], 3);
    expect(statesOf(destroyRun, destroyed).some(s => s.isRemove && s.cellIndex.i < 0)).toBe(true);

    GYRE_RULES.offBoardMode = 'clamp';
    const clamped = place(Ether, npc, 0, 4);
    const clampRun = runTurns([place(GyreUp, player, 0, 1), clamped], 3);
    const clampedStates = statesOf(clampRun, clamped);
    expect(clampedStates.every(s => s.cellIndex.i >= 0)).toBe(true);
    expect(clampedStates.some(s => !s.isRemove && s.cellIndex.j <= 1)).toBe(true); // got past the Gyre
  });

  it('a 1x1 Gyre lifts one spell, then is used up and removed', () => {
    const gyre = place(GyreDown, player, 1, 1);
    const first = place(Ether, npc, 1, 4);
    const second = place(Ether, npc, 1, 5);
    const turns = runTurns([gyre, first, second], 3);
    expect(statesOf(turns, first).some(s => s.cellIndex.i === 2)).toBe(true);
    expect(statesOf(turns, second).every(s => s.cellIndex.i === 1)).toBe(true);
    expect(finalBoard(turns).some(s => s.id === gyre.id)).toBe(false);
  });

  it('a Gyre disappears once the spells it lifted have left it (10b)', () => {
    const gyre = place(GyreDown, player, 0, 1, 2); // power 8, capacity 2; lifts one spell
    const ether = place(Ether, npc, 1, 4); // power 10, so it enters the Gyre
    const turns = runTurns([gyre, ether], 3);
    expect(statesOf(turns, ether).some(s => s.cellIndex.i === 2)).toBe(true); // pushed down past the tip
    expect(finalBoard(turns).some(s => s.id === gyre.id)).toBe(false);
  });

  it("persistsAfterUse: a sized Gyre with capacity left survives into the next turn", () => {
    GYRE_RULES.persistsAfterUse = true;
    const gyre = place(GyreDown, player, 0, 1, 2);
    const ether = place(Ether, npc, 1, 4);
    const turns = runTurns([gyre, ether], 3);
    const survivor = finalBoard([turns[1]]).find(s => s.id === gyre.id);
    expect(survivor?.isRemove).toBe(false);
  });

  it('equally matched Gyres destroy each other, whatever their direction', () => {
    const a = place(GyreUp, player, 2, 2);
    const b = place(GyreUp, npc, 2, 4);
    expect(finalBoard(runTurns([a, b], 2)).filter(s => s instanceof Gyre && !s.isRemove)).toHaveLength(0);
  });

  it('same-direction Gyres merge, growing from the base; opposite Gyres cancel', () => {
    const tall = place(GyreUp, player, 1, 2, 2); // rows 1-2, base row 2
    const short = place(GyreUp, npc, 2, 4); // row 2
    const merged = finalBoard(runTurns([tall, short], 2)).filter(s => s instanceof Gyre && !s.isRemove);
    expect(merged).toHaveLength(1);
    expect([merged[0].heightCells, merged[0].cellIndex.i]).toEqual([3, 0]);

    const up = place(GyreUp, player, 1, 2, 2);
    const down = place(GyreDown, npc, 2, 4); // shrinks the GyreUp by 1, from its tip
    const shrunk = finalBoard(runTurns([up, down], 2)).filter(s => s instanceof Gyre && !s.isRemove);
    expect(shrunk).toHaveLength(1);
    expect([shrunk[0].heightCells, shrunk[0].cellIndex.i]).toEqual([1, 2]);

    const a = place(GyreUp, player, 2, 2);
    const b = place(GyreDown, npc, 2, 4);
    expect(finalBoard(runTurns([a, b], 2)).filter(s => s instanceof Gyre && !s.isRemove)).toHaveLength(0);
  });

  it('a sized spell hitting a Gyre only has its overlapping cells lifted', () => {
    const gyre = place(GyreDown, player, 1, 1, 2); // rows 1-2
    const quicken = place(Quicken, npc, 1, 4, 3); // a 3-cell chain in row 1
    const frames = runTurns([gyre, quicken], 2).flat();
    const firstContact = frames.find(f => f.spells.some(s => s instanceof Quicken && !s.isRemove && s.consumedGyres !== 0))!;
    const quickens = firstContact.spells.filter(s => s instanceof Quicken && !s.isRemove);
    expect(quickens.filter(s => s.consumedGyres !== 0).map(s => s.widthCells)).toEqual([1]); // one cell lifted
    expect(quickens.some(s => s.consumedGyres === 0 && s.widthCells === 2 && s.cellIndex.i === 1)).toBe(true); // rest still chained
  });
});

describe('invariants on random boards', () => {
  const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const randomBoard = (seed: number): Array<Spell> => {
    const rand = mulberry32(seed);
    const pick = (n: number) => Math.floor(rand() * n);
    const occupied = new Set<string>();
    const spells: Array<Spell> = [];
    for (let k = 0; k < 2 + pick(6); k++) {
      const SpellType = [Phlegm, Ether, Quicken, GyreUp, GyreDown][pick(5)];
      const caster = rand() < 0.5 ? player : npc;
      const size = 1 + pick(3);
      const isGyre = SpellType === GyreUp || SpellType === GyreDown;
      const w = isGyre ? 1 : size, h = SpellType === Quicken ? 1 : size;
      const i = pick(3 - h + 1);
      const j = caster === player ? pick(3 - w + 1) : 4 + pick(3 - w + 1);
      const cells: Array<string> = [];
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(`${i + r},${j + c}`);
      if (cells.some(c => occupied.has(c))) continue;
      cells.forEach(c => occupied.add(c));
      spells.push(place(SpellType, caster, i, j, size));
    }
    return spells;
  };

  it('no turn ends with a spell still sliding into, swirling in, or orbiting a Phlegm', () => {
    for (let seed = 1; seed <= 300; seed++) {
      runTurns(randomBoard(seed), 3).forEach(frames => {
        const turnEnd = frames.find(f => f.kind === 'turnEnd')!;
        turnEnd.spells.filter(s => !s.isRemove).forEach(s => {
          expect([s.phlegmEntryStepsRemaining, s.phlegmDwellStepsRemaining], `seed ${seed}`).toEqual([0, 0]);
          expect(s.isInPhlegmField && s.phlegmOrbitStepsRemaining > 0, `seed ${seed}`).toBe(false);
        });
      });
    }
  });

  it('Gyres always stay on the board, within their max height', () => {
    for (let seed = 1; seed <= 300; seed++) {
      runTurns(randomBoard(seed), 3).flat().forEach(f => {
        f.spells.filter(s => s instanceof Gyre && !s.isRemove).forEach(g => {
          expect(g.cellIndex.i >= 0 && g.cellIndex.i + g.heightCells <= 3, `seed ${seed}`).toBe(true);
          expect(g.heightCells <= GYRE_RULES.maxHeight, `seed ${seed}`).toBe(true);
        });
      });
    }
  });

  it('pieces of the same spell never share a cell, and turns never hit the step limit', () => {
    for (let seed = 1; seed <= 300; seed++) {
      runTurns(randomBoard(seed), 3).forEach(frames => {
        expect(frames.filter(f => f.kind === 'step').length).toBeLessThan(50);
        frames.forEach(f => {
          const live = f.spells.filter(s => !s.isRemove && s.fragmentGroupId);
          live.forEach((a, k) => live.slice(k + 1).forEach(b => {
            if (a.fragmentGroupId !== b.fragmentGroupId) return;
            const isSharing = a.cellIndex.i < b.cellIndex.i + b.heightCells && a.cellIndex.i + a.heightCells > b.cellIndex.i &&
              a.cellIndex.j < b.cellIndex.j + b.widthCells && a.cellIndex.j + a.widthCells > b.cellIndex.j;
            expect(isSharing, `seed ${seed}`).toBe(false);
          }));
        });
      });
    }
  });
});

describe('regressions', () => {

  it('is deterministic', () => {
    const setup = () => [place(Phlegm, player, 0, 0, 2), place(Ether, npc, 0, 4, 2), place(Quicken, npc, 2, 6)];
    const describeRun = (spells: Array<Spell>) => runTurns(spells, 3).flat()
      .map(f => f.spells.map(s => `${s.getSpellName()}${s.widthCells}x${s.heightCells}@${s.cellIndex.i},${s.cellIndex.j}${s.isRemove ? 'x' : ''}`).join(' '));
    expect(describeRun(setup())).toEqual(describeRun(setup()));
  });
});
