// gameRules.ts
// Pure casting and game-over rules, shared by the game (Game.ts) and the headless GameSimulation.
import { CellIndex, GameOver, GameOverStatus } from '../types';
import { GameBoard } from '../GameBoard/GameBoard';
import { Spell, Phlegm, Ether, GyreUp, GyreDown, Quicken } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';

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

/**
 * Where a drawn spell lands. The cells the drawing touched are clipped to the caster's zone, and
 * their bounding box is filled (skipping occupied cells) with:
 * - Phlegm, Ether: the largest squares, 3x3 first
 * - GyreUp, GyreDown: vertical runs, one per column
 * - Quicken: horizontal runs, one per row (1x1 pieces if the drawing spans more than one row)
 * Returns the shapes in placement order.
 */
export const planSpellPlacement = (
  SpellType: SpellClass,
  touchedCells: Array<CellIndex>,
  direction: number,
  isOccupied: (cell: CellIndex) => boolean,
): Array<CellRect> => {
  const zone = getPlacementZone(direction);
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
  }
  return rects;
};

/**
 * Focus cost of casting `rects`: the spell type's cost × the last shape's size × the number of shapes.
 * (Kept as in the original game; sized focus costs are a separate, open design item.)
 */
export const getPlacementFocusCost = (SpellType: SpellClass, rects: Array<CellRect>): number => {
  if (!rects.length) return 0;
  const last = rects[rects.length - 1];
  return SpellType.FOCUS_COST * last.w * last.h * rects.length;
};

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

/** Turns until sunrise: one 5-minute clock tick per turn, from midnight to 6 AM. */
export const SUNRISE_TURNS = 12 * 6;
const CAUGHT_WEIGHT = 0.5;

/**
 * Time's up when it's past sunrise, or (from about 5:30 AM) when the teacher randomly catches you.
 * `random` returns a number in [0, 1).
 */
export const getIsTimeUp = (turnsElapsed: number, random: () => number): boolean => {
  const caughtChance = random() * (0.5 - 0.45) + 0.45 + CAUGHT_WEIGHT;
  const isCaught = turnsElapsed / SUNRISE_TURNS > caughtChance;
  const isPastSunrise = turnsElapsed >= SUNRISE_TURNS;
  return isCaught || isPastSunrise;
};

/** Game over from deaths: `player` is the player's wizard (left), `npc` the NPC's (right). */
export const getDeathGameOver = (player: Player, npc: Player): GameOver | null => {
  if (player.getIsDead() && npc.getIsDead()) return GameOverStatus.BothDead;
  if (npc.getIsDead()) return GameOverStatus.PlayerWon;
  if (player.getIsDead()) return GameOverStatus.NpcWon;
  return null;
};
