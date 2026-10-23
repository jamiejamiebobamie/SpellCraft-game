// gameRules.ts
// Pure casting and game-over rules, shared by the game (Game.ts) and the headless GameSimulation.
import { CellIndex, GameOver, GameOverStatus } from '../types';
import { GameBoard } from '../GameBoard/GameBoard';
import { Spell, Phlegm, Ether, GyreUp, GyreDown, Quicken } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { CASTING_RULES } from '../PlacedSpells/spellRules';

export type SpellClass = typeof Phlegm | typeof Ether | typeof GyreUp | typeof GyreDown | typeof Quicken;

export type CellRect = { i: number; j: number; w: number; h: number };

// --- Casting -----------------------------------------------------------------------------------

/** A caster's 3x3 placement zone: the player's (moving right) on the left, the NPC's on the right. */
export const getPlacementZone = (direction: number) => {
  const isLeftSide = direction === 1;
  return {
    minI: 0,
    maxI: GameBoard.NUM_ROWS - 1,
    minJ: isLeftSide ? 0 : GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS,
    maxJ: isLeftSide ? GameBoard.NUM_PLACEMENT_CELLS - 1 : GameBoard.NUM_COLS - 1,
  };
};

/** The column right next to a caster's wizard (the back edge of its zone). */
export const getWizardColumn = (direction: number): number => direction === 1 ? 0 : GameBoard.NUM_COLS - 1;

/** Whether `cell` is covered by live spells, all of them cast by the other side. */
export const getIsOccupiedOnlyByEnemy = (spells: Array<Spell>, cell: CellIndex, direction: number): boolean => {
  const covering = spells.filter(s => {
    const root = s.getCellIndex();
    return !s.getIsRemove() && !!root &&
      cell.i >= root.i && cell.i < root.i + s.heightCells && cell.j >= root.j && cell.j < root.j + s.widthCells;
  });
  return covering.length > 0 && covering.every(s => s.caster.getDirection() !== direction);
};

/**
 * Whether a caster can't cast onto `cell`: it's occupied, unless it only holds enemy spells
 * beside the caster's wizard (CASTING_RULES.canCastOntoEnemiesBesideWizard).
 */
export const getIsBlockedForCasting = (cell: CellIndex, direction: number, isOccupied: (cell: CellIndex) => boolean, spells: Array<Spell>): boolean =>
  isOccupied(cell) && !(CASTING_RULES.canCastOntoEnemiesBesideWizard &&
    cell.j === getWizardColumn(direction) && getIsOccupiedOnlyByEnemy(spells, cell, direction));

/**
 * Where a drawn spell lands. The cells the drawing touched are clipped to the caster's zone, and
 * their bounding box is filled (skipping occupied cells) with:
 * - Phlegm, Ether: the largest squares, 3x3 first
 * - GyreUp, GyreDown: vertical runs, one per column
 * - Quicken: horizontal runs, one per row (1x1 pieces if the drawing spans more than one row)
 * Shapes are filled from the caster's back edge (the left for the player; mirrored for the NPC, so
 * both sides cast the same way). Quickens are limited to CASTING_RULES.maxQuickenCellsPerCast cells.
 * `spells` (the live spells) allows casting onto enemy spells beside the wizard (getIsBlockedForCasting).
 * Returns the shapes in placement order.
 */
export const planSpellPlacement = (
  SpellType: SpellClass,
  touchedCells: Array<CellIndex>,
  direction: number,
  isOccupied: (cell: CellIndex) => boolean,
  spells: Array<Spell> = [],
): Array<CellRect> => {
  const isBlocked = (cell: CellIndex) => getIsBlockedForCasting(cell, direction, isOccupied, spells);
  if (direction === 1) return planSpellPlacementFromLeft(SpellType, touchedCells, isBlocked);
  const mirrorJ = (j: number, width: number) => GameBoard.NUM_COLS - j - width;
  return planSpellPlacementFromLeft(
    SpellType,
    touchedCells.map(c => ({ i: c.i, j: mirrorJ(c.j, 1) })),
    c => isBlocked({ i: c.i, j: mirrorJ(c.j, 1) }),
  ).map(rect => ({ ...rect, j: mirrorJ(rect.j, rect.w) }));
};

