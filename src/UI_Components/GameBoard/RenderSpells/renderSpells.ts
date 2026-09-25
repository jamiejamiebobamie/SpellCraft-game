import { drawEther, drawEtherSpawn } from "./drawEther";
import { drawGyre, drawGyreSpawn } from "./drawGyre";
import { drawPhlegm, drawPhlegmSpawn } from "./drawPhlegm";
import { drawQuicken, drawQuickenSpawn } from "./drawQuicken";
import { GameParticle } from '../../../DataClasses/types'; // or wherever you paste the interfaces

export function drawProceduralSpell(
  ctx: CanvasRenderingContext2D,
  spell: any,
  cellWidthPx: number,
  cellHeightPx: number,
  time: number,
  spawnProgress: number = 1.0
) {
  const cellCols = spell.getPropertyValue?.('widthCells') || 1;
  const cellRows = spell.getPropertyValue?.('heightCells') || 1;
  const w = cellWidthPx * cellCols;
  const h = cellHeightPx * cellRows;
  const dir = Math.sign(spell.getPropertyValue?.('speedDirection')) || 1;

  ctx.save();

  // --- REPLICATE CAUGHT IN GYRE MOTION FOR ANY ACTIVE UP/DOWN FLAG ---
  const upDown = Math.sign(spell.getPropertyValue?.('upDown') || 0);
  if (upDown !== 0) {
    // Perform orbit math relative to the center of this specific spell's canvas bounds
    ctx.translate(w / 2, h / 2);
    applyCaughtInGyreTransform(ctx, time, upDown);
    ctx.translate(-w / 2, -h / 2);
  }

  const spellClass = spell.constructor.name;

  if (spellClass === 'Ether') {
    drawEtherSpawn(ctx, w, h, dir, time, spawnProgress);
  } else if (spellClass === 'Phlegm') {
    drawPhlegmSpawn(ctx, w, h, time, spawnProgress);
  } else if (spellClass === 'GyreUp') {
    // Handle specific horizontal funnel spawn scaling
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(spawnProgress, 1.0);
    ctx.translate(-w / 2, 0);
    drawGyre(ctx, w, h, dir, 'up', time);
    ctx.restore();
  } else if (spellClass === 'GyreDown') {
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(spawnProgress, 1.0);
    ctx.translate(-w / 2, 0);
    drawGyre(ctx, w, h, dir, 'down', time);
    ctx.restore();
  } else if (spellClass === 'Quicken') {
    drawQuickenSpawn(ctx, w, h, dir, cellCols, time, spawnProgress);
  }

  ctx.restore();
}


