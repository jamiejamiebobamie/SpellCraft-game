import { PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../DataClasses/types";

export function drawQuicken(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, cellCols: number, time: number) {
    ctx.save();

    // Use time variables to cleanly toggle randomized lightning jagged nodes every few frames
    const seed1 = Math.floor(time / 60);
    const seed2 = Math.floor(time * 2 / 60);
    const seed3 = Math.floor(time * 3 / 60);

    // Set glow state profile
    ctx.shadowColor = PALETTE.lightningMain;
    ctx.shadowBlur = 15;

    const coreThickness = w * .15 / cellCols;
    const x1: number = 0, y: number = h / 2, x2: number = w, crests: number = 4, amplitude: number = h / 5;

    // CENTER BOLT
    drawLightningBranch(ctx, x1, y, x2, y, crests, amplitude, seed1, PALETTE.lightningMain, coreThickness, 0);
    if (cellCols > 1) {
        // BOTTOM BOLT
        drawLightningBranch(ctx, x1, y, x2, y, crests, amplitude, seed3, PALETTE.lightningMain, coreThickness / 2, -.5);
        // // TOP BOLT
        drawLightningBranch(ctx, x1, y, x2, y, crests, amplitude, seed2, PALETTE.lightningMain, coreThickness / 2, .5);
    } else {
        // Repeat CENTER BOLT
        drawLightningBranch(ctx, x1, y, x2, y, crests, amplitude, seed1, PALETTE.lightningMain, coreThickness, 0);
    }

    ctx.restore();
}

export function getAsymmetricTaper(x: number): number {
    // Ensure the input stays strictly bounded between 0 and 1
    const clampedX = Math.max(0, Math.min(1, x));

    const peak = 0.7;

    if (clampedX <= peak) {
        // --- LEFT SIDE FALLOFF ---
        // Slopes up from 0 (at x = 0) to 1 (at x = 0.7)
        // Adjust the subtraction factor if you don't want it starting all the way at 0
        return clampedX / peak;
    } else {
        // --- RIGHT SIDE FALLOFF (QUICKER) ---
        // Slopes down from 1 (at x = 0.7) to 0 (at x = 1.0)
        // Because it must drop 1 full unit over a distance of only 0.3, it naturally falls off ~2.3x faster
        return (1.0 - clampedX) / (1.0 - peak);
    }
}


function drawLightningBranch(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    crests: number,
    amplitude: number,
    seed: number,
    color: string,
    thickness: number,
    offset: number
) {
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    // Create displacement points along horizontal axis
    const segments = Math.pow(2, crests);
    for (let i = 1; i < segments; i++) {
        const ratio = i / segments;
        const rx = x1 + (x2 - x1) * ratio;
        const ry = y1 + (y2 - y1) * ratio;

        const noise = Math.sin(seed * i * 14.23) * Math.cos(seed + i * 4.12);
        const displacement = noise * amplitude * getAsymmetricTaper(ratio) + 2 * offset * getAsymmetricTaper(ratio);// * amplitude / 3;

        points.push({ x: rx, y: ry + displacement });
    }
    // points.push({ x: x2, y: y2 });

    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // DRAW SEGMENT-BY-SEGMENT WITH CLAMPED EDGE PINCHING
    for (let i = 0; i < points.length - 1; i++) {
        const pStart = points[i];
        const pEnd = points[i + 1];

        // first and last points excluded. use segments for ratio
        const ratio = i / segments;
        let taperMultiplier = 1.0;
        if (ratio < .5) {
            // Linear scale up from 0 to 1 at the start edge
            taperMultiplier = ratio;
        } else {
            // Linear scale down from 1 to 0 at the terminating edge
            taperMultiplier = (1.0 - ratio);
        }

        ctx.beginPath();
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.globalAlpha = getAsymmetricTaper(ratio);
        ctx.lineWidth = thickness * getAsymmetricTaper(ratio) * taperMultiplier;
        ctx.stroke();
    }
}

/**
 * Emits the explosive electric shards for the Quicken spell.
 */
export function spawnQuickenParticles(particles: GameParticle[], w: number, h: number) {
    const centerX = w / 2;
    const centerY = h / 2;
    const sparkCount = 100;

    for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Velocity scales slightly with the actual width of the spell
        const speed = (Math.random() * 560 + 60) * (w / 400);

        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1.0,
            size: Math.random() * 3 + 1.5,
            color: '#b3f2ff',   // Electric blue branch color
            shadowColor: '#00d0ff',
            life: 2.0,
            decay: Math.random() * 1.5 + 2.0 // Fully dies over ~0.3 - 0.5s
        });
    }
}

/**
 * QUICKEN SPAWN (Chain Lightning)
 * Creates a blinding pure-white laser flash channel during the first 30% of spawn timeframe,
 * before cracking down to standard electric blue details.
 */
export function drawQuickenSpawn(ctx: CanvasRenderingContext2D, w: number, h: number, dir: number, cellCols: number, time: number, progress: number) {
    ctx.save();

    if (progress < 0.7) {
        // Blinding white blast frame arc
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 30;
        const seed = Math.floor(time / 30); // Multi-crackle frequency speed

        // Draw thick white line trunk
        drawLightningBranch(ctx, 0, h / 2, w, h / 2, 4, h * 0.4, seed, '#ffffff', w * 0.12, 0);
    } else {
        // Smoothly fade down to normal lightning thickness
        drawQuicken(ctx, w, h, dir, cellCols, time);
    }

    ctx.restore();
}


export function spawnQuickenHitParticles(particles: GameParticle[], targetX: number, targetY: number, boardHeight: number) {
    const shockLinesCount = 6;

    for (let i = 0; i < shockLinesCount; i++) {
        particles.push({
            x: targetX + (Math.random() * 40 - 20),
            // Spread out vertically over the character height area
            y: targetY + (i - shockLinesCount / 2) * (boardHeight * 0.15),
            vx: 0,
            vy: 0, // Shocks stay locked in place to look like a direct discharge
            alpha: 1.0,
            // Store the width/amplitude of this individual shock line in 'size'
            size: Math.random() * 50 + 40,
            color: '#00d0ff',
            shadowColor: '#b3f2ff',
            rotation: Math.random() * Math.PI * 2, // Random angle for the shock bolt
            life: 1.0,
            decay: Math.random() * 1.5 + 2.5, // Quick, erratic lifetime (~0.35s)
            type: 'electricShock'
        });
    }
}
