// scriptedOpponent.ts
// A rule-based opponent for training and benchmarking, in the spirit of the original NPC: defend
// the most threatened row, otherwise attack. Plays either side.
import { CellIndex } from '../types';
import { Spell, Phlegm, Ether } from '../PlacedSpells/Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { GameSimulation, SpellName, SPELL_CLASSES } from './GameSimulation';
import { getPlacementFocusCost, planSpellPlacement } from './gameRules';

const ROWS = GameBoard.NUM_ROWS;
const COLS = GameBoard.NUM_COLS;
const ZONE = GameBoard.NUM_PLACEMENT_CELLS;
const MAX_CASTS_PER_TURN = 2;

/** A column of `side`'s zone, counted from its back edge (0) to its front (ZONE - 1). */
const zoneColumn = (side: number, fromBack: number): number => side === 0 ? fromBack : COLS - 1 - fromBack;

const getRows = (spell: Spell): Array<number> =>
  Array.from({ length: spell.heightCells }, (_, r) => spell.cellIndex.i + r).filter(i => i >= 0 && i < ROWS);

/** Per row: total power of damaging spells heading toward `side`, minus its own spells heading out. */
const getRowThreats = (sim: GameSimulation, side: number): Array<{ threat: number; strongest: number }> => {
  const direction = sim.players[side].getDirection();
  const rows = Array.from({ length: ROWS }, () => ({ threat: 0, strongest: 0 }));
  sim.spells.filter(s => !s.getIsRemove()).forEach(spell => {
    const isIncoming = Math.sign(spell.speedDirection) !== direction;
    const isDamaging = !(spell instanceof Phlegm); // an incoming Phlegm heals
    getRows(spell).forEach(i => {
      if (isIncoming && isDamaging) {
        rows[i].threat += spell.getPower();
        rows[i].strongest = Math.max(rows[i].strongest, spell.getPower());
      } else if (!isIncoming) {
        rows[i].threat -= spell.getPower();
      }
    });
  });
  return rows;
};

/**
 * Tries to cast `spellName` over a `size` x `size` area at the front of `side`'s zone in row `i`
 * (moving back if the front is taken), only if affordable without blood magic.
 */
const tryCast = (sim: GameSimulation, side: number, spellName: SpellName, i: number, size: number = 1): boolean => {
  const caster = sim.players[side];
  for (let fromBack = ZONE - size; fromBack >= 0; fromBack--) {
    const cells: Array<CellIndex> = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push({ i: i + r, j: zoneColumn(side, fromBack + c) });
    if (cells.some(c => c.i >= ROWS)) return false;
    const SpellType = SPELL_CLASSES[spellName];
    const rects = planSpellPlacement(SpellType, cells, caster.getDirection(), sim.getIsOccupied, sim.spells);
    const isWholeArea = rects.length === 1 && rects[0].w === size && rects[0].h === size;
    const cost = getPlacementFocusCost(SpellType, rects);
    if (isWholeArea && cost <= caster.getFocus()) {
      sim.cast(side, spellName, cells);
      return true;
    }
  }
  return false;
};

/**
 * One defensive or attacking cast; returns whether it cast anything. Ties between equally good rows
 * are broken randomly, and attacks are sometimes smaller, so it doesn't play the same game every time.
 */
const castOnce = (sim: GameSimulation, side: number, random: () => number): boolean => {
  const rows = getRowThreats(sim, side).map((row, i) => ({ ...row, i, tieBreak: random() }));
  const mostThreatened = rows.filter(row => row.threat > 0).sort((a, b) => b.threat - a.threat || a.tieBreak - b.tieBreak)[0];

  if (mostThreatened) {
    // Counter with an Ether if it out-powers the strongest incoming spell, otherwise reflect it
    const etherPower = new Ether(sim.players[side]).getPower();
    if (etherPower > mostThreatened.strongest && tryCast(sim, side, 'Ether', mostThreatened.i)) return true;
    if (tryCast(sim, side, 'Phlegm', mostThreatened.i)) return true;
  }

  // Attack where the enemy has the least going on, with the biggest affordable Ether
  const attackRows = [...rows].sort((a, b) => a.threat - b.threat || a.tieBreak - b.tieBreak);
  const sizes = random() < 0.3 ? [1] : [2, 1];
  for (const size of sizes) {
    for (const { i } of attackRows) {
      if (tryCast(sim, side, 'Ether', Math.min(i, ROWS - size), size)) return true;
    }
  }
  return false;
};

/**
 * Plays `side`'s casts for one turn. With probability `randomMoveChance`, a turn's cast is a random
 * legal one instead (`randomCast`), like the original NPC's difficulty levels.
 */
export const playScriptedTurn = (
  sim: GameSimulation,
  side: number,
  random: () => number,
  randomMoveChance: number,
  randomCast: () => void,
): void => {
  for (let k = 0; k < MAX_CASTS_PER_TURN; k++) {
    if (sim.gameOver !== null || sim.players[side].getFocus() <= 0) return;
    if (random() < randomMoveChance) {
      randomCast();
      continue;
    }
    if (!castOnce(sim, side, random)) return;
  }
};