/** Quicken shapes within CASTING_RULES.maxQuickenCellsPerCast, those over touched cells first. */
const limitQuickenCells = (rects: Array<CellRect>, touchedCells: Array<CellIndex>): Array<CellRect> => {
  const maxCells = CASTING_RULES.maxQuickenCellsPerCast;
  if (maxCells === null) return rects;
  const isTouched = (rect: CellRect) => touchedCells.some(c => c.i === rect.i && c.j >= rect.j && c.j < rect.j + rect.w);
  const ordered = [...rects.filter(isTouched), ...rects.filter(rect => !isTouched(rect))];
  const kept: Array<CellRect> = [];
  let cellsLeft = maxCells;
  ordered.forEach(rect => {
    if (cellsLeft <= 0) return;
    const w = Math.min(rect.w, cellsLeft); // runs are filled from the back edge
    kept.push({ ...rect, w });
    cellsLeft -= w;
  });
  // Back in placement order
  return rects.flatMap(rect => kept.filter(k => k.i === rect.i && k.j === rect.j));
};

/** planSpellPlacement for a caster on the left side (zone at the left, moving right). */
const planSpellPlacementFromLeft = (
  SpellType: SpellClass,
  touchedCells: Array<CellIndex>,
  isOccupied: (cell: CellIndex) => boolean,
): Array<CellRect> => {
  const zone = getPlacementZone(1);
  const zoneCells = touchedCells.filter(c => c.i >= zone.minI && c.i <= zone.maxI && c.j >= zone.minJ && c.j <= zone.maxJ);
  if (!zoneCells.length) return [];

  const minI = Math.min(...zoneCells.map(c => c.i));
  const maxI = Math.max(...zoneCells.map(c => c.i));
  const minJ = Math.min(...zoneCells.map(c => c.j));
  const maxJ = Math.max(...zoneCells.map(c => c.j));
  const heightSpan = maxI - minI + 1;
  const widthSpan = maxJ - minJ + 1;

  // Blocked slots of the bounding box (occupied, or past the board's edge)
  const blocked: Array<Array<boolean>> = Array.from({ length: heightSpan }, (_, r) =>
    Array.from({ length: widthSpan }, (_, c) => {
      const i = minI + r, j = minJ + c;
      return i >= GameBoard.NUM_ROWS || j >= GameBoard.NUM_COLS || isOccupied({ i, j });
    })
  );

  const rects: Array<CellRect> = [];
  const claim = (r: number, c: number, w: number, h: number) => {
    rects.push({ i: minI + r, j: minJ + c, w, h });
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) blocked[r + dr][c + dc] = true;
  };

  if (SpellType === Phlegm || SpellType === Ether) {
    const canFitSquare = (r: number, c: number, size: number): boolean => {
      if (r + size > heightSpan || c + size > widthSpan) return false;
      for (let dr = 0; dr < size; dr++) for (let dc = 0; dc < size; dc++) if (blocked[r + dr][c + dc]) return false;
      return true;
    };
    [3, 2, 1].forEach(size => {
      for (let r = 0; r < heightSpan; r++) for (let c = 0; c < widthSpan; c++) if (canFitSquare(r, c, size)) claim(r, c, size, size);
    });
  } else if (SpellType === GyreUp || SpellType === GyreDown) {
    for (let c = 0; c < widthSpan; c++) {
      let r = 0;
      while (r < heightSpan) {
        if (blocked[r][c]) { r++; continue; }
        let height = 0;
        while (r + height < heightSpan && !blocked[r + height][c]) height++;
        claim(r, c, 1, height);
        r += height;
      }
    }
  } else if (SpellType === Quicken) {
    for (let r = 0; r < heightSpan; r++) {
      let c = 0;
      while (c < widthSpan) {
        if (blocked[r][c]) { c++; continue; }
        let width = 0;
        while (c + width < widthSpan && !blocked[r][c + width]) width++;
        const finalWidth = heightSpan > 1 ? 1 : width;
        claim(r, c, finalWidth, 1);
        c += finalWidth;
      }
    }
    return limitQuickenCells(rects, zoneCells);
  }
  return rects;
};

/**
 * Focus cost of casting `cellCount` cells of a spell: its cost per cell, rounded up, at least 1,
 * and at most CASTING_RULES.maxFocusCostPerCast, if set (except for CASTING_RULES.uncappedSpells).
 */
export const getFocusCost = (SpellType: SpellClass, cellCount: number): number => {
  const exact = SpellType.FOCUS_COST * cellCount;
  const cost = Math.max(1, CASTING_RULES.costRounding === 'floor' ? Math.floor(exact + 1e-9) : Math.ceil(exact - 1e-9));
  const cap = CASTING_RULES.maxFocusCostPerCast;
  return cap === null || CASTING_RULES.uncappedSpells.includes(SpellType.spellName) ? cost : Math.min(cap, cost);
};

