import { PALETTE, FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../DataClasses/types";
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

/**
 * 2. PHLEGM DESTRUCTION (Water Wheel)
 * Churning water splits outward into chunks that are heavily affected by gravity,
 * tumbling downward into falling droplets.
 */
export function spawnPhlegmParticles(particles: GameParticle[], w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const dropletCount = 35;

  for (let i = 0; i < dropletCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Splash velocity pushing up/out initial trajectory arch
    const speed = Math.random() * 180 + 60;

    particles.push({
      x: cx + Math.cos(angle) * (w * 0.2), // Born scattered around the donut ring
      y: cy + Math.sin(angle) * (h * 0.2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50, // Slight uniform upward pop boost
      alpha: 1.0,
      size: Math.random() * 4 + 2,
      color: Math.random() > 0.3 ? FX_PALETTE.waterSplash : FX_PALETTE.waterFroth,
      life: 1.0,
      decay: Math.random() * 1.0 + 1.0,
      type: 'droplet' // Gravity flag tagged
    });
  }
}

/**
 * PHLEGM SPAWN (Water Wheel)
 * Spins the donut aggressively fast while expanding outward radially.
 */
export function drawPhlegmSpawn(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, progress: number) {
  ctx.save();
  // Modify time variable to spin 4x faster during the creation state transition
  const fastTime = progress < 1 ? time * 4 * progress : time;
  
  ctx.translate(w / 2, h / 2);
  ctx.scale(progress, progress); // Expand outward
  ctx.translate(-w / 2, -h / 2);

  // Fallback straight into your original drawing engine
  drawPhlegm(ctx, w, h, 1, fastTime);
  ctx.restore();
}

/**
 * 3. PHLEGM HIT EFFECT (Green Healing Symbols Rising)
 * Spawns bright green cross shapes (+) that gently float upward, rotating over time.
 */
export function spawnPhlegmHitParticles(particles: GameParticle[], targetX: number, targetY: number, boardHeight: number) {
  const crossCount = 12;
  for (let i = 0; i < crossCount; i++) {
    particles.push({
      x: targetX + (Math.random() * 50 - 25),
      y: targetY + (Math.random() * 60 - 30),
      vx: (Math.random() * 20 - 10),
      vy: -(Math.random() * 60 + 40), // Smooth, floaty drift upward
      alpha: 1.0,
      size: Math.random() * 8 + 6,     // Size dictates the length of the cross arms
      color: '#a8ff69',
      shadowColor: '#2ecc71',
      rotation: Math.random() * Math.PI,
      vRotation: Math.random() * 2 - 1, // Tumbles gently in the air
      life: 1.0,
      decay: Math.random() * 0.8 + 0.8, // Drifts longer (~0.7s)
      type: 'healCross'                // Custom type tag for drawing the plus shape
    });
  }
}