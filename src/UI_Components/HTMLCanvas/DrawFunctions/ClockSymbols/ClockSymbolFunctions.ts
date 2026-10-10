import { CanvasScrollUI } from '../../../../DataClasses/types';
import { draw4PointStar } from '../Sparkles/SparkleFunctions';
import { rootGameStore } from '../../../../DataClasses/store';

// const iceSilverColors = ['#e6f7ff', '#b3d9ff', '#ffffff', '#d9f2ff', '#ccf2ff'];
const pixieColors = ['#FFF7C2', '#FFE53B', '#FFFFFF', '#A6FFEA', '#FFBBE1'];
// const goldColors = ['#ffd700', '#ffdf00', '#f3ce13', '#fff3a8'];
// const silverColors = ['#e6e6e6', '#cccccc', '#f2f2f2', '#ffffff'];

const magicThemeColors = pixieColors;//[...iceSilverColors, ...pixieColors, ...goldColors, ...silverColors];

const shapes = ['diamond', 'circleDot', 'hourglass', 'rhombus', 'lopsidedX', 'dot'];

export const drawClockAdvanceSymbols = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number, viewH: number, currentTime: number) => {
    ctx.save();
    
    // Master opacity modulator
    const spiritFade = 0.45 + Math.sin(currentTime * 0.001) * 0.4;
    ctx.globalAlpha = Math.max(0.05, Math.min(0.85, spiritFade));

    // const clockCX = viewW * 0.5;
    // const clockCY = viewH * 0.2;
    // const clockFaceRadius = viewW * 0.12; 

    
    const clockCX = viewW * 0.5;
    const clockCY = viewH * 0.2;
    const clockFaceRadius = viewW * 1; 

    const pool = ui.clockGeometricSparkles;

    // --- STEP 1: HIGH FREQUENCY PARTICLE SPARKING ---
    // Increased spawn rate (0.65) to produce a rich background field of magic bursts
    if (Math.random() < 0.65 && pool.length < 50/*180*/) {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * clockFaceRadius;
        const sparkleX = clockCX + Math.cos(randomAngle) * randomDist;
        const sparkleY = clockCY + Math.sin(randomAngle) * randomDist;

        const isGlitterStar = Math.random() < 0.4;

        pool.push({
            x: sparkleX,
            y: sparkleY,
            size: isGlitterStar ? Math.random() * 2.5 + 1.2 : Math.random() * 1.6 + 0.4,
            alpha: 0,
            rate: Math.random() * 0.02 + 0.015, // Slower decay makes individual sparkles linger longer
            phase: 0,
            maxAlpha: isGlitterStar ? Math.random() * 0.3 + 0.7 : Math.random() * 0.8 + 0.2,
            color: magicThemeColors[Math.floor(Math.random() * magicThemeColors.length)],
            isStar: isGlitterStar
        });
    }

    // --- STEP 2: HYPERSPACE-DRIFTING GHOST SYMBOLS ---
    shapes.forEach((shapeType, sIdx) => {
        // 1. HIGHER FREQUENCY & LONGER LIFE: Slower time modifier (0.0006) lets them persist on screen twice as long
        // Using decoupled offsets allows multiple shapes to cycle onto the screen concurrently
        // const uniqueTimeSeed = currentTime * 0.0006 + (sIdx * 3.1415 * 0.33);
        const uniqueTimeSeed = currentTime * 0.0003 + (sIdx * 3.1415 * 0.33);
        
        // Progress of the active wave (0.0 to 1.0 across its visible lifetime)
        const lifeProgress = (uniqueTimeSeed % Math.PI) / Math.PI;
        
        // Ghost alpha curve: rises fast, stays visible during the rush, then fades out smoothly at the edge
        const ghostAlpha = Math.sin(lifeProgress * Math.PI);
        if (ghostAlpha <= 0.01) return;

        // Static seed generation tied to the current oscillation cycle loop
        const loopId = Math.floor(uniqueTimeSeed / Math.PI);
        const seededRandom1 = Math.sin(loopId * 453.12 + sIdx) * 0.5 + 0.5;
        const seededRandom2 = Math.cos(loopId * 921.83 - sIdx) * 0.5 + 0.5;

        // Base spatial launch parameters originating closer to the center core for a true tunnel view
        const spawnAngle = seededRandom1 * Math.PI * 2;
        const initialRadius = seededRandom2 * clockFaceRadius * 0.1; 

        // 2. EXPONENTIAL OUTWARD TRANSLATION SPEED:
        // Squaring lifeProgress creates an accelerating "rush" profile outward over time
        // const warpSpeedFactor = Math.pow(lifeProgress, 1.8);
        const warpSpeedFactor = Math.pow(lifeProgress, 3);
        const currentDistance = initialRadius + (clockFaceRadius * 1.4) * warpSpeedFactor;

        const shapeCX = clockCX + Math.cos(spawnAngle) * currentDistance;
        const shapeCY = clockCY + Math.sin(spawnAngle) * currentDistance;

        // 3. HYPERSPACE SCALE DEPTH:
        // Shapes scale up dynamically as they get closer to the camera lens viewport
        const perspectiveScale = 0.4 + lifeProgress * 1.2;
        const baseSize = viewW * 0.009;
        const size = baseSize * perspectiveScale;

        ctx.save();
        ctx.globalAlpha = ghostAlpha * spiritFade;
        ctx.strokeStyle = 'rgba(255, 247, 194, 0.15)';
        ctx.fillStyle = 'rgba(255, 247, 194, 0.01)'; 
        ctx.lineWidth = 1.2 + perspectiveScale * 0.5; // Stroke thickens slightly as it gets closer
        ctx.shadowColor = '#fff3a8';
        ctx.shadowBlur = 6 + perspectiveScale * 4;
        
        ctx.beginPath();
        
        if (shapeType === 'diamond') {
            ctx.moveTo(shapeCX, shapeCY - size);
            ctx.lineTo(shapeCX + size * 0.8, shapeCY);
            ctx.lineTo(shapeCX, shapeCY + size);
            ctx.lineTo(shapeCX - size * 0.8, shapeCY);
            ctx.closePath();
        } else if (shapeType === 'circleDot') {
            ctx.arc(shapeCX, shapeCY, size * 0.8, 0, Math.PI * 2);
            ctx.moveTo(shapeCX + 1, shapeCY);
            ctx.arc(shapeCX, shapeCY, 1.2 * perspectiveScale, 0, Math.PI * 2);
        } else if (shapeType === 'hourglass') {
            ctx.moveTo(shapeCX - size * 0.8, shapeCY - size * 0.8);
            ctx.lineTo(shapeCX + size * 0.8, shapeCY - size * 0.8);
            ctx.lineTo(shapeCX - size * 0.2, shapeCY);
            ctx.lineTo(shapeCX + size * 0.8, shapeCY + size * 0.8);
            ctx.lineTo(shapeCX - size * 0.8, shapeCY + size * 0.8);
            ctx.lineTo(shapeCX + size * 0.2, shapeCY);
            ctx.closePath();
        } else if (shapeType === 'rhombus') {
            ctx.moveTo(shapeCX, shapeCY - size * 0.6);
            ctx.lineTo(shapeCX + size * 1.1, shapeCY);
            ctx.lineTo(shapeCX, shapeCY + size * 0.6);
            ctx.lineTo(shapeCX - size * 1.1, shapeCY);
            ctx.closePath();
        } else if (shapeType === 'lopsidedX') {
            ctx.moveTo(shapeCX - size * 0.9, shapeCY - size * 0.5);
            ctx.lineTo(shapeCX + size * 0.7, shapeCY + size * 0.8);
            ctx.moveTo(shapeCX + size * 0.6, shapeCY - size * 0.7);
            ctx.lineTo(shapeCX - size * 0.8, shapeCY + size * 0.6);
        } else if (shapeType === 'dot') {
            ctx.arc(shapeCX, shapeCY, size * 0.45, 0, Math.PI * 2);
        }

        if (shapeType === 'dot') {
            ctx.fillStyle = 'rgba(255, 247, 194, 0.65)';
            ctx.fill();
        } else if (shapeType === 'lopsidedX') {
            ctx.stroke(); // Don't try to fill the overlapping wire strokes
        } else {
            ctx.stroke();
            ctx.fill();
        }
        ctx.restore();
    });

    const backgroundSceneBrightness = rootGameStore.getBackgroundSceneBrightness() * 1.1;

    // --- STEP 3: RENDER THE TOTAL PARTICLE POOL ---
    for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        if (p.phase === 0) {
            p.alpha += p.rate;
            if (p.alpha >= p.maxAlpha) { p.alpha = p.maxAlpha; p.phase = 1; }
        } else {
            p.alpha -= p.rate;
        }
        if (p.alpha <= 0) {
            pool.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.isStar ? p.alpha * backgroundSceneBrightness : p.alpha * spiritFade * backgroundSceneBrightness;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.isStar ? p.size * 5 : p.size * 3;
        ctx.shadowColor = p.color;
        
        if (p.isStar) {
            draw4PointStar(ctx, p.x, p.y, p.size * 2.8, p.size * 0.45);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
};
