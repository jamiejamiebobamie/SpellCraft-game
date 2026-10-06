import { PALETTE, FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../../DataClasses/types";
import { getAsymmetricTaper } from './drawQuicken'

/**
 * 3 & 4. GYRE (Updraft / Downdraft Tornadoes)
 * Funnel cloud architecture shifting side to side.
 * Blurry texturing shifting right-to-left across the internal clipping bounds.
 */
export function drawGyre(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dir: number,
  orientation: 'up' | 'down',
  time: number,
  cellRows: number
) {
  const bleedHeight = - h * 0.1;
  const startY = orientation === 'up' ? h + bleedHeight : -bleedHeight;
  const endY = orientation === 'up' ? -bleedHeight: h + bleedHeight;

  // --- GROUND CONTACT POINT DETERMINATION ---
  const contactY = orientation === 'up' ? h + bleedHeight: -bleedHeight;

  ctx.save();

  // --- CACHE INHERITED ALPHA FACTOR ---
  // Captures the fade-in/fade-out value (normally 1.0 on the board, but cycles 0 to 1 in your modal)
  const baseInheritedAlpha = ctx.globalAlpha;

  // --- GLOBAL TRANSPARENCY CONTROLLER (MULTIPLIED) ---
  ctx.globalAlpha = baseInheritedAlpha * 0.15;

  // 1. DENSE RING RESOLUTION FOR DETAILED RIVETS/DIVOTS
  const ringCount = 45;

  // 2. RENDER FROM BACK TO FRONT TO CREATE INTERNAL DEPTH / CENTRAL VOID
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const currentY = startY + (endY - startY) * t;

    // BASE RADIUS PROFILE (Funnel shape)
    const baseRadius = w * 0.05 + (w * 0.45) * Math.pow(t, 1.5);

    const k = Math.max(0.5, getAsymmetricTaper(t));

    // TOWERS OF HANOI "RIVETS & DIVOTS" EFFECT
    const rivetFrequency = 16;
    const rivetAmplitude = 0.18;
    const rivetMod = 1.0 + Math.cos(t * rivetFrequency - time * 0.005) * rivetAmplitude * k * cellRows * .3;

    // STYLISED HORIZONTAL SHIFTING & LEAN
    const swayFreq = 3.5;
    const swayX = Math.sin(getAsymmetricTaper(t) * swayFreq + time * 0.003) * (w * 0.12) * (1 - k) * cellRows;
    
    // --- NEW: RIGHTWARD LEAN CALCULATION ---
    const leanX = t * (w * 0.28); 
    const centerX = w * 0.5 + swayX + leanX;

    const finalRadius = baseRadius * rivetMod;

    // 3. DRAW THE WIND RING SLICE
    ctx.beginPath();
    const radiusY = Math.max(3, finalRadius * 0.22);
    ctx.ellipse(centerX, currentY, finalRadius, radiusY, 0, 0, Math.PI * 2);

    // 4. CREATING THE CENTRAL VOID STYLIZATION
    const ringGrad = ctx.createLinearGradient(centerX - finalRadius, 0, centerX + finalRadius, 0);

    const baseColor = PALETTE.tornadoBase || '#4a5568';
    const highlightColor = PALETTE.tornadoLines?.[i % (PALETTE.tornadoLines?.length || 1)] || '#cbd5e0';

    ringGrad.addColorStop(0.0, baseColor);
    ringGrad.addColorStop(0.2, highlightColor); 
    ringGrad.addColorStop(0.4, '#3e382a96');
    ringGrad.addColorStop(0.5, '#3c3225d2');
    ringGrad.addColorStop(0.6, '#3e382a96');
    ringGrad.addColorStop(0.8, highlightColor);
    ringGrad.addColorStop(1.0, baseColor);

    ctx.fillStyle = ringGrad;
    ctx.fill();

    // 5. EMBOSSING THE EDGES WITH OUTLINE SEGMENTS
    if (i % 2 === 0) {
      ctx.save(); 
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = Math.max(1, w * 0.008 * t);
      // Multiply against the currently managed context alpha to scale properly
      ctx.globalAlpha = ctx.globalAlpha * (0.4 + (t * 0.4));
      ctx.stroke();
      ctx.restore();
    }
  }

  // 6. ACCENT PARTICLES / DEBRIS WITHIN THE CYCLONE WALLS
  const sparkCount = 8;
  ctx.fillStyle = PALETTE.tornadoLines?.[0] || '#ffffff';

  for (let j = 0; j < sparkCount; j++) {
    const sparkT = ((time * 0.0015 + j / sparkCount) % 1);
    const currentY = startY + (endY - startY) * sparkT;

    const baseRadius = w * 0.05 + (w * 0.45) * Math.pow(sparkT, 1.5);
    const rivetMod = 1.0 + Math.cos(sparkT * 16 - time * 0.005) * 0.18;
    const swayX = Math.sin(sparkT * 3.5 + time * 0.003) * (w * 0.12) * sparkT;
    
    const sparkLeanX = sparkT * (w * 0.28);
    const centerX = w * 0.5 + swayX + sparkLeanX;
    
    const finalRadius = baseRadius * rivetMod;

    const angle = time * 0.008 * dir + (j * (Math.PI * 2 / sparkCount));
    const sparkX = centerX + Math.cos(angle) * (finalRadius * 0.85);
    const sparkY = currentY + Math.sin(angle) * (finalRadius * 0.22);

    const isFrontFacing = Math.sin(angle) > 0;
    if (isFrontFacing) {
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, Math.max(1.5, w * 0.012 * sparkT), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore(); 

  // --- 7. GROUND DUST KICKING CLOUD LAYER ---
  ctx.save();
  // Compound original fade sequence alpha factor into dust layers
  ctx.globalAlpha = baseInheritedAlpha * 0.35; 

  const tipSwayX = Math.sin(time * 0.003) * (w * 0.12) * 0.5; 
  const dustBaseX = w * 0.5 + tipSwayX;

  const dustPuffCount = 6;
  for (let d = 0; d < dustPuffCount; d++) {
    const angle = (d / dustPuffCount) * Math.PI * 2 + (time * 0.001 * dir);
    const pulseFactor = 1.0 + Math.sin(time * 0.004 + d) * 0.15;
    
    const offsetX = Math.cos(angle) * (w * 0.18) * pulseFactor;
    const offsetY = Math.sin(angle) * (h * 0.04) * pulseFactor;

    const puffX = dustBaseX + offsetX;
    const puffY = contactY + offsetY;
    const puffRadius = (w * 0.12) * pulseFactor * cellRows;

    ctx.beginPath();
    ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);

    const dustGrad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffRadius);
    const dustColorInner = '#5c4e3b';
    const dustColorOuter = '#3e382a00'; 

    dustGrad.addColorStop(0.0, dustColorInner);
    dustGrad.addColorStop(0.5, '#4a3f30b0');
    dustGrad.addColorStop(1.0, dustColorOuter);

    ctx.fillStyle = dustGrad;
    ctx.fill();
  }

  ctx.restore();
}


