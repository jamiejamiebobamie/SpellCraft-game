import { drawEther } from "./drawEther";
import { drawGyre } from "./drawGyre";
import { drawPhlegm } from "./drawPhlegm";
import { drawQuicken } from "./drawQuicken";


/**
 * Main routing system for rendering procedural vector art.
 * @param ctx - The Canvas rendering context.
 * @param spell - The raw TypeScript data instance.
 * @param cellWidthPx - Width of a single board cell in pixels.
 * @param cellHeightPx - Height of a single board cell in pixels.
 * @param time - Current timestamp in milliseconds (from requestAnimationFrame).
 */
export function drawProceduralSpell(
  ctx: CanvasRenderingContext2D,
  spell: any,
  cellWidthPx: number,
  cellHeightPx: number,
  time: number
) {
  // Determine structural dimensions based on spell class/type parameters
  // Fallbacks handle 1x1 cell sizing
  const cellCols = spell.getPropertyValue?.('widthCells') || 1;
  const cellRows = spell.getPropertyValue?.('heightCells') || 1;

  const w = cellWidthPx * cellCols;
  const h = cellHeightPx * cellRows;
  const dir = Math.sign(spell.getPropertyValue?.('speedDirection')) || 1;

  ctx.save();

  // Route to the distinct spell render profiles
  const spellClass = spell.constructor.name; // E.g., "Ether", "Phlegm", "GyreUp", "GyreDown", "Quicken"

  if (spellClass === 'Ether') {
    drawEther(ctx, w, h, dir, time);
  } else if (spellClass === 'Phlegm') {
    drawPhlegm(ctx, w, h, dir, time);
  } else if (spellClass === 'GyreUp') {
    drawGyre(ctx, w, h, dir, 'up', time);
  } else if (spellClass === 'GyreDown') {
    drawGyre(ctx, w, h, dir, 'down', time);
  } else if (spellClass === 'Quicken') {
    drawQuicken(ctx, w, h, dir, cellCols, time);
  }

  ctx.restore();
}
