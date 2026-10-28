import { drawEtherSpawn } from "./drawEther";
import { drawGyreSpawn, GYRE_LOOK } from "./drawGyre";
import { drawPhlegmSpawn } from "./drawPhlegm";
import { drawQuickenSpawn, getAsymmetricTaper } from "./drawQuicken";
import { PALETTE } from "./ColorPalette";

export function drawProceduralSpell(
  ctx: CanvasRenderingContext2D,
  spell: any,
  cellWidthPx: number,
  cellHeightPx: number,
  time: number,
  spawnProgress: number = 1.0,
  isOnBoard: boolean = false // (Gyres drawn stronger there: GYRE_LOOK)
) {
  const cellCols = spell.getPropertyValue?.('widthCells') || 1;
  const cellRows = spell.getPropertyValue?.('heightCells') || 1;
  const w = cellWidthPx * cellCols;
  const h = cellHeightPx * cellRows;
  const dir = Math.sign(spell.getPropertyValue?.('speedDirection')) || 1;

  ctx.save();

  // --- REPLICATE CAUGHT IN GYRE MOTION FOR ANY ACTIVE UP/DOWN FLAG ---
  const consumedGyres = Math.sign(spell.getPropertyValue?.('consumedGyres') || 0);
  if (consumedGyres !== 0) {
    // Perform orbit math relative to the center of this specific spell's canvas bounds
    ctx.translate(w / 2, h / 2);
    applyCaughtInGyreTransform(ctx, time, consumedGyres);
    ctx.translate(-w / 2, -h / 2);
  }

  // --- SIZED SPELL BOUNCING OFF A PHLEGM: ROTATES AS A WHOLE WHILE SWIRLING IN PLACE ---
  if ((spell.phlegmDwellStepsRemaining || 0) > 0 && !spell.phlegmEntryStepsRemaining) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(time * 0.004);
    ctx.translate(-w / 2, -h / 2);
  }

  const spellClass = spell.constructor.spellName;

  if (spellClass === 'Ether') {
    drawEtherSpawn(ctx, w, h, time, spawnProgress);
  } else if (spellClass === 'Phlegm') {
    drawPhlegmSpawn(ctx, w, h, time, spawnProgress);
  } else if (spellClass === 'GyreUp') {
    // Handle specific horizontal funnel spawn scaling
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(spawnProgress, 1.0);
    ctx.translate(-w / 2, 0);
    drawGyreSpawn(ctx, w * 0.9, h, dir, 'up', time, spawnProgress, cellRows, isOnBoard ? GYRE_LOOK.board : GYRE_LOOK.elsewhere);
    ctx.restore();
  } else if (spellClass === 'GyreDown') {
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(spawnProgress, 1.0);
    ctx.translate(-w / 2, 0);
    drawGyreSpawn(ctx, w * 0.9, h, dir, 'down', time, spawnProgress, cellRows, isOnBoard ? GYRE_LOOK.board : GYRE_LOOK.elsewhere);
    ctx.restore();
  } else if (spellClass === 'Quicken') {
    drawQuickenSpawn(ctx, w, h, cellCols, time, spawnProgress);
  }

  ctx.restore();
}

/**
 * Spawns the ambient particles (flames, droplets, sparks) around a spell drawn outside the board
 * (the spellbook, the loading screen's logo): call once a frame, then updateAndDrawParticles.
 * `wPx`, `hPx`: the spell's size; particles are relative to its top left.
 */