/**
 * 3 & 4. GYRE DESTRUCTION (Tornadoes)
 * Whirlwind constraints explode outward, creating swirling wind fragment lines 
 * that drift apart rapidly.
 */
export function spawnGyreParticles(particles: GameParticle[], w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const lineCount = 15;

  for (let i = 0; i < lineCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 100 + 50;

    particles.push({
      x: cx + (Math.random() * w * 0.4 - w * 0.2),
      y: Math.random() * h, // Distributed vertically along the funnel area
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 0.7,
      size: Math.random() * w * 0.15 + w * 0.05, // Stores line length in the size parameter!
      color: FX_PALETTE.windLine,
      rotation: Math.random() * Math.PI * 2,
      vRotation: Math.random() * 4 - 2, // Tumbles/spins violently outward
      life: 1.0,
      decay: Math.random() * 1.5 + 1.5,
      type: 'windLine'
    });
  }
}

/**
 * GYRE SPAWN (Tornado Updraft / Downdraft)
 * Begins as a needle-thin baseline strike, expanding outward horizontally.
 */
export function drawGyreSpawn(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, orientation: 'up' | 'down', time: number, progress: number, cellRows: number) {
  ctx.save();

  // Pivot scale horizontally around the center x-axis of the funnel
  ctx.translate(w / 2, 0);
  ctx.scale(progress, 1.0); // X-scale grows from 0 to 1, Y-scale is instantly full height
  ctx.translate(-w / 2, 0);

  drawGyre(ctx, w, h, dir, orientation, time, cellRows);
  ctx.restore();
}

/**
 * 4. GYRE HIT EFFECT (Wind Curls)
 * Sweeps large wind crescent paths horizontally across the screen.
 * Goes RIGHT if hitting the Opponent, LEFT if hitting the Player.
 */
export function spawnGyreHitParticles(particles: GameParticle[], targetX: number, targetY: number, direction: 'left' | 'right', cellWidthPx: number) {
  const gustLinesCount = 5;

  // Direction modifier to translate away from the board over the player
  const sweepVelocityX = direction === 'right' ? 300 : -300;

  for (let i = 0; i < gustLinesCount; i++) {
    // Start slightly shifted toward the board side, stagger the vertical entry points
    const spawnOffsetX = direction === 'right' ? -cellWidthPx : cellWidthPx;

    particles.push({
      x: targetX + spawnOffsetX,
      y: targetY + (Math.random() * 120 - 60),
      vx: sweepVelocityX,
      vy: (Math.random() * 20 - 10),
      alpha: 0.8,
      size: Math.random() * 80 + 80, // Using 'size' to dictate the visual horizontal length of the curve
      color: 'rgba(235, 230, 220, 0.45)',
      life: 1.0,
      decay: Math.random() * 0.8 + 1.0, // Moves across space over ~0.8s
      type: 'windTrail'
    });
  }
}

