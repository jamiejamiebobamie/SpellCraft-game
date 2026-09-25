import { PALETTE, FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../DataClasses/types";

/**
 * 2. PHLEGM (Water Wheel)
 * An overlapping water ring reminiscent of an ouroboros, perpetually
 * streaming into itself with jagged, crested white froth barriers.
 * Infused with magical, glowing healing air bubbles.
 */
export function drawPhlegm(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, time: number) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.44;
  const ry = h * 0.34;
  
  // Base reference thickness for geometry calculation
  const baseThickness = Math.min(w, h) * 0.16;

  // --- SAFE THICKNESS MULTIPLIER ---
  const thicknessMultiplier = 1.4; 
  const waterThickness = baseThickness * thicknessMultiplier;

  // Keep wave crest sizing anchored to base metrics so it never skews or deforms
  const crestThickness = baseThickness; 

  ctx.save();
  ctx.translate(cx, cy);

  // --- PARAMETERS FOR THE WATER STREAM OVERLAPS ---
  const segments = 120; 
  const flowSpeed = time * 0.003; 

  const rippleAmp = Math.min(w, h) * 0.012;

  // Draw the stream using a massive overlap loop to emulate a continuous tubular scroll
  for (let i = 0; i < segments; i++) {
    const progress = i / segments;
    const angle = progress * Math.PI * 2;

    const rippleCount = 5;
    const currentRipple = Math.sin(angle * rippleCount - time * 0.006) * rippleAmp;

    const currentRx = rx + currentRipple;
    const currentRy = ry + currentRipple;

    const fx = Math.cos(angle) * currentRx;
    const fy = Math.sin(angle) * currentRy;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle + Math.PI / 2);

    const sliceGrad = ctx.createLinearGradient(-waterThickness / 2, 0, waterThickness / 2, 0);
    sliceGrad.addColorStop(0.0, 'rgba(40, 200, 170, 0.15)');  
    sliceGrad.addColorStop(0.2, PALETTE.waterMid || '#40e0d0'); 
    sliceGrad.addColorStop(0.8, PALETTE.waterDeep || '#008b8b'); 
    sliceGrad.addColorStop(1.0, 'rgba(0, 70, 80, 0.4)');

    ctx.fillStyle = sliceGrad;
    ctx.fillRect(-waterThickness / 2, -2, waterThickness, 6);
    ctx.restore();

    // ==========================================
    // --- NEW: EMISSIVE HEALING AIR BUBBLES ---
    // ==========================================
    // Check indices to distribute small air bubbles evenly throughout the stream
    if (i % 8 === 0) {
      ctx.save();
      
      // Calculate a moving offset around the loop based on execution time
      const bubbleAngle = angle + flowSpeed * 1.5; 
      
      // Add a localized wobble crosswise inside the thickness of the tube
      const innerWobbleX = Math.sin(time * 0.005 + i) * (waterThickness * 0.25);
      
      // Recalculate positions based on the moving track coordinates
      const bRipple = Math.sin(bubbleAngle * 5 - time * 0.006) * rippleAmp;
      const bx = Math.cos(bubbleAngle) * (rx + bRipple) + Math.cos(bubbleAngle + Math.PI / 2) * innerWobbleX;
      const by = Math.sin(bubbleAngle) * (ry + bRipple) + Math.sin(bubbleAngle + Math.PI / 2) * innerWobbleX;

      ctx.translate(bx, by);

      // Pulse bubble scale using frequency modulation
      const bubbleRadius = Math.min(w, h) * (0.008 + Math.abs(Math.sin(time * 0.01 + i)) * 0.006);

      // Create a luminous radial bubble gradient using your exact healing colors
      const bubbleGrad = ctx.createRadialGradient(0, 0, bubbleRadius * 0.1, 0, 0, bubbleRadius);
      bubbleGrad.addColorStop(0.0, '#ffffff');             // Incandescent air center
      bubbleGrad.addColorStop(0.4, '#a8ff69');             // Core healing cross color
      bubbleGrad.addColorStop(1.0, 'rgba(46, 204, 113, 0)'); // Fades out at edges into shadow color

      ctx.beginPath();
      ctx.arc(0, 0, bubbleRadius, 0, Math.PI * 2);
      ctx.fillStyle = bubbleGrad;

      // Inject the radiant neon green aura shadow blur properties
      ctx.shadowColor = '#2ecc71'; // healCrossShadow constant
      ctx.shadowBlur = bubbleRadius * 2.5;

      ctx.fill();
      ctx.restore();
    }
  }

  // --- DRAW JAGGED FROTH CRESTS (THE WHITE BARRIERS) ---
  const crestCount = 4; 
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;

  for (let c = 0; c < crestCount; c++) {
    const crestBaseAngle = (c / crestCount) * Math.PI * 2 + flowSpeed;

    ctx.save();
    ctx.fillStyle = PALETTE.waterFroth || '#ffffff';
    ctx.strokeStyle = PALETTE.waterFroth || '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();

    const teeth = 5;
    for (let t = 0; t <= teeth; t++) {
      const widthRatio = t / teeth; 
      const currentThick = -crestThickness / 2 + crestThickness * widthRatio;
      const toothForwardJut = (t % 2 === 0) ? (crestThickness * 0.35) : 0;

      const targetAngle = crestBaseAngle + (toothForwardJut / rx);
      const ripple = Math.sin(targetAngle * 5 - time * 0.006) * rippleAmp;
      
      const tx = Math.cos(targetAngle) * (rx + ripple) + Math.cos(targetAngle + Math.PI/2) * currentThick;
      const ty = Math.sin(targetAngle) * (ry + ripple) + Math.sin(targetAngle + Math.PI/2) * currentThick;

      if (t === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }

    const backAngle = crestBaseAngle - 0.14; 
    const steps = 6;
    for (let s = steps; s >= 0; s--) {
      const stepRatio = s / steps;
      const currentThick = -crestThickness / 2 + crestThickness * stepRatio;
      const tAngle = backAngle + (Math.sin(stepRatio * Math.PI) * 0.04);
      const ripple = Math.sin(tAngle * 5 - time * 0.006) * rippleAmp;

      const bx = Math.cos(tAngle) * (rx + ripple) + Math.cos(tAngle + Math.PI/2) * currentThick;
      const by = Math.sin(tAngle) * (ry + ripple) + Math.sin(tAngle + Math.PI/2) * currentThick;
      ctx.lineTo(bx, by);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
      color: FX_PALETTE.healCross,
      shadowColor: FX_PALETTE.healCrossShadow,
      rotation: Math.random() * Math.PI,
      vRotation: Math.random() * 2 - 1, // Tumbles gently in the air
      life: 1.0,
      decay: Math.random() * 0.8 + 0.8, // Drifts longer (~0.7s)
      type: 'healCross'                // Custom type tag for drawing the plus shape
    });
  }
}