export function spawnPreviewSpellParticles(spellName: string, particles: any[], wPx: number, hPx: number, time: number) {
  if (spellName === 'Ether') {
    const cx = wPx / 2 + (wPx / 10); const cy = hPx / 2; const radius = Math.min(wPx, hPx) * 0.3;
    if (Math.random() < 0.25) {
      const spreadX = (Math.random() - 0.85) * (radius * 1.75); const spawnX = cx + spreadX; const spawnY = cy + Math.sin(time * 0.005) * (hPx * 0.04) + ((Math.random() - 0.5) * (radius * 1.75)); const ratio = Math.sqrt(Math.pow((cx - spawnX), 2) + Math.pow((cy - spawnY), 2)) / radius;
      particles.push({ x: spawnX, y: spawnY, vx: -(50 + Math.random() * 50), vy: -50 - Math.random() * 50, alpha: 1.0, size: Math.max((1 - ratio) * (radius * 0.1), radius * 0.05), color: ratio < .3 ? PALETTE.fireCore : ratio < .8 ? PALETTE.fireMid : PALETTE.fireOuter, life: 1.0, decay: 1.5 + Math.random() * 1, type: 'etherFlame' });
    }
  } else if (spellName === 'Phlegm') {
    const rx = wPx * 0.44; const ry = hPx * 0.34;
    if (Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({ x: wPx / 2 + Math.cos(angle) * rx, y: hPx / 2 + Math.sin(angle) * ry, vx: Math.cos(angle) * 20, vy: Math.sin(angle) * 20 - 20, alpha: 1.0, size: Math.min(wPx, hPx) * 0.015, color: Math.random() > 0.7 ? PALETTE.waterFroth : Math.random() > 0.4 ? PALETTE.waterMid : PALETTE.waterDeep, life: 1.0, decay: 1.2 + Math.random() * 1.0, type: 'droplet' });
    }
  } else if (spellName === 'Quicken' && Math.random() < 0.15) {
    const sx = Math.random() * wPx; const sy = Math.random() * hPx; const len = Math.min(wPx, hPx) * 0.3; const ang = Math.random() * Math.PI * 2;
    particles.push({ x: sx, y: sy, targetX: sx + Math.cos(ang) * len, targetY: sy + Math.sin(ang) * len, vx: 0, vy: 0, initialX: sx, initialY: sy, alpha: 1.0, size: 1.0 + Math.random() * 1.5, color: '#16e0d6', shadowColor: '#00ffff', life: 1.0, decay: 12.0, type: 'lightningArc' });
  }
}

/**
 * A shattered Ether's piece's tail (meteorChunk): how many frames of its path it streams back over (length),
 * how wide it is at the piece (width: x the piece's radius), how opaque its orange plume and its cream core are
 * there (outerOpacity, coreOpacity: added light, fading toward the tail's end), and how much its edges waver.
 */
/** A deeper-burning piece's colours (ETHER_SHATTER.deepShare): its middle and its rim. */
export const DEEP_FIRE = { core: '#ffb347', rim: '#d94e00' };

export const METEOR_TAIL ={ length: 50, width: 0.75, outerOpacity: 0.22, coreOpacity: 0.3, waver: 0.25 };