/** Focus cost of casting `rects` (getFocusCost of all their cells). */
export const getPlacementFocusCost = (SpellType: SpellClass, rects: Array<CellRect>): number =>
  rects.length ? getFocusCost(SpellType, rects.reduce((cells, rect) => cells + rect.w * rect.h, 0)) : 0;

/** Creates the spells for a planned placement (not yet added to the board). */
export const createPlacedSpells = (SpellType: SpellClass, rects: Array<CellRect>, caster: Player): Array<Spell> =>
  rects.map(rect => {
    const spell = new SpellType(caster);
    spell.widthCells = rect.w;
    spell.heightCells = rect.h;
    spell.setCellIndex({ i: rect.i, j: rect.j });
    return spell;
  });

// --- Game over ---------------------------------------------------------------------------------

/** Turns until sunrise: each turn is 20 minutes (GameClock), from midnight to 6 AM. (5 minutes, 72 turns, was tried) */
export const SUNRISE_TURNS = 3 * 6;

/**
 * A teacher may catch them at the end of any turn from `firstTurn` (the "Night Is Passing" tip shows the
 * turn before): `chanceStep` that turn, then `chanceStep` more each turn (4%, 8%, 12%...), and surely
 * at sunrise. From turn 12: from first light (the turn ending at 4 AM, as a summer dawn begins), so the
 * sky's light tells of the danger (getDawnLight). (At 4% a step: about 1 in 3 matches still going at
 * 4 AM caught by 5 AM, 3 in 5 before sunrise. Was from turn 6, at 1% a step.)
 */
export const CAUGHT_RULES = { firstTurn: 12, chanceStep: 0.04 };

/** The chance a teacher catches them at the end of turn `turn` (1: sunrise). */
export const getCaughtChance = (turn: number): number =>
  turn >= SUNRISE_TURNS ? 1 : turn < CAUGHT_RULES.firstTurn ? 0 : Math.min(1, CAUGHT_RULES.chanceStep * (turn - CAUGHT_RULES.firstTurn + 1));

/**
 * The dawn's light during the turn after `turnsElapsed` (0: night, 1: full day): the chance a teacher
 * has caught them by that turn's end, so the brightening sky tells of the danger. Dark until first light,
 * faint then, brightening faster through the last hour; full for the last turn (sunrise is certain).
 */
export const getDawnLight = (turnsElapsed: number): number => {
  let isFree = 1;
  for (let turn = CAUGHT_RULES.firstTurn; turn <= turnsElapsed + 1; turn++) isFree *= 1 - getCaughtChance(turn);
  return 1 - isFree;
};

/**
 * Time's up (at the end of turn `turnsElapsed`): a teacher catches them (CAUGHT_RULES), or it's sunrise.
 * `random` returns a number in [0, 1).
 */
export const getIsTimeUp = (turnsElapsed: number, random: () => number): boolean => {
  if (turnsElapsed >= SUNRISE_TURNS) return true;
  if (turnsElapsed < CAUGHT_RULES.firstTurn) return false;
  return random() < getCaughtChance(turnsElapsed);
};

/**
 * A number in [0, 1) from `seed` and `n`, always the same for the same two (a 2-player match's teacher
 * rolls: `seed` shared by both browsers, `n` the turn).
 */
export const getSeededRandom = (seed: number, n: number): number => {
  let t = (seed + Math.imul(n + 1, 0x9E3779B9)) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Who a teacher catches: the weaker wizard (less health), who can't get away; both, if they're even. */
export const getCaughtGameOver = (player: Player, npc: Player): GameOver => {
  if (player.getHealth() < npc.getHealth()) return GameOverStatus.CaughtPlayer;
  if (npc.getHealth() < player.getHealth()) return GameOverStatus.CaughtNpc;
  return GameOverStatus.TimesUp;
};

/** Game over from deaths: `player` is the player's wizard (left), `npc` the NPC's (right). */
export const getDeathGameOver = (player: Player, npc: Player): GameOver | null => {
  if (player.getIsDead() && npc.getIsDead()) return GameOverStatus.BothDead;
  if (npc.getIsDead()) return GameOverStatus.PlayerWon;
  if (player.getIsDead()) return GameOverStatus.NpcWon;
  return null;
};
