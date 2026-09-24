import { PALETTE } from "./ColorPalette";


/**
 * 1. ETHER (Fireball)
 * A buoyant, rhythmically bobbing central core with trailing fire plumes 
 * that flame out opposite to the travel direction.
 */
export function drawEther(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, time: number) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.35;

  // Gentle rhythmic buoy bobbing using sine wave variations
  const bobY = Math.sin(time * 0.005) * (h * 0.04);

  ctx.save();
  ctx.translate(cx, cy + bobY);

  // --- DRAW TRAILING FLAMES ---
  // Flames point backwards relative to direction scale
  const flameCount = 6;
  const flameLength = radius * 1.8;

  ctx.beginPath();
  for (let i = 0; i < flameCount; i++) {
    const angleRatio = (i / (flameCount - 1)) - 0.5; // Spread between -0.5 and 0.5
    const flameY = angleRatio * radius * 1.2;

    // Animate the peaks of individual fire strands using time offsets
    const waveOffset = Math.sin(time * 0.01 + i * 2) * (radius * 0.2);
    const targetX = -flameLength + waveOffset;

    // Control point vectors for curving fire tips
    const cp1x = -radius * 0.5;
    const cp1y = flameY * 1.5;
    const cp2x = -radius * 1.2;
    const cp2y = flameY + waveOffset;

    if (i === 0) ctx.moveTo(0, flameY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, flameY);
  }

  // Close the back curve forward to envelop the core region safely
  ctx.lineTo(0, radius);
  ctx.lineTo(0, -radius);

  // Create trailing fire gradient
  const fireGrad = ctx.createLinearGradient(-flameLength, 0, 0, 0);
  fireGrad.addColorStop(0, 'transparent');
  fireGrad.addColorStop(0.4, PALETTE.fireOuter);
  fireGrad.addColorStop(0.8, PALETTE.fireMid);
  ctx.fillStyle = fireGrad;
  ctx.fill();

  // --- DRAW MAGICAL CORE CIRCLE ---
  const coreGrad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
  coreGrad.addColorStop(0, PALETTE.fireCore);
  coreGrad.addColorStop(0.5, PALETTE.fireMid);
  coreGrad.addColorStop(1, PALETTE.fireOuter);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.shadowColor = PALETTE.fireMid;
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.restore();
}