export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: any[], // Matches your GameParticle collection array type
  deltaTime: number
) {
  // --- PASS 1: ADVANCE PHYSICS & TIMER LOGIC (RUNS FOR ALL PARTICLES) ---
  const trails: any[] = []; // (fire shed by meteor chunks this frame: added after the pass)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    if (p.type === 'droplet') {
      p.vy += 450 * deltaTime; // Gravity pull
    }
    if (p.type === 'meteorChunk') {
      // A burning piece of a shattered Ether: arcs down, its path kept for its streaming tail (METEOR_TAIL),
      // now and then shedding a spark of fire
      p.vy += (p.gravity ?? 180) * deltaTime;
      (p.trail ??= []).push({ x: p.x, y: p.y });
      if (p.trail.length > METEOR_TAIL.length) p.trail.shift();
      const shed = Math.random() < 0.25 * p.life ? 1 : 0;
      for (let k = 0; k < shed; k++) {
        trails.push({
          x: p.x + (Math.random() - 0.5) * p.size * 0.6, y: p.y + (Math.random() - 0.5) * p.size * 0.6,
          vx: p.vx * 0.06 + (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 25,
          alpha: 1, size: p.size * (0.22 + Math.random() * 0.2) * (0.5 + 0.5 * p.life), color: '',
          life: 1, decay: 2.2 + Math.random() * 1.2, type: 'meteorTrail',
        });
      }
    }
    if (p.type === 'smoke') {
      p.size += 15 * deltaTime; // Expand smoke rings over time
    }

    p.x += p.vx * deltaTime;
    p.y += p.vy * deltaTime;

    if (p.rotation !== undefined && p.vRotation !== undefined) {
      p.rotation += p.vRotation * deltaTime;
    }

    p.life = Math.max(0, p.life - p.decay * deltaTime);
    p.alpha = p.life;

    // Evict dead particles immediately
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
  if (trails.length) particles.push(...trails);

  // --- PASS 2: RENDER SWITCHBOARD (STANDARD VISUALS ONLY) ---
  particles.forEach((p) => {
    if (p.type === 'floatingText') return; // SKIP TEXT FOR NOW - HELD FOR THE TOP PASS

    if (p.type === 'healCross') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = typeof getAsymmetricTaper === 'function' ? getAsymmetricTaper(p.alpha) : p.alpha;
      if (p.shadowColor) {
        ctx.shadowColor = p.shadowColor;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.moveTo(-p.size / 2, 0); ctx.lineTo(p.size / 2, 0);
      ctx.moveTo(0, -p.size / 2); ctx.lineTo(0, p.size / 2);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'lightningArc') {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.globalAlpha = p.alpha;
      if (p.shadowColor) { ctx.shadowColor = p.shadowColor; ctx.shadowBlur = 10; }
      const midX = (p.x + p.targetX) / 2 + (Math.random() * 16 - 8);
      const midY = (p.y + p.targetY) / 2 + (Math.random() * 16 - 8);
      ctx.moveTo(p.x, p.y); ctx.lineTo(midX, midY); ctx.lineTo(p.targetX, p.targetY);
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'meteorTrail') {
      // Fire, cooling as it ages: bright yellow, orange, red (added light), then a wisp of dark smoke
      const age = 1 - p.life;
      ctx.save();
      if (age < 0.6) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = age < 0.15 ? '#ffe08a' : age < 0.35 ? '#ff9a1f' : '#d8400c';
        ctx.globalAlpha = 0.55 * p.life;
      } else {
        ctx.fillStyle = '#3a2a22';
        ctx.globalAlpha = 0.35 * p.life;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (age < 0.6 ? 1 - age * 0.6 : 0.8 + age * 0.6)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    else if (p.type === 'meteorChunk') {
      // A piece of the fireball's disc (radius p.size): its rim a smooth arc, its broken sides jagged, running
      // in toward where the middle was; cream inside and orange at the rim (PALETTE.fireCore, fireMid), as the
      // fireball, in a soft glow. Drawn about its own middle, so it tumbles in place
      const R = p.size, start = p.wedgeStart ?? 0, span = p.wedgeSpan ?? 1, middle = start + span / 2, seed = p.seed ?? 0;
      const jitter = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5; // (the same jag every frame)
      const centroid = R * 0.55;
      // Its tail: a plume streaming back along its path, widest and brightest at the piece (cream inside
      // orange), narrowing and fading behind, its edges wavering (METEOR_TAIL)
      const trail: Array<{ x: number; y: number }> = p.trail ?? [];
      if (trail.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fade = Math.min(1, p.life * 8); // (bright until the very end: it leaves the screen first)
        for (let k = 0; k < trail.length; k++) {
          const t = (k + 1) / trail.length; // (0: the tail's end, 1: at the piece)
          const waver = Math.sin(k * 1.9 + seed + p.life * 25) * R * METEOR_TAIL.waver * (1 - t);
          const x = trail[k].x, y = trail[k].y + waver;
          ctx.fillStyle = `rgba(255, 119, 0, ${METEOR_TAIL.outerOpacity * t * fade})`;
          ctx.beginPath(); ctx.arc(x, y, R * METEOR_TAIL.width * (0.15 + 0.85 * t), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255, 244, 163, ${METEOR_TAIL.coreOpacity * t * t * fade})`;
          ctx.beginPath(); ctx.arc(x, y, R * METEOR_TAIL.width * 0.45 * t, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 8);
      ctx.translate(p.x, p.y);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
      glow.addColorStop(0, 'rgba(255, 210, 120, 0.5)');
      glow.addColorStop(1, 'rgba(255, 90, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(p.rotation || 0);
      ctx.translate(-Math.cos(middle) * centroid, -Math.sin(middle) * centroid); // (the disc's middle)
      const inner = { x: Math.cos(middle + jitter(9) * span * 0.4) * R * (0.08 + 0.12 * Math.abs(jitter(7))), y: 0 };
      inner.y = Math.sin(middle + jitter(9) * span * 0.4) * R * (0.08 + 0.12 * Math.abs(jitter(7)));
      // A broken side, from (x0, y0) to (x1, y1): a few jags either side of the straight line
      const jagged = (x0: number, y0: number, x1: number, y1: number, k0: number) => {
        const steps = 4, nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny) || 1;
        for (let k = 1; k < steps; k++) {
          const t = k / steps, off = jitter(k0 + k) * R * 0.22;
          ctx.lineTo(x0 + (x1 - x0) * t + nx / len * off, y0 + (y1 - y0) * t + ny / len * off);
        }
        ctx.lineTo(x1, y1);
      };
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y);
      jagged(inner.x, inner.y, Math.cos(start) * R, Math.sin(start) * R, 1);
      ctx.arc(0, 0, R, start, start + span);
      jagged(Math.cos(start + span) * R, Math.sin(start + span) * R, inner.x, inner.y, 20);
      ctx.closePath();
      const body = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      const fire = p.color === 'deep' ? DEEP_FIRE : { core: PALETTE.fireCore, rim: PALETTE.fireMid };
      body.addColorStop(0, fire.core);
      body.addColorStop(0.55, fire.core);
      body.addColorStop(0.85, fire.rim);
      body.addColorStop(1, fire.rim);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 119, 0, 0.9)';
      ctx.lineWidth = Math.max(1, R * 0.05);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
    else if (p.type === 'fireballOrb') {
      ctx.save();
      ctx.beginPath();
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, p.size));
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, p.color);
      grad.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = p.alpha;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
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
        if (p.shadowColor) { ctx.shadowColor = p.shadowColor; ctx.shadowBlur = 12; }
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
    else if (p.type === 'etherFlame') {
      const ageProgress = 1.0 - p.life;
      let h = 0, s = 0, l = 0;
      if (ageProgress < 0.35) {
        const t = ageProgress / 0.35; h = 15 + (28 - 15) * t; s = 95 - 15 * t; l = 60 - 20 * t;
      } else if (ageProgress < 0.7) {
        const t = (ageProgress - 0.35) / 0.35; h = 28 - (8 * t); s = 80 - 45 * t; l = 40 - 22 * t;
      } else {
        const t = (ageProgress - 0.7) / 0.3; h = 20 - (20 * t); s = 35 - (35 * t); l = 18 - (10 * t);
      }
      if (ageProgress > 0.25) p.color = `hsl(${h}, ${s}%, ${l}%)`;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (ageProgress < 0.4) { ctx.shadowColor = 'rgb(240, 100, 40)'; ctx.shadowBlur = p.life * 14; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'bloodDroplets') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;

      if (p.shadowColor) {
        ctx.shadowColor = p.shadowColor;
        ctx.shadowBlur = 10;
      }

      const size = p.size;
      ctx.beginPath();

      // Point/Apex of the tear drop oriented downwards at (0, size)
      ctx.moveTo(0, size);

      // Left curve flowing out to the wide rounded upper cap boundary
      ctx.bezierCurveTo(-size, size * 0.5, -size, -size * 0.5, 0, -size);

      // Right curve flowing down from the cap back into the sharp apex anchor
      ctx.bezierCurveTo(size, -size * 0.5, size, size * 0.5, 0, size);

      ctx.fill();
      ctx.restore();
    } else {
      const currentSize = p.type === undefined ? p.size * p.life : p.size;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (p.shadowColor) { ctx.shadowColor = p.shadowColor; ctx.shadowBlur = p.life * 15; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // --- PASS 3: THE TOP LAYER (RUNS ONLY FOR FLOATING TEXT PARTICLES) ---
  particles.forEach((p) => {
    if (p.type === 'floatingText') {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = `bold ${p.size}px 'EnchantedLand', sans-serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Drop shadow for crisp text contrast
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;

      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  });
}

/**
 * Replicates your exact 'caughtInGyre' violent wobble orbital CSS keyframe animation.
 * @param ctx - The Canvas rendering context
 * @param time - Current loop timestamp in milliseconds
 * @param consumedGyres - The movement flag (1 or -1) to influence direction/speed
 */
function applyCaughtInGyreTransform(ctx: CanvasRenderingContext2D, time: number, consumedGyres: number) {
  // Loop speed matching your original '1s linear infinite' configuration
  // time * 0.002 * Math.PI completes 1 full cycle every 1000ms
  const speedModifier = 1.0;
  const angle = (time * 0.002 * Math.PI * speedModifier) * consumedGyres;

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