export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: GameParticle[],
  deltaTime: number
) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // 1. Advance Physics and Timers FIRST 
    if (p.type === 'droplet') {
      p.vy += 450 * deltaTime; // Gravity pull
    }
    if (p.type === 'smoke') {
      p.size += 15 * deltaTime; // Expand smoke rings over time
    }

    p.x += p.vx * deltaTime;
    p.y += p.vy * deltaTime;

    if (p.rotation !== undefined && p.vRotation !== undefined) {
      p.rotation += p.vRotation * deltaTime;
    }

    // Tick life down and calculate final opacity
    p.life = Math.max(0, p.life - p.decay * deltaTime);
    p.alpha = p.life;

    // Evict dead particles immediately before wasting CPU time drawing them
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    // 2. Main Visual Render Switchboard
    // All unique shapes are cleanly separated by a unified if/else chain
    if (p.type === 'healCross') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = p.alpha;
      if (p.shadowColor) {
        ctx.shadowColor = p.shadowColor;
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.moveTo(-p.size / 2, 0);
      ctx.lineTo(p.size / 2, 0);
      ctx.moveTo(0, -p.size / 2);
      ctx.lineTo(0, p.size / 2);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'electricShock') {
      if (Math.random() > 0.4) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.strokeStyle = Math.random() > 0.3 ? p.color : '#ffffff';
        ctx.lineWidth = Math.random() * 4 + 1;
        ctx.globalAlpha = p.alpha;
        if (p.shadowColor) {
          ctx.shadowColor = p.shadowColor;
          ctx.shadowBlur = 12;
        }

        ctx.beginPath();
        ctx.moveTo(-p.size / 2, 0);
        const segments = 4;
        for (let j = 1; j <= segments; j++) {
          const segX = -p.size / 2 + (p.size / segments) * j;
          const segY = (Math.random() * 16 - 8);
          ctx.lineTo(segX, j === segments ? 0 : segY);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
    else if (p.type === 'windTrail') {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.globalAlpha = p.alpha;
      ctx.filter = 'blur(5px)';

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const isMovingRight = p.vx > 0;
      const cp1x = p.x + (isMovingRight ? p.size * 0.4 : -p.size * 0.4);
      const cp1y = p.y - 40;
      const cp2x = p.x + (isMovingRight ? p.size * 0.7 : -p.size * 0.7);
      const cp2y = p.y - 30;
      const endX = p.x + (isMovingRight ? p.size : -p.size);
      const endY = p.y + (Math.sin(p.life * 10) * 10);

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'windCurl') {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.globalAlpha = p.alpha;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, Math.PI * 0.2, Math.PI * 0.6);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'smoke') {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.25;
      ctx.globalAlpha = p.alpha;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'windLine') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = p.alpha;

      ctx.beginPath();
      ctx.moveTo(-p.size / 2, 0);
      ctx.lineTo(p.size / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'etherFlame' && !!p.radius && !!p.initialX && !!p.initialY && Math.abs(p.initialX - p.x) > p.radius && Math.abs(p.initialY - p.y) > p.radius) {
      // Calculate normalized lifespan progression: 0.0 (fresh birth) -> 1.0 (dead)
      const ageProgress = 1.0 - p.life;

      // Interpolate colors beautifully across the particle lifetime
      let h = 0, s = 0, l = 0;
      if (ageProgress < 0.35) {
        // Stage 1: Fiery Bright Core Red-Orange (HSL 15 -> 28)
        const t = ageProgress / 0.35;
        h = 15 + (28 - 15) * t;
        s = 95 - 15 * t; // Pure vivid saturation dropping slightly
        l = 60 - 20 * t; // Blazing luminescent center dropping down
      } else if (ageProgress < 0.7) {
        // Stage 2: Cool Dark Smoky Brown (HSL 28 -> 20)
        const t = (ageProgress - 0.35) / 0.35;
        h = 28 - (8 * t);
        s = 80 - 45 * t; // Heavy structural desaturation
        l = 40 - 22 * t; // Drop down into dark ground earth shades
      } else {
        // Stage 3: Ashen Decay Black (HSL 20 -> 0)
        const t = (ageProgress - 0.7) / 0.3;
        h = 20 - (20 * t);
        s = 35 - (35 * t); // Fully wash remaining colors out into true grayscale charcoal
        l = 18 - (10 * t); // Extremely dark ash glow
      }

      p.color = `hsl(${h}, ${s}%, ${l}%)`;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;

      // Only draw glows while the flame is highly incandescent
      if (ageProgress < 0.4) {
        ctx.shadowColor = 'rgb(240, 100, 40)';
        ctx.shadowBlur = p.life * 14;
      }

      ctx.beginPath();
      // Particles shrink organically as they consume their fuel and burn out
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    else {
      // --- Default Falling Water Drops, Fire Embers, and Large Fading Fire Puffs ---
      // If a fire ember/puff has no type, let it shrink away gracefully as it burns out
      const currentSize = p.type === undefined ? p.size * p.life : p.size;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (p.shadowColor) {
        ctx.shadowColor = p.shadowColor;
        ctx.shadowBlur = p.life * 15;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}



/**
 * Replicates your exact 'caughtInGyre' violent wobble orbital CSS keyframe animation.
 * @param ctx - The Canvas rendering context
 * @param time - Current loop timestamp in milliseconds
 * @param upDown - The movement flag (1 or -1) to influence direction/speed
 */
function applyCaughtInGyreTransform(ctx: CanvasRenderingContext2D, time: number, upDown: number) {
  // Loop speed matching your original '1s linear infinite' configuration
  // time * 0.002 * Math.PI completes 1 full cycle every 1000ms
  const speedModifier = 1.0;
  const angle = (time * 0.002 * Math.PI * speedModifier) * upDown;

  // 1. REPLICATING TRANSLATE3D POSITION ORBIT
  // 0%  (angle = 0)     -> x = 15,  y = 0
  // 25% (angle = π/2)   -> x = 0,   y = -15
  // 50% (angle = π)     -> x = -15, y = 0
  // 75% (angle = 3π/2)  -> x = 0,   y = 15
  const tx = Math.cos(angle) * 15;
  const ty = -Math.sin(angle) * 15; // Invert sine because canvas Y goes down
  ctx.translate(tx, ty);

  // 2. REPLICATING SCALEX FLATTENING MATRIX
  // 0%  -> scaleX = 1
  // 25% -> scaleX = 0.5
  // 50% -> scaleX = -1
  // 75% -> scaleX = -0.5
  // We can track this with a clean shifted cosine wave profile
  const baseScaleX = Math.cos(angle);
  const directionModifier = baseScaleX >= 0 ? 1 : -1;
  // Keeps scale magnitude bouncing between 0.5 and 1.0 organically
  const scaleX = directionModifier * (0.75 + Math.abs(baseScaleX) * 0.25);
  ctx.scale(scaleX, 1);

  // 3. REPLICATING VIOLENT LEAN ROTATION (35deg down to -35deg)
  // Convert your CSS degree constraints directly into native Canvas Radians
  // 0%   ->  35deg
  // 25%  -> -20deg
  // 50%  -> -35deg
  // 75%  ->  15deg
  // A combination of a primary sine wave and a secondary harmonic captures that erratic whip-back
  const primaryWave = Math.sin(angle) * (35 * Math.PI / 180);
  const harmonicWave = Math.sin(angle * 2) * (5 * Math.PI / 180);
  const rotationRad = primaryWave + harmonicWave;
  ctx.rotate(rotationRad);
}
