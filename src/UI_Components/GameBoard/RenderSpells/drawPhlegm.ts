import { PALETTE } from "./ColorPalette";

/**
 * 2. PHLEGM (Water Wheel)
 * Oblong dynamic water ring with interior moving current, frothing, 
 * and downward dripping particle elements.
 */
export function drawPhlegm(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, time: number) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.45;
  const ry = h * 0.35;

  ctx.save();
  ctx.translate(cx, cy);

  // Outer Water Base Layer Path
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = Math.min(w, h) * 0.18;
  ctx.strokeStyle = PALETTE.waterDeep;
  ctx.stroke();

  // Middle churning current layer
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = Math.min(w, h) * 0.1;
  ctx.strokeStyle = PALETTE.waterMid;
  ctx.stroke();

  // Churning inner current segments traveling clockwise
  ctx.save();
  ctx.lineWidth = Math.min(w, h) * 0.04;
  ctx.strokeStyle = PALETTE.waterFroth;
  // Use line dashes shifted across execution time to visualize rushing movement
  ctx.setLineDash([w * 0.15, w * 0.2]);
  ctx.lineDashOffset = -(time * 0.15);
  ctx.stroke();
  ctx.restore();

  // --- DRAW SLOSHING WATER FROTH & DROPS ---
  const dotCount = 8;
  for (let i = 0; i < dotCount; i++) {
    // Distribute anchor points circumferentially around the track angle
    const baseAngle = (i / dotCount) * Math.PI * 2;
    const currentAngle = baseAngle + (time * 0.002); // Clockwise velocity tracking

    const fx = Math.cos(currentAngle) * rx;
    const fy = Math.sin(currentAngle) * ry;

    // White foam nodes
    ctx.fillStyle = PALETTE.waterFroth;
    ctx.beginPath();
    ctx.arc(fx, fy, Math.min(w, h) * (0.02 + Math.sin(time * 0.01 + i) * 0.01), 0, Math.PI * 2);
    ctx.fill();

    // Cascading falling water drops (skewed downwards)
    if (i % 2 === 0) {
      const dropOffset = ((time * 0.05 + i * 20) % (h * 0.3));
      ctx.fillStyle = 'rgba(52, 152, 219, 0.6)';
      ctx.beginPath();
      ctx.arc(fx, fy + dropOffset, Math.min(w, h) * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}