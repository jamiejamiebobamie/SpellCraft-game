/**
 * After a great Phlegm's splash (PHLEGM_SPLASH), water lands on the "lens": drops over the whole scene, as if
 * splashed onto the camera. Each lands a moment after the splash (delay, seconds: a range), clings a while
 * (cling), then runs down, gathering speed (fallSpeed: x the view's width a second, at most), leaving a faint wet
 * streak, and fades out (fadeSeconds) by the end of its life (seconds). count: how many per splash; size: a
 * drop's radius, x the view's width (a range).
 */
export const LENS_DROPS = { count: 9, delay: [0.15, 0.7], cling: [0.3, 1.2], fallSpeed: 0.09, seconds: [2.8, 4], fadeSeconds: 0.8, size: [0.008, 0.024] };

export type LensDrop = { x: number; y: number; startY: number; r: number; age: number; delay: number; cling: number; life: number; vy: number; sway: number };

const between = ([lo, hi]: Array<number>) => lo + Math.random() * (hi - lo);

/** Splashes drops onto the lens, anywhere over the view (viewW x viewH). */
export function spawnLensDrops(drops: Array<LensDrop>, viewW: number, viewH: number): void {
  for (let k = 0; k < LENS_DROPS.count; k++) {
    const y = viewH * (0.08 + Math.random() * 0.7);
    drops.push({
      x: viewW * (0.05 + Math.random() * 0.9), y, startY: y, r: between(LENS_DROPS.size) * viewW,
      age: 0, delay: between(LENS_DROPS.delay), cling: between(LENS_DROPS.cling), life: between(LENS_DROPS.seconds),
      vy: 0, sway: Math.random() * Math.PI * 2,
    });
  }
}

/** Moves and draws the drops (on top of everything), dropping those that are done. */
export function updateAndDrawLensDrops(ctx: CanvasRenderingContext2D, drops: Array<LensDrop>, deltaTime: number, viewW: number): void {
  for (let k = drops.length - 1; k >= 0; k--) {
    const d = drops[k];
    d.age += deltaTime;
    const t = d.age - d.delay; // (time since it landed)
    if (t >= d.life) { drops.splice(k, 1); continue; }
    if (t < 0) continue;
    // Clinging, then running down: faster as it goes, wandering a little side to side
    if (t > d.cling) {
      d.vy = Math.min(LENS_DROPS.fallSpeed * viewW, d.vy + LENS_DROPS.fallSpeed * viewW * 1.5 * deltaTime);
      d.y += d.vy * deltaTime;
      d.x += Math.sin(t * 3 + d.sway) * d.r * 0.4 * deltaTime;
    }
    const landing = Math.min(1, t / 0.12); // (it splats on: grows in quickly)
    const alpha = Math.min(landing, (d.life - t) / LENS_DROPS.fadeSeconds, 1);
    const stretch = 1 + Math.min(0.5, d.vy / (LENS_DROPS.fallSpeed * viewW) * 0.5); // (longer as it runs)
    const r = d.r * (0.6 + 0.4 * landing);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    // The wet streak it leaves, from where it landed
    if (d.y - d.startY > r) {
      const streak = ctx.createLinearGradient(0, d.startY, 0, d.y);
      streak.addColorStop(0, 'rgba(200, 225, 255, 0)');
      streak.addColorStop(1, 'rgba(200, 225, 255, 0.16)');
      ctx.strokeStyle = streak;
      ctx.lineWidth = r * 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, d.startY); ctx.lineTo(d.x, d.y - r * 0.5); ctx.stroke();
    }
    // The drop: clear water, a darker rim (the light bent at its edge), brighter low down, a glint up top
    ctx.translate(d.x, d.y);
    ctx.scale(1, stretch);
    const body = ctx.createRadialGradient(0, r * 0.25, r * 0.1, 0, 0, r);
    body.addColorStop(0, 'rgba(235, 245, 255, 0.10)');
    body.addColorStop(0.7, 'rgba(200, 220, 240, 0.14)');
    body.addColorStop(0.92, 'rgba(40, 55, 75, 0.38)');
    body.addColorStop(1, 'rgba(40, 55, 75, 0)');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath(); ctx.ellipse(r * 0.28, r * 0.42, r * 0.28, r * 0.1, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
