import { PALETTE, FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../../DataClasses/types";


/**
 * 1. ETHER (Fireball)
 * A buoyant, rhythmically bobbing central core with trailing fire plumes 
 * that flame out opposite to the travel direction.
 */
export function drawEther(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const cx = w / 2 + (w / 10);
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.3;

  // 1. VIOLENT JITTER (High-frequency, out-of-sync overlay to feel chaotic)
  const shakeX = Math.sin(time * 0.09) * Math.cos(time * 0.05) * (w * 0.015);
  const shakeY = Math.cos(time * 0.08) * Math.sin(time * 0.04) * (h * 0.015);

  // Keep a small underlying macro-bob so it still moves through space aggressively
  const macroBobY = Math.sin(time * 0.01) * (h * 0.02);

  ctx.save();
  // Apply both the macro path movement and the intense atmospheric shudder
  ctx.translate(cx + shakeX, cy + macroBobY + shakeY);

  const pulsatingRadius = radius - radius * Math.abs(Math.cos(time / 3000)) * 0.2;


  // --- DRAW TRAILING FLAMES ---
  // Flames trail backwards (negative X) and point slightly upwards (negative Y angle bias)
  const flameCount = 18;
  const flameLength = pulsatingRadius * 2.2; // Aggressive, long trailing look

  ctx.beginPath();
  for (let i = 0; i < flameCount; i++) {
    // Spread between -0.6 and 0.4 to structurally angle the flame envelope upward
    const angleRatio = (i / (flameCount - 1)) - 0.6; 
    const flameY = angleRatio * pulsatingRadius * 1.4;

    // High-speed frequency oscillation for the fire strands to mimic whipping plasma
    const waveOffset = Math.sin(-time * 0.025 - i * 5.5) * (pulsatingRadius * .7);
    
    // Target points backwards (negative X) and slightly upwards (subtracted upward float)
    const targetX = -flameLength + waveOffset;
    const targetY = flameY - (pulsatingRadius * 0.4); 

    // Control vectors creating aerodynamic atmospheric pressure curves
    const cp1x = -pulsatingRadius * 0.4;
    const cp1y = flameY * 1.3;
    const cp2x = -pulsatingRadius * 1.4;
    const cp2y = flameY + waveOffset - (pulsatingRadius * 0.2);

    if (i === 0) ctx.moveTo(0, flameY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
  }

  // Envelope smoothly back into the front perimeter bounds of the core circle
  ctx.lineTo(0, pulsatingRadius);
  ctx.lineTo(0, -pulsatingRadius);
  

  // Trailing fire gradient that fades completely out at its long tips
  const fireGrad = ctx.createLinearGradient(-flameLength, -radius * 0.4, 0, 0);
  fireGrad.addColorStop(0, 'transparent');
  fireGrad.addColorStop(0.45, PALETTE.fireOuter);
  fireGrad.addColorStop(0.75, PALETTE.fireMid);
  fireGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = fireGrad;
  ctx.fill();

  // --- DRAW MAGICAL CORE CIRCLE ---
  const coreGrad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
  coreGrad.addColorStop(.3 - Math.sin(time / 1000) * .2, PALETTE.fireCore);
  coreGrad.addColorStop(0.7, PALETTE.fireMid);
  coreGrad.addColorStop(0.9, PALETTE.fireOuter);
  coreGrad.addColorStop(1, 'transparent');

  ctx.beginPath();
  ctx.arc(0, 0, pulsatingRadius, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.shadowColor = PALETTE.fireMid;
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.restore();
}

/**
 * 1. ETHER DESTRUCTION (Fireball)
 * Spawns a mix of floating smoke rings that drift upward and crackling embers 
 * that fly outward before burning away.
 */
export function spawnEtherParticles(particles: GameParticle[], w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.35;

  // Emit rising smoke rings
  const smokeCount = 12;
  for (let i = 0; i < smokeCount; i++) {
    particles.push({
      x: cx + (Math.random() * radius - radius / 2),
      y: cy + (Math.random() * radius - radius / 2),
      vx: (Math.random() * 30 - 15),
      vy: -(Math.random() * 40 + 30), // Negative velocity floats UP
      alpha: 0.8,
      size: Math.random() * 6 + 6,     // Smoke rings start larger
      color: FX_PALETTE.fireSmoke,
      life: 1.0,
      decay: Math.random() * 1.0 + 1.2, // Disappears at a medium float pace
      type: 'smoke'                    // Custom tag handled in draw segment
    });
  }

  // Emit sparkling embers flying outwards
  const emberCount = 20;
  for (let i = 0; i < emberCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 120 + 40;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1.0,
      size: Math.random() * 3 + 1.5,
      color: FX_PALETTE.fireEmber,
      shadowColor: FX_PALETTE.fireEmberGlow,
      life: 1.0,
      decay: Math.random() * 1.5 + 1.5
    });
  }
}

/**
 * A great Ether (3x3) destroyed in a collision breaks apart like a meteor: its disc cracks into `chunks` pieces
 * (meteorChunk: each a slice of it, its rim smooth and its broken sides jagged, cream at the middle and orange at
 * the rim, as the fireball), all blasted back out away from the collision (the way the spell came from), each on
 * its own arc: `speed` (px a second, x the spell's width), launched at `climbDeg` (degrees above level; below 0 a
 * little down) and pulled down by `gravity` (px a second a second, x the spell's width), all ranges, so some
 * drop soon and some fly high and land late; trailing fire as it goes. size: the disc's radius, as a fraction
 * of the spell's width (a range: each piece its own); seconds: how long a piece lasts (long enough to leave
 * the screen: it stays bright until just before). high: a share of the pieces lobbed high instead, over the
 * wizards and off the screen above them (their own speed, climbDeg and gravity: lighter). deepShare: a share of
 * the pieces burning a deeper, darker orange (DEEP_FIRE) than the fireball's cream and orange.
 */
export const ETHER_SHATTER = {
  chunks: 6, speed: [0.9, 2.1], climbDeg: [-12, 38], gravity: [0.6, 1.6], size: [0.12, 0.26], seconds: [5, 6],
  high: { share: 0.34, speed: [1.6, 2.3], climbDeg: [38, 58], gravity: [0.25, 0.45] },
  deepShare: 0.4,
};

export function spawnEtherShatterParticles(particles: GameParticle[], w: number, h: number, dir: number) {
  const { chunks, size, seconds, high: lob, deepShare } = ETHER_SHATTER;
  const between = ([lo, hi]: Array<number>) => lo + Math.random() * (hi - lo);
  // The disc's slices: round it in order, each a little wider or narrower than its share
  const spans = Array.from({ length: chunks }, () => 0.7 + Math.random() * 0.6);
  const total = spans.reduce((a, b) => a + b, 0);
  let angle = Math.random() * Math.PI * 2;
  for (let k = 0; k < chunks; k++) {
    const wedgeSpan = spans[k] / total * Math.PI * 2, middle = angle + wedgeSpan / 2;
    // (its arc: a lob over the wizards, or a lower one; the slices that faced up launched higher, each with its own weight)
    const facingUp = (1 - Math.sin(middle)) / 2; // (1: its slice faced straight up, 0: straight down)
    const arc = Math.random() < lob.share ? lob : ETHER_SHATTER;
    const [low, high] = arc.climbDeg;
    const climb = (low + (high - low) * (0.5 * facingUp + 0.5 * Math.random())) * Math.PI / 180;
    const side = -dir; // (back the way it came: away from the collision)
    const v = between(arc.speed) * w;
    particles.push({
      x: w / 2 + Math.cos(middle) * w * 0.06, y: h / 2 + Math.sin(middle) * w * 0.06,
      vx: Math.cos(climb) * v * side, vy: -Math.sin(climb) * v, gravity: between(arc.gravity) * w,
      alpha: 1, size: between(size) * w, color: Math.random() < deepShare ? 'deep' : '',
      rotation: 0, vRotation: (Math.random() - 0.5) * 5,
      wedgeStart: angle, wedgeSpan, seed: Math.random() * 100,
      life: 1, decay: 1 / between(seconds), type: 'meteorChunk',
    });
    angle += wedgeSpan;
  }
  // The blast where they met: a flash of embers and smoke (as a lesser Ether's)
  spawnEtherParticles(particles, w, h);
}

/**
 * ETHER SPAWN (Fireball)
 * Springs into space with an elastic bounce while gathering environmental energy.
 */
export function drawEtherSpawn(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, progress: number) {
  ctx.save();

  // 1. Elastic Curve Math: Starts at 0, overshoots to 1.15, settles smoothly back to 1.0
  const scale = progress < 1
    ? Math.sin(progress * Math.PI * 0.5) * 1.15
    : 1.0;

  // Pivot transformations exactly from the absolute center of the fireball core
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  // 2. Draw Imploding Sparks Layer (Only visible during the initial creation phase)
  if (progress < 1) {
    const sparkCount = 8;
    const maxRadius = Math.min(w, h) * 1.2;

    // Invert progress so particles move INWARD from outer bounds to the center
    const gatherFactor = 1 - progress;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.fillStyle = '#fff4a3'; // Bright core color
    ctx.shadowColor = '#ff7700';
    ctx.shadowBlur = 10;

    for (let i = 0; i < sparkCount; i++) {
      // Space them out evenly in a ring
      const angle = (i / sparkCount) * Math.PI * 2 + (time * 0.005);

      // Compute the distance drifting down to the center point
      const currentRadius = maxRadius * gatherFactor + (Math.sin(time * 0.01 + i) * 10);

      const sx = Math.cos(angle) * currentRadius;
      const sy = Math.sin(angle) * currentRadius;

      ctx.beginPath();
      ctx.arc(sx, sy, w * 0.015 * gatherFactor, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Fall straight back into your original base drawing script
  drawEther(ctx, w, h, time);

  ctx.restore();
}

/**
 * 2. ETHER HIT EFFECT (Flames Rising)
 * Engulfs the target in burning embers and fire plumes that rapidly drift upwards.
 */
export function spawnEtherHitParticles(particles: GameParticle[], targetX: number, targetY: number) {
  const flameCount = 35;
  for (let i = 0; i < flameCount; i++) {
    particles.push({
      x: targetX + (Math.random() * 80 - 40),
      y: targetY + (Math.random() * 60 - 20),
      vx: (Math.random() * 50 - 25),
      vy: -(Math.random() * 60 + 40), // Slower upward speed so they stick around longer
      alpha: 1.0,
      size: Math.random() * 20 + 15,  // SIGNIFICANTLY LARGER fire puffs
      color: '#ff3700',
      shadowColor: '#fff4a3',
      life: 1.0,
      decay: Math.random() * 0.4 + 0.6, // DELAYED DECAY: Lasts roughly 1.2 to 1.6 seconds!
      
      // --- ADDED TYPE TO ACTIVATE THE AGE-BASED SMOKE INTERPOLATION ---
      type: 'etherFlame'
    });
  }
}
