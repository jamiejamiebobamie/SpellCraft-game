import { PALETTE } from "./ColorPalette";

/**
 * 3 & 4. GYRE (Updraft / Downdraft Tornadoes)
 * Funnel cloud architecture shifting side to side.
 * Blurry texturing shifting right-to-left across the internal clipping bounds.
 */
export function drawGyre(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, orientation: 'up' | 'down', time: number) {
  // Horizontal swaying shift calculation
  const swayX = Math.sin(time * 0.003) * (w * 0.08);
  const bleedHeight = h * 0.05; // Vertical cross-cell bleeding structural offset

  ctx.save();

  // Set up clip mapping container boundary for the funnel shape
  ctx.beginPath();
  if (orientation === 'up') {
    // Wide top spilling into the upper cell, narrow bottom base point
    ctx.moveTo(w * 0.5 + swayX, h); // Bottom vertex anchor point
    ctx.bezierCurveTo(w * 0.4, h * 0.6, w * 0.1 + swayX, h * 0.2, -w * 0.05 + swayX, -bleedHeight);
    ctx.lineTo(w * 1.05 + swayX, -bleedHeight);
    ctx.bezierCurveTo(w * 0.9 + swayX, h * 0.2, w * 0.6, h * 0.6, w * 0.5 + swayX, h);
  } else {
    // Downdraft: Wide bottom spilling downwards, narrow top base point
    ctx.moveTo(w * 0.5 + swayX, 0); // Top vertex anchor point
    ctx.bezierCurveTo(w * 0.4, h * 0.4, w * 0.1 + swayX, h * 0.8, -w * 0.05 + swayX, h + bleedHeight);
    ctx.lineTo(w * 1.05 + swayX, h + bleedHeight);
    ctx.bezierCurveTo(w * 0.9 + swayX, h * 0.8, w * 0.6, h * 0.4, w * 0.5 + swayX, 0);
  }
  ctx.clip();

  // Fill clipped funnel tracking backdrop area
  ctx.fillStyle = PALETTE.tornadoBase;
  ctx.fill();

  // --- DRAW INTERIOR TEXTURE LERP LINES (Right to Left) ---
  ctx.lineWidth = w * 0.03;
  const texturingLinesCount = 12;
  const textShiftX = (time * dir * 0.12) % w; // Linear shifting speed coefficient

  for (let i = 0; i < texturingLinesCount; i++) {
    // Calculate vertical bands across rows
    const yPos = (h / texturingLinesCount) * i;
    ctx.strokeStyle = PALETTE.tornadoLines[i % PALETTE.tornadoLines.length];

    // Apply soft blur to texture paths to mimic wind debris fields
    ctx.filter = 'blur(2px)';

    ctx.beginPath();
    // Render lines looping right-to-left
    const startX = w - textShiftX + (i * (w * 0.25));
    ctx.moveTo(startX, yPos);
    ctx.lineTo(startX - (w * 0.6), yPos);
    ctx.stroke();

    ctx.filter = 'none'; // Reset filter mapping layout
  }

  ctx.restore();
}