import { PALETTE } from "./ColorPalette";


/**
 * 5. QUICKEN (Chain Lightning)
 * An electric blue high-voltage arc showing three major waveform crest peaks.
 * Branches into micro-arcing filaments if size configuration handles multiple cells.
 */
export function drawQuicken(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, cellCols: number, time: number) {
  ctx.save();

  // Use time variables to cleanly toggle randomized lightning jagged nodes every few frames
  const seed = Math.floor(time / 60);

  // Set glow state profile
  ctx.shadowColor = PALETTE.lightningMain;
  ctx.shadowBlur = 15;

  // Draw main conduit path
  drawLightningBranch(ctx, 0, h / 2, w, h / 2, 3, h * 0.25, seed, PALETTE.lightningMain, w * 0.06);

  // If size spans across multiple grid slots, output mini-hair branch arcing threads
  if (cellCols > 1) {
    ctx.shadowBlur = 5;
    const branches = 4;
    for (let i = 1; i <= branches; i++) {
      const bx = (w / (branches + 1)) * i;
      // Interpolate main center channel point alignment
      const by = h / 2;

      // Random direction vectors branching off vertically
      const targetY = by + (Math.sin(seed + i) > 0 ? h * 0.35 : -h * 0.35);
      const targetX = bx + (Math.cos(seed * i) * (w * 0.05));

      drawLightningBranch(ctx, bx, by, targetX, targetY, 2, h * 0.1, seed + i, PALETTE.lightningBranch, w * 0.02);
    }
  }

  ctx.restore();
}

/**
 * Midpoint displacement lightning rendering utility helper
 */
function drawLightningBranch(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  crests: number,
  amplitude: number,
  seed: number,
  color: string,
  thickness: number
) {
  const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

  // Create displacement points along horizontal axis
  const segments = Math.pow(2, crests);
  for (let i = 1; i < segments; i++) {
    const ratio = i / segments;
    const rx = x1 + (x2 - x1) * ratio;
    const ry = y1 + (y2 - y1) * ratio;

    // Pseudo-random deterministic noise variation computed from frame ticking values
    const noise = Math.sin(seed * i * 14.23) * Math.cos(seed + i * 4.12);
    const displacement = noise * amplitude;

    points.push({ x: rx, y: ry + displacement });
  }
  points.push({ x: x2, y: y2 });

  // Draw continuous stroke path
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}