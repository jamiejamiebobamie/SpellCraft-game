// spellAudit.test.ts
// An audit of the spell-movement rules: random games, every step checked for spells that should have met
// but didn't. Run on request (it's slow): AUDIT=1 npx vitest run src/DataClasses/GameRules/spellAudit.test.ts
// (AUDIT_GAMES=n for more or fewer games). Prints each kind of problem found, with the turn's setup to
// reproduce the first few.
// - passThrough: two spells moving toward each other in a shared row (neither inside a Phlegm or lifted
//   by a Gyre) are past each other a step later, without having met (pieces followed to the spell they
//   broke off from: originId)
// - overlap: two such spells on the same cell, neither inside the other
import { it } from 'vitest';
import { Gyre, Spell } from '../PlacedSpells/Spell';
import { getIsPhlegmFull } from '../PlacedSpells/SpellMovementEngine';
import { GameSimulation, NPC_INDEX, PLAYER_INDEX, SpellName } from './GameSimulation';

const SPELLS: Array<SpellName> = ['Phlegm', 'Ether', 'Quicken', 'GyreUp', 'GyreDown'];
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const cellsOf = (i: number, j: number, w: number, h: number) => {
  const cells = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push({ i: i + r, j: j + c });
  return cells;
};

type Snap = { id: string; origin: string; type: string; dir: number; i: number; j: number; w: number; h: number; isInTransit: boolean; isCarrying: boolean; isRemoved: boolean; capLeft: number; lifted: Array<string>; exited: string };
const snap = (s: Spell): Snap => ({
  id: s.id, origin: s.originId || s.id, type: s.constructor.name, dir: Math.sign(s.speedDirection), i: s.cellIndex.i, j: s.cellIndex.j,
  w: s.widthCells, h: s.heightCells, isInTransit: !!s.consumedSpellRef || s.isInPhlegmField, isCarrying: s.getIsBeingConsumed(), isRemoved: s.getIsRemove(),
  capLeft: s instanceof Gyre ? s.getRemainingCapacity() : getIsPhlegmFull(s) ? 0 : Infinity, lifted: s instanceof Gyre ? [...s.liftedThisTurn] : [], exited: s.exitedPhlegmId ?? '',
});
/** Whether `a` may let `b` through: a Gyre with no capacity left or that has lifted it this turn, or a used-up Phlegm (by design, not a bug). */
const letsThrough = (a: Snap, b: Snap) =>
  (a.type.startsWith('Gyre') && !b.type.startsWith('Gyre') && (a.capLeft <= 0 || a.lifted.includes(b.id) || a.lifted.includes(b.origin)))
  || (a.type === 'Phlegm' && a.capLeft <= 0) // (a used-up Phlegm is passed through: 7c)
  || (b.exited !== '' && b.exited === a.id); // (a spell just reflected by a Phlegm, leaving it)
const isAllowed = (a: Snap, b: Snap) => letsThrough(a, b) || letsThrough(b, a);
const label = (s: Snap) => `${s.type}${s.dir > 0 ? '>' : '<'}${s.w}x${s.h}@${s.i},${s.j}`;
const rowsOverlap = (a: Snap, b: Snap) => a.i < b.i + b.h && b.i < a.i + a.h;
const cellsOverlap = (a: Snap, b: Snap) => rowsOverlap(a, b) && a.j < b.j + b.w && b.j < a.j + a.w;
const center = (s: Snap) => s.j + (s.w - 1) / 2;
const isFree = (s: Snap) => !s.isRemoved && !s.isInTransit;

/** A spell's state a step earlier: itself, else the spell it broke off from (or a fellow piece in its rows). */
const before = (s: Snap, previous: Array<Snap>): Snap | undefined =>
  previous.find(p => p.id === s.id) ?? previous.find(p => p.id === s.origin) ?? previous.find(p => p.origin === s.origin && rowsOverlap(p, s));

it.skipIf(!(globalThis as any).process?.env?.AUDIT)('the spell-movement rules: no spells passing through or overlapping each other', () => {
  const games = Number((globalThis as any).process?.env?.AUDIT_GAMES ?? 2000);
  const found = new Map<string, { count: number; examples: Array<string> }>();
  const report = (kind: string, text: string) => {
    const entry = found.get(kind) ?? { count: 0, examples: [] };
    entry.count++;
    if (entry.examples.length < 4) entry.examples.push(text);
    found.set(kind, entry);
  };

  for (let seed = 1; seed <= games; seed++) {
    const rand = mulberry32(seed);
    const sim = new GameSimulation({ random: rand });
    let turn = 0;
    while (sim.gameOver === null && turn < 60) {
      [PLAYER_INDEX, NPC_INDEX].forEach(side => {
        if (rand() >= 0.7) return;
        const zoneJ = side === PLAYER_INDEX ? 0 : 4;
        const w = 1 + Math.floor(rand() * 3), h = 1 + Math.floor(rand() * 3);
        const i = Math.floor(rand() * (4 - h)), j = zoneJ + Math.floor(rand() * (4 - w));
        sim.cast(side, SPELLS[Math.floor(rand() * SPELLS.length)], cellsOf(i, j, w, h));
      });
      // (the board as the turn begins, before any spell moves)
      const start = sim.spells.filter(s => !s.getIsRemove()).map(snap);
      const setup = start.map(label).join('  ');
      const log = sim.endTurn();
      turn++;
      if (!log) continue;
      const states: Array<Array<Snap>> = [start, ...log.frames.map(f => f.spells.map(snap))];
      for (let k = 1; k < states.length; k++) {
        const previous = states[k - 1], current = states[k];
        const where = `seed ${seed}, turn ${turn}, step ${k}: the turn began  ${setup}`;
        for (let a = 0; a < current.length; a++) for (let b = a + 1; b < current.length; b++) {
          const x = current[a], y = current[b];
          if (x.dir === y.dir || !isFree(x) || !isFree(y)) continue;
          if (cellsOverlap(x, y) && !x.isCarrying && !y.isCarrying && !isAllowed(x, y)) report('overlap', `${label(x)} on ${label(y)} (${where})`);
          const px = before(x, previous), py = before(y, previous);
          if (!px || !py || !isFree(px) || !isFree(py) || !rowsOverlap(x, y) || !rowsOverlap(px, py) || isAllowed(px, py) || isAllowed(x, y)) continue;
          // (approaching a step ago: the one moving right was to the left; now it's to the right)
          const [right, left, pRight, pLeft] = x.dir > 0 ? [x, y, px, py] : [y, x, py, px];
          if (center(pRight) < center(pLeft) && center(right) > center(left)) {
            report(`passThrough ${pRight.type}/${pLeft.type}`, `${label(pRight)} and ${label(pLeft)} became ${label(right)} and ${label(left)} (${where})`);
          }
        }
      }
    }
  }
  console.log(`\nAudit of ${games} random games:`);
  if (!found.size) console.log('  no problems found');
  [...found.entries()].sort((a, b) => b[1].count - a[1].count).forEach(([kind, { count, examples }]) => {
    console.log(`  ${kind}: ${count}`);
    examples.forEach(e => console.log(`    - ${e}`));
  });
}, 600_000);
