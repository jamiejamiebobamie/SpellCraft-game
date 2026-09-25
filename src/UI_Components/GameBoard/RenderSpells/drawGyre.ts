import { PALETTE, FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../DataClasses/types";

/**
 * 3 & 4. GYRE (Updraft / Downdraft Tornadoes)
 * Funnel cloud architecture shifting side to side.
 * Blurry texturing shifting right-to-left across the internal clipping bounds.
 */
export function drawGyre(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, orientation: 'up' | 'down', time: number) {
  // Horizontal swaying shift calculation
  const swayX = Math.sin(time * 0.006) * (w * 0.1);
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
  const texturingLinesCount = 20;
  const textShiftX = (time * dir * .52) % w; // Linear shifting speed coefficient

  for (let i = 0; i < texturingLinesCount; i++) {
    // Calculate vertical bands across rows
    const yPos = (h / texturingLinesCount) * i + dir * h / 4;
    ctx.strokeStyle = PALETTE.tornadoLines[i % PALETTE.tornadoLines.length];

    // Apply soft blur to texture paths to mimic wind debris fields
    ctx.filter = 'blur(20px)';

    ctx.beginPath();
    // Render lines looping right-to-left
    const startX = w - textShiftX + (i * (w * 0.25));
    ctx.moveTo(startX, yPos);
    ctx.lineTo(startX - (w * 2), yPos);
    ctx.stroke();

    ctx.filter = 'none'; // Reset filter mapping layout
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
export function drawGyreSpawn(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, orientation: 'up' | 'down', time: number, progress: number) {
  ctx.save();
  
  // Pivot scale horizontally around the center x-axis of the funnel
  ctx.translate(w / 2, 0);
  ctx.scale(progress, 1.0); // X-scale grows from 0 to 1, Y-scale is instantly full height
  ctx.translate(-w / 2, 0);

  drawGyre(ctx, w, h, dir, orientation, time);
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

