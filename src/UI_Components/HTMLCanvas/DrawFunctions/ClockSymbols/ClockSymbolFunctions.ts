import { CanvasScrollUI } from '../../../../DataClasses/types';
import { draw4PointStar } from '../Sparkles/SparkleFunctions';

const iceSilverColors = ['#e6f7ff', '#b3d9ff', '#ffffff', '#d9f2ff', '#ccf2ff'];

export const drawClockAdvanceSymbols = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number, viewH: number, currentTime: number) => {
    ctx.save();
    const spiritFade = 0.45 + Math.sin(currentTime * 0.001) * 0.4;
    ctx.globalAlpha = Math.max(0.05, Math.min(0.85, spiritFade));
    ctx.shadowColor = '#b3e6ff';
    ctx.shadowBlur = 10;

    const clockCX = viewW * 0.5;
    const clockCY = viewH * 0.2;
    const orbitDistance = viewW * 0.08 * spiritFade;

    const shapes = ['diamond', 'circleDot', 'hourglass'];
    const pool = ui.clockGeometricSparkles;
    shapes.forEach((shapeType, sIdx) => {
        const baseAngle = (sIdx * (Math.PI * 2)) / 3 + (currentTime * 0.0008);
        const shapeCX = clockCX + Math.cos(baseAngle) * orbitDistance * (1 + sIdx * .1);
        const shapeCY = clockCY + Math.sin(baseAngle) * orbitDistance * (Math.sin(1 + sIdx * .1)) + Math.sin(currentTime * 0.003 + sIdx * 2) * 3;
        const size = viewW * 0.012;
        ctx.save();
        ctx.strokeStyle = 'rgba(230, 247, 255, 0.15)';
        ctx.lineWidth = 1.5;
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
            ctx.arc(shapeCX, shapeCY, 1.2, 0, Math.PI * 2);
        } else if (shapeType === 'hourglass') {
            ctx.moveTo(shapeCX - size * 0.8, shapeCY - size * 0.8);
            ctx.lineTo(shapeCX + size * 0.8, shapeCY - size * 0.8);
            ctx.lineTo(shapeCX - size * 0.2, shapeCY);
            ctx.lineTo(shapeCX + size * 0.8, shapeCY + size * 0.8);
            ctx.lineTo(shapeCX - size * 0.8, shapeCY + size * 0.8);
            ctx.lineTo(shapeCX + size * 0.2, shapeCY);
            ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
        if (Math.random() < .3 && pool.length < 120) {
            let spawnedPt = { x: shapeCX, y: shapeCY };
            const randRatio = Math.random();
            if (shapeType === 'diamond') {
                const p = Math.floor(Math.random() * 4);
                if (p === 0) { spawnedPt.x = shapeCX + (size * 0.8) * randRatio; spawnedPt.y = shapeCY - size * (1 - randRatio); }
                else if (p === 1) { spawnedPt.x = shapeCX + (size * 0.8) * (1 - randRatio); spawnedPt.y = shapeCY + size * randRatio; }
                else if (p === 2) { spawnedPt.x = shapeCX - (size * 0.8) * randRatio; spawnedPt.y = shapeCY + size * (1 - randRatio); }
                else { spawnedPt.x = shapeCX - (size * 0.8) * (1 - randRatio); spawnedPt.y = shapeCY - size * randRatio; }
            } else if (shapeType === 'circleDot') {
                if (Math.random() > 0.2) {
                    const angle = Math.random() * Math.PI * 2;
                    spawnedPt.x = shapeCX + Math.cos(angle) * (size * 0.8);
                    spawnedPt.y = shapeCY + Math.sin(angle) * (size * 0.8);
                }
            } else if (shapeType === 'hourglass') {
                if (Math.random() > 0.5) {
                    const xOffset = (size * 0.8) * (1 - randRatio);
                    spawnedPt.x = shapeCX + (Math.random() > 0.5 ? xOffset : -xOffset);
                    spawnedPt.y = shapeCY - size * 0.8 * (1 - randRatio);
                } else {
                    const xOffset = (size * 0.8) * (1 - randRatio);
                    spawnedPt.x = shapeCX + (Math.random() > 0.5 ? xOffset : -xOffset);
                    spawnedPt.y = shapeCY + size * 0.8 * (1 - randRatio);
                }
            }
            pool.push({
                x: spawnedPt.x,
                y: spawnedPt.y,
                size: Math.random() * 1.6 + 0.4,
                alpha: 0,
                rate: Math.random() * 0.08 + 0.04,
                phase: 0,
                maxAlpha: Math.random() * 0.9 + 0.1,
                color: iceSilverColors[Math.floor(Math.random() * iceSilverColors.length)]
            });
        }
    });
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
        ctx.globalAlpha = p.alpha * spiritFade;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        if (Math.random() > 0.8) {
            draw4PointStar(ctx, p.x, p.y, p.size * 2, p.size * 0.4);
        } else {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
};