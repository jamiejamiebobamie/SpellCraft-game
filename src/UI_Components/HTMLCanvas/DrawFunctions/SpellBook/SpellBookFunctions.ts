import { rootGameStore } from '../../../../DataClasses/store';
import { CanvasScrollUI } from '../../../../DataClasses/types';
import { draw4PointStar } from '../Sparkles/SparkleFunctions';
import { HARDCODED_SYMBOLS_FOR_DISPLAY } from '../../../../DataClasses/PlacedSpells/HardCodedSymbolsForDisplay';
import { GameSymbol } from '../../../../DataClasses/PlacedSpells/GameSymbol';
import { drawProceduralSpell, spawnPreviewSpellParticles, updateAndDrawParticles } from '../RenderSpells/renderSpells';
import { SpellAnimTracker } from '../../../../DataClasses/types';
import { SPELL_CLASSES, SpellName } from '../../../../DataClasses/GameRules/GameSimulation';
import { getFocusCost } from '../../../../DataClasses/GameRules/gameRules';

const displayNameLookup = new Map<string, string>([
    ['GyreDown', 'Downdraft'],
    ['GyreUp', 'Updraft'],
    ['Ether', 'Fireball'],
    ['Phlegm', 'Water Wheel'],
    ['Quicken', 'Chain Lightning'],
]);

export const pixieColors = ['#FFF7C2', '#FFE53B', '#FFFFFF', '#A6FFEA', '#FFBBE1'];

export const availableSymbols = Array.from(GameSymbol.SPELL_LOOKUP.entries()).map(([inferenceString, spellClass]) => ({
    inferenceString,
    spellName: spellClass.spellName,
    points: HARDCODED_SYMBOLS_FOR_DISPLAY.get(inferenceString) || []
}));

export const runGlobalBookSparkles = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number) => {
    const isTrayOpen = rootGameStore.getIsSpellBookOpen();
    const baseAnchorX = viewW * ui.config.startXOffset;
    const baseAnchorY = viewW * ui.config.startYOffset;
    const trayH = viewW * ui.config.scrollTrayHeight;
    const currentW = (viewW * ui.config.maxScrollWidth) * ui.trayProgress;
    const goldColors = ['#ffd700', '#ffdf00', '#f3ce13', '#fff3a8'];
    const silverColors = ['#e6e6e6', '#cccccc', '#f2f2f2', '#ffffff'];
    if (ui.bookSparkles.length < 45 && Math.random() < 0.18) {
        const isGold = Math.random() > 0.5;
        const pool = isGold ? goldColors : silverColors;
        let spawnX = baseAnchorX + (Math.random() * 40 - 20);
        let spawnY = baseAnchorY + trayH * 0.3 + (Math.random() * 20 - 10);
        if (isTrayOpen && ui.trayProgress > 0.3 && Math.random() > 0.4) {
            spawnX = baseAnchorX + (Math.random() * currentW);
            spawnY = baseAnchorY + trayH * 0.85 + (Math.random() * 6 - 3);
        }
        ui.bookSparkles.push({
            x: spawnX, y: spawnY, size: Math.random() * 2.2 + 0.8,
            speedY: Math.random() * 0.3 + 0.15, speedX: (Math.random() - 0.5) * 0.25,
            alpha: Math.random() * 0.6 + 0.4, decay: Math.random() * 0.005 + 0.002,
            color: pool[Math.floor(Math.random() * pool.length)]
        });
    }
    for (let i = ui.bookSparkles.length - 1; i >= 0; i--) {
        const p = ui.bookSparkles[i]; if (!p) continue; p.y += p.speedY; p.x += p.speedX; p.alpha -= p.decay;
        if (p.alpha <= 0) { ui.bookSparkles.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.quadraticCurveTo(p.x, p.y, p.x + p.size, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + p.size);
        ctx.quadraticCurveTo(p.x, p.y, p.x - p.size, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - p.size);
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
};

export const drawProceduralScroll = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number, viewH: number, deltaTime: number, currentTime: number, setIsHovered: Function, animStates: Map<string, SpellAnimTracker>) => {
    const isTrayOpen = rootGameStore.getIsSpellBookOpen();
    const targetProgress = isTrayOpen ? 1.0 : 0.0;
    ui.trayProgress += (targetProgress - ui.trayProgress) * 5.5 * deltaTime;
    if (ui.trayProgress < 0.002) return;
    const startX = viewW * ui.config.startXOffset;
    const topY = viewW * ui.config.startYOffset;
    const trayH = viewW * ui.config.scrollTrayHeight;
    const bottomY = topY + trayH;
    const currentMaxW = viewW * ui.config.maxScrollWidth;
    const currentW = currentMaxW * ui.trayProgress;
    const rightEdgeX = startX + currentW;
    ctx.save();
    const activeTrayAlpha = Math.min(1.0, ui.trayProgress);
    ctx.globalAlpha = activeTrayAlpha;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    for (let x = startX; x <= rightEdgeX; x += 12) {
        const waveY = topY + (Math.sin(x * 0.04 + currentTime * 0.003) * 2.2);
        ctx.lineTo(x, waveY);
    }
    for (let y = topY; y <= bottomY; y += 6) {
        const windWave = isTrayOpen ? Math.sin(y * 0.08 + currentTime * 0.002) * (viewW * 0.001) * ui.trayProgress : 0;
        const paperNick = Math.cos(y * 0.12) * 1.2 + (y % 18 === 0 ? -3.5 : 0);
        ctx.lineTo(rightEdgeX + paperNick + windWave, y);
    }
    for (let x = rightEdgeX; x >= startX; x -= 12) {
        const waveY = bottomY + (Math.cos(x * 0.04 + currentTime * 0.003) * 2.2);
        ctx.lineTo(x, waveY);
    }
    ctx.lineTo(startX, topY);
    ctx.closePath();
    const baseGradient = ctx.createLinearGradient(startX, topY, rightEdgeX, bottomY);
    baseGradient.addColorStop(0, '#c68f4c');
    baseGradient.addColorStop(0.25, '#d3c69a');
    baseGradient.addColorStop(0.5, '#ada487');
    baseGradient.addColorStop(0.85, '#cfc39c');
    baseGradient.addColorStop(1, '#db9b48');
    ctx.fillStyle = baseGradient;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(84, 54, 25, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    if (currentW > viewW * 0.05) {
        ctx.save();
        ctx.strokeStyle = 'rgba(92, 45, 15, 0.18)';
        ctx.lineWidth = 1.2;
        const stepDist = 8;
        ctx.beginPath();
        for (let mx = startX + 6; mx < rightEdgeX - 6; mx += stepDist) {
            const activeTopWaveY = topY + (Math.sin(mx * 0.04 + currentTime * 0.003) * 2.2);
            ctx.moveTo(mx, activeTopWaveY + 4);
            ctx.lineTo(mx + 3, activeTopWaveY + 8);
            ctx.lineTo(mx + 6, activeTopWaveY + 4);
            const activeBottomWaveY = bottomY + (Math.cos(mx * 0.04 + currentTime * 0.003) * 2.2);
            ctx.moveTo(mx, activeBottomWaveY - 4);
            ctx.lineTo(mx + 3, activeBottomWaveY - 8);
            ctx.lineTo(mx + 6, activeBottomWaveY - 4);
        }
        ctx.stroke();
        ctx.restore();
    }
    const isShowingModal = !!ui.hoveredSpellName && isTrayOpen;
    if (!isShowingModal && currentW >= currentMaxW * 0.9) {
        drawSinusoidalFloatingMessage(ctx, ui, viewW, startX, bottomY, currentTime, activeTrayAlpha);
    }
    const leftPadding = viewW * (ui.config.paddingX + 0.025);
    const rightPadding = viewW * (ui.config.paddingX + 0.02);
    const drawZoneW = currentW - leftPadding - rightPadding;
    const spacingX = drawZoneW / (availableSymbols.length - 1);
    const baselineCenterY = topY + trayH * 0.45;
    const glyphBoundsDiameter = trayH * 0.6;
    let localHoveredSpell: string | null = null;
    availableSymbols.forEach((symbol, index) => {
        const relativeX = leftPadding + index * spacingX;
        if (relativeX > currentW) return;
        const symbolX = startX + relativeX;
        let symbolY = baselineCenterY;
        if (index % 2 !== 0) {
            symbolY += ui.config.zigZagOffset;
        }
        const dx = ui.currentMousePos.x - symbolX;
        const dy = ui.currentMousePos.y - symbolY;
        const isMouseHovering = Math.sqrt(dx * dx + dy * dy) < glyphBoundsDiameter * 0.65;
        let hoverScale = 1.0; let brightnessMod = 1.0;
        if (isMouseHovering && isTrayOpen) {
            localHoveredSpell = symbol.spellName; hoverScale = 1.15;
        }
        if (ui.hoveredSpellName && ui.hoveredSpellName !== symbol.spellName) {
            brightnessMod = 0.35;
        }
        const state = ui.getSymbolState(symbol.spellName);
        if (state.progress < 1.0) {
            state.progress += ui.config.symbolDrawSpeed * deltaTime;
        } else if (state.progress >= 1.0 && !state.loopTimeout && isTrayOpen) {
            state.loopTimeout = setTimeout(() => {
                state.progress = 0;
                state.particles = [];
                state.loopTimeout = null;
            }, 4000);
        }
        ctx.save();
        ctx.translate(symbolX, symbolY);
        ctx.scale(hoverScale, hoverScale);
        if (brightnessMod < 1.0) ctx.filter = `brightness(${brightnessMod})`;
        if (symbol.points.length > 0) {
            let pts = symbol.points; let segments: number[] = []; let totalLen = 0;
            for (let k = 0; k < pts.length - 1; k++) {
                let lx = pts[k + 1].x - pts[k].x; let ly = pts[k + 1].y - pts[k].y;
                let length = Math.sqrt(lx * lx + ly * ly);
                segments.push(length); totalLen += length;
            }
            ctx.save();
            ctx.translate(-glyphBoundsDiameter * 0.5, -glyphBoundsDiameter * 0.5);
            const tremor = viewW * 0.0005;
            ctx.translate((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor);
            ctx.rotate((Math.random() - 0.5) * 0.01);
            ctx.lineWidth = glyphBoundsDiameter * 0.035;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = '#f7cb44';
            ctx.shadowBlur = glyphBoundsDiameter * 0.04; ctx.shadowColor = '#e8dfb9';
            ctx.beginPath();
            if (pts.length > 0 && pts[0]) {
                ctx.moveTo(pts[0].x * glyphBoundsDiameter, pts[0].y * glyphBoundsDiameter);
            }
            const activeTargetLength = state.progress * totalLen;
            let currentAccumulated = 0;
            let tipX = (pts.length > 0 && pts[0]) ? pts[0].x * glyphBoundsDiameter : 0;
            let tipY = (pts.length > 0 && pts[0]) ? pts[0].y * glyphBoundsDiameter : 0;
            if (state.progress >= 1.0) {
                for (let m = 1; m < pts.length; m++) {
                    const p = pts[m] as any;
                    if (p.moveTo) {
                        ctx.moveTo(p.x * glyphBoundsDiameter, p.y * glyphBoundsDiameter);
                    } else {
                        ctx.lineTo(p.x * glyphBoundsDiameter, p.y * glyphBoundsDiameter);
                    }
                }
                if (pts.length > 0 && pts[pts.length - 1]) {
                    tipX = pts[pts.length - 1].x * glyphBoundsDiameter;
                    tipY = pts[pts.length - 1].y * glyphBoundsDiameter;
                }
            } else {
                for (let m = 0; m < pts.length - 1; m++) {
                    let p1 = pts[m]; let p2 = pts[m + 1]; let segLen = segments[m];
                    if (p1 && p2 && currentAccumulated + segLen >= activeTargetLength) {
                        let rem = activeTargetLength - currentAccumulated;
                        let ratio = segLen > 0 ? rem / segLen : 0;
                        tipX = (p1.x + (p2.x - p1.x) * ratio) * glyphBoundsDiameter;
                        tipY = (p1.y + (p2.y - p1.y) * ratio) * glyphBoundsDiameter;
                        ctx.lineTo(tipX, tipY);
                        break;
                    } else if (p2) {
                        ctx.lineTo(p2.x * glyphBoundsDiameter, p2.y * glyphBoundsDiameter);
                        currentAccumulated += segLen;
                        tipX = p2.x * glyphBoundsDiameter; tipY = p2.y * glyphBoundsDiameter;
                    }
                }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            if (state.progress < 1.0) {
                for (let pCount = 0; pCount < 2; pCount++) {
                    state.particles.push({
                        x: tipX + (Math.random() - 0.5) * (glyphBoundsDiameter * 0.03),
                        y: tipY + (Math.random() - 0.5) * (glyphBoundsDiameter * 0.03),
                        size: Math.random() * (glyphBoundsDiameter * 0.009) + 0.4,
                        vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.7) * 0.5 - 0.2,
                        alpha: 1.0, decay: Math.random() * 0.024 + 0.016,
                        color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.6
                    });
                }
            }
            for (let q = state.particles.length - 1; q >= 0; q--) {
                let part = state.particles[q];
                if (!part) continue;
                part.x += part.vx; part.y += part.vy; part.vy += 0.01; part.alpha -= part.decay;
                if (part.alpha <= 0) { state.particles.splice(q, 1); continue; }
                ctx.save(); ctx.globalAlpha = part.alpha; ctx.fillStyle = part.color;
                if (part.isStar) draw4PointStar(ctx, part.x, part.y, part.size * 2, part.size * 0.5);
                else { ctx.beginPath(); ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            }
            ctx.restore();
        }
        ctx.restore();
    });
    if (localHoveredSpell !== ui.hoveredSpellName) {
        ui.hoveredSpellName = localHoveredSpell;
        setIsHovered(!!localHoveredSpell);
        if (!localHoveredSpell) {
            animStates.forEach((_, key) => {
                if (key.startsWith('modal-preview-')) {
                    animStates.delete(key);
                }
            });
            ui.sizeCycleTime = 0;
            ui.currentSizeIdx = 0;
        }
    }
    ctx.restore();
};

const drawSinusoidalFloatingMessage = (
    ctx: CanvasRenderingContext2D,
    ui: CanvasScrollUI,
    viewW: number,
    startX: number,
    bottomY: number,
    currentTime: number,
    activeTrayAlpha: number
) => {
    const message = "Hover for more info";
    ctx.save();
    ctx.globalAlpha = activeTrayAlpha;
    ctx.font = `bold ${viewW * 0.03}px 'EnchantedLand', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const verticalSpacing = viewW * 0.005;
    let runningX = startX + viewW * 0.02;
    const textSparklePool = ui.floatingTextSparkles;
    for (let i = 0; i < message.length; i++) {
        const char = message[i];
        const charW = ctx.measureText(char).width;
        const waveCharY = bottomY + (Math.cos(runningX * 0.04 + currentTime * 0.003) * 2.2);
        const targetCharY = waveCharY + verticalSpacing;
        ctx.fillStyle = 'rgba(28, 18, 5, .5)';
        ctx.fillText(char, runningX + 2, targetCharY + 2);
        ctx.fillStyle = '#f0c24de2';
        ctx.fillText(char, runningX, targetCharY);
        if (char !== ' ' && Math.random() < 0.015 && textSparklePool.length < 60) {
            textSparklePool.push({
                x: runningX + Math.random() * charW,
                y: targetCharY + Math.random() * (viewW * 0.035),
                size: Math.random() * 1.5 + 0.5,
                alpha: 0,
                maxAlpha: Math.random() * 0.7 + 0.3,
                rate: Math.random() * 4 + 2,
                color: pixieColors[Math.floor(Math.random() * pixieColors.length)]
            });
        }
        runningX += charW;
    }
    for (let pIdx = textSparklePool.length - 1; pIdx >= 0; pIdx--) {
        const p = textSparklePool[pIdx];
        p.alpha += p.rate * 0.016;
        if (p.alpha >= p.maxAlpha * 2) {
            textSparklePool.splice(pIdx, 1);
            continue;
        }
        const currentRenderAlpha = p.alpha > p.maxAlpha ? p.maxAlpha * 2 - p.alpha : p.alpha;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(activeTrayAlpha, currentRenderAlpha));
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = '#ffd700';
        ctx.beginPath();
        ctx.arc(p.x, p.y + Math.sin(currentTime * 0.002 + p.x) * 0.3, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
};

export const drawWidgetLineOverlay = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    spellKey: string,
    sizeIdx: number,
    viewW: number,
    activeCol: number,
    fadeAlpha: number
) => {
    ctx.save();
    ctx.globalAlpha = fadeAlpha;// * 0.35;

    const cellMultiplier = sizeIdx + 1;
    // Square spells (Ether, Phlegm) cover size x size cells; lines (Quicken, Gyres) cover size cells
    const spellClass = SPELL_CLASSES[spellKey as SpellName];
    const isSquare = spellKey === 'Ether' || spellKey === 'Phlegm';
    let cost = spellClass ? getFocusCost(spellClass, isSquare ? cellMultiplier * cellMultiplier : cellMultiplier) : cellMultiplier;
    let damageOrHeal = 5 * cellMultiplier;
    let speed = 1;
    let isHealing = false;
    let labelText = "Damage";

    if (spellKey === 'Ether') {
        damageOrHeal = 5 * cellMultiplier * cellMultiplier + 5;
        speed = cellMultiplier;
    } else if (spellKey === 'Quicken') {
        damageOrHeal = 5 * cellMultiplier;
        speed = 1 + cellMultiplier;
    } else if (spellKey === 'Phlegm') {
        damageOrHeal = 5 * cellMultiplier;
        isHealing = true;
        labelText = "Heal";
    } else if (spellKey === 'GyreUp' || spellKey === 'GyreDown') {
        damageOrHeal = 4 * cellMultiplier;
    }

    const isRightColumn = (activeCol === 2);
    const sideDirectionSign = isRightColumn ? -1 : 1;

    const horizontalFirstSegmentLength = (viewW * 0.015) * sideDirectionSign;
    const curveUpLengthX = (viewW * 0.02) * sideDirectionSign;
    const curveUpLengthY = viewW * 0.025;
    const horizontalEndSegmentLength = (viewW * 0.015) * sideDirectionSign;

    const pt1X = centerX;
    const pt1Y = centerY;
    const pt2X = pt1X + horizontalFirstSegmentLength;
    const pt2Y = pt1Y;
    const pt3X = pt2X + curveUpLengthX;
    const pt3Y = pt2Y - curveUpLengthY;
    const pt4X = pt3X + horizontalEndSegmentLength;
    const pt4Y = pt3Y;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f0c24d';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(pt1X, pt1Y);
    ctx.lineTo(pt2X, pt2Y);
    ctx.lineTo(pt3X, pt3Y);
    ctx.lineTo(pt4X, pt4Y);
    ctx.stroke();

    ctx.fillStyle = '#f0c24d';
    ctx.beginPath();
    ctx.arc(pt1X, pt1Y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.shadowBlur = 0;
    ctx.textAlign = isRightColumn ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${viewW * 0.022}px 'EnchantedLand', sans-serif`;

    const horizontalTextSpacer = (viewW * 0.009) * sideDirectionSign;
    const columnTextX = pt4X + horizontalTextSpacer;
    const verticalLineSpacingDelta = viewW * 0.023;
    const columnLineItems = [
        `Cost: ${cost}`,
        `${labelText}: ${damageOrHeal}`,
        `Speed: ${speed}`
    ];
    columnLineItems.forEach((textLineString, lineIndexOffset) => {
        const renderYPosition = pt4Y + (lineIndexOffset - 1) * verticalLineSpacingDelta;
        ctx.fillStyle = 'rgba(40, 25, 10, 0.7)';
        ctx.fillText(textLineString, columnTextX + 1, renderYPosition + 1);
        if (lineIndexOffset === 1) {
            // ctx.fillStyle = isHealing ? '#1abc9c' : '#c0392b';
            ctx.fillStyle = isHealing ? '#00a96b' : '#c0392b';
        } else {
            ctx.fillStyle = '#4a2d0f';
        }
        ctx.fillText(textLineString, columnTextX, renderYPosition);
    });
    ctx.restore();
};

export const drawModalDetails = (
    ctx: CanvasRenderingContext2D,
    ui: CanvasScrollUI,
    deltaTime: number,
    viewW: number,
    viewH: number,
    animStates: Map<string, SpellAnimTracker>,
    currentTime: number
) => {
    const uiState = ui;
    uiState.sizeCycleTime += deltaTime;
    if (uiState.sizeCycleTime >= 5.0) {
        uiState.sizeCycleTime -= 5.0;
        uiState.currentSizeIdx = (uiState.currentSizeIdx + 1) % 3;
    }
    let activeFadeAlpha = 1.0;
    if (uiState.sizeCycleTime < 1.0) {
        activeFadeAlpha = uiState.sizeCycleTime;
    } else if (uiState.sizeCycleTime > 4.0) {
        activeFadeAlpha = 1.0 - (uiState.sizeCycleTime - 4.0);
    }
    const currentTargetKey = uiState.hoveredSpellName || '';
    const displayTitle = displayNameLookup.get(currentTargetKey) || currentTargetKey;
    const spellDescriptions: Record<string, { desc: string; stats: string }> = {
        'Ether': {
            desc: "A crackling ball of fire,\n   Explodes on impact!\nDestroys weaker spells on collision.\nConfers +5 Damage to any spell\n   that destroys it.",
            stats: "Cost: 2 Focus / Cell             Damages: 5 Health / Cell (+5 Base)             Speed: 1 Cell / Horiz. Cell"
        },
        'Quicken': {
            desc: "A fast-traveling lightning bolt,\n   Electrocutes those it strikes.\nDestroys weaker spells on collision.\nConfers +1 Speed to any spell\n   that destroys it.",
            stats: "Cost: 2 Focus / Cell             Damages: 5 Health / Cell             Speed: 1 Cell / Horiz. Cell (+1 Base)"
        },
        'Phlegm': {
            desc: "A revolving torrent of water,\n   Heals those it touches.\nReflects stronger spells backward.",
            stats: "Cost: 1 Focus / Cell             Heals: 5 Health / Cell             Speed: 1 Cell / Horiz. Cell"
        },
        'GyreUp': {
            desc: "An upward-flowing tornado,\n   Eviscerates those in its path.\nDestroys weaker spells on collision.\nPushes stronger spells upward.\n   Note: Spells pushed off the board are destroyed.",
            stats: "Cost: 1 Focus / Cell             Damages: 4 Health / Cell             Speed: 1"
        },
        'GyreDown': {
            desc: "A downward-flowing tornado,\n   Eviscerates those in its path.\nDestroys weaker spells on collision.\nPushes stronger spells downward.\n   Note: Spells pushed off the board are destroyed.",
            stats: "Cost: 1 Focus / Cell             Damages: 4 Health / Cell             Speed: 1"
        }
    };
    const targetData = spellDescriptions[currentTargetKey] || { desc: '', stats: '' };
    const infoW = viewW * 0.76;
    const infoH = viewH * 0.7;
    const infoX = (viewW - infoW) * 0.5;
    const infoY = viewH * 0.22;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    const cardRadius = viewW * 0.012;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(infoX, infoY, infoW, infoH, cardRadius);
    else ctx.rect(infoX, infoY, infoW, infoH);
    const infoGrad = ctx.createLinearGradient(infoX, infoY, infoX + infoW, infoY + infoH);
    infoGrad.addColorStop(0, '#ebdca5');
    infoGrad.addColorStop(1, '#c5b375');
    ctx.fillStyle = infoGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 50, 24, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#4a2d0f';
    ctx.lineWidth = 1.5;
    const bPadding = viewW * 0.008;
    const bx = infoX + bPadding;
    const by = infoY + bPadding;
    const bw = infoW - bPadding * 2;
    const bh = infoH - bPadding * 2;
    ctx.strokeRect(bx, by, bw, bh);
    const cSize = viewW * 0.016;
    const drawCornerKnot = (cx: number, cy: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cSize, 0, Math.PI * 2);
        ctx.moveTo(cx - cSize * 0.5, cy);
        ctx.lineTo(cx + cSize * 0.5, cy);
        ctx.moveTo(cx, cy - cSize * 0.5);
        ctx.lineTo(cx, cy + cSize * 0.5);
        ctx.stroke();
    };
    drawCornerKnot(bx, by);
    drawCornerKnot(bx + bw, by);
    drawCornerKnot(bx, by + bh);
    drawCornerKnot(bx + bw, by + bh);
    ctx.restore();
    const firstLetter = displayTitle.charAt(0);
    const restOfTitle = displayTitle.slice(1);
    const padLeft = infoW * 0.07;
    const padTop = infoH * 0.12;
    const titleX = infoX + padLeft;
    const titleY = infoY + padTop;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `bold ${viewW * 0.075}px 'EnchantedLand', sans-serif`;
    if (currentTargetKey === 'Ether') {
        ctx.strokeStyle = '#e65c00';
        ctx.lineWidth = 6;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
        ctx.strokeStyle = '#ffb366';
        ctx.lineWidth = 2;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
    } else if (currentTargetKey === 'Quicken') {
        ctx.strokeStyle = '#00b3ff';
        ctx.lineWidth = 6;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
        ctx.strokeStyle = '#b3f0ff';
        ctx.lineWidth = 2;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
    } else if (currentTargetKey === 'Phlegm') {
        ctx.strokeStyle = '#1a936f';
        ctx.lineWidth = 6;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
        ctx.strokeStyle = '#a2e3c4';
        ctx.lineWidth = 2;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
    } else if (currentTargetKey === 'GyreUp') {
        const uGrad = ctx.createLinearGradient(titleX, titleY + viewW * 0.05, titleX, titleY - viewW * 0.012);
        uGrad.addColorStop(0, '#1a1a1a');
        uGrad.addColorStop(0.5, '#737373');
        uGrad.addColorStop(1, '#e6e6e6');
        ctx.strokeStyle = uGrad;
        ctx.lineWidth = 5;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
    } else if (currentTargetKey === 'GyreDown') {
        const dGrad = ctx.createLinearGradient(titleX, titleY + viewW * 0.05, titleX, titleY - viewW * 0.012);
        dGrad.addColorStop(0, '#e6e6e6');
        dGrad.addColorStop(0.5, '#737373');
        dGrad.addColorStop(1, '#1a1a1a');
        ctx.strokeStyle = dGrad;
        ctx.lineWidth = 5;
        ctx.strokeText(firstLetter, titleX, titleY - viewW * 0.012);
    }
    ctx.fillStyle = '#501a1a';
    ctx.fillText(firstLetter, titleX, titleY - viewW * 0.012);
    const dropCapW = ctx.measureText(firstLetter).width;
    ctx.fillStyle = '#2d1010';
    ctx.font = `bold ${viewW * 0.046}px 'EnchantedLand', sans-serif`;
    ctx.fillText(restOfTitle, titleX + dropCapW + (viewW * 0.003), titleY + viewW * 0.012);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#3a220e';
    let currentTextY = titleY + (viewW * 0.095);
    const lineHeight = viewW * 0.037;
    const linesArray = targetData.desc.split('\n');
    linesArray.forEach((lineText) => {
        if (lineText.includes("Note: Spells pushed off the board are destroyed.")) {
            ctx.font = `500 ${viewW * 0.023}px 'EnchantedLand', sans-serif`;
        } else {
            ctx.font = `500 ${viewW * 0.029}px 'EnchantedLand', sans-serif`;
        }
        ctx.fillText(lineText, titleX + (viewW * 0.02), currentTextY);
        currentTextY += lineHeight;
    });
    ctx.restore();
    // ctx.save();
    // ctx.textAlign = 'right';
    // ctx.textBaseline = 'bottom';
    // ctx.fillStyle = '#5c3317';
    // ctx.font = `bold ${viewW * 0.022}px 'EnchantedLand', sans-serif`;
    // const statsY = (infoY + infoH) - padTop;
    // ctx.fillText(targetData.stats, padRight, statsY);
    // ctx.restore();
    const gridBoxW = infoW * 0.32;
    const rightGridX = infoX + infoW * 0.6;
    const rightGridY = titleY + (viewW * 0.03);
    ctx.save();
    ctx.translate(rightGridX, rightGridY);
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillStyle = '#443b1c67';//'rgba(0, 0, 0, 0.37)';
    ctx.fillRect(0, 0, gridBoxW, gridBoxW);
    const gridCellsCount = 3;
    const cellSz = gridBoxW / gridCellsCount;
    ctx.strokeStyle = 'rgba(74, 50, 24, 0.15)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= gridCellsCount; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * cellSz); ctx.lineTo(gridBoxW, r * cellSz); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * cellSz, 0); ctx.lineTo(r * cellSz, gridBoxW); ctx.stroke();
    }
    let targetWidgetCenterX = 0;
    let targetWidgetCenterY = 0;
    let currentActiveGridCol = 0;
    const drawPreviewSpellWithParticles = (tw: number, th: number, ox: number, oy: number) => {
        const fakeSpellInstance = {
            id: `modal - preview - ${currentTargetKey}-${tw} -${th}`,
            constructor: { spellName: currentTargetKey },
            getPropertyValue: (prop: string) => {
                if (prop === 'widthCells') return tw;
                if (prop === 'heightCells') return th;
                if (prop === 'speedDirection') return 1;
                return 0;
            }
        };
        const wPx = cellSz * tw;
        const hPx = cellSz * th;
        if (!animStates.has(fakeSpellInstance.id)) {
            animStates.set(fakeSpellInstance.id, { spawnProgress: 1.0, deathProgress: 0, hasSpawnedParticles: false, particles: [] } as any);
        }
        const pAnim = animStates.get(fakeSpellInstance.id)!;
        spawnPreviewSpellParticles(currentTargetKey, pAnim.particles, wPx, hPx, currentTime);
        targetWidgetCenterX = rightGridX + (ox * cellSz) + (wPx / 2);
        targetWidgetCenterY = rightGridY + (oy * cellSz) + (hPx / 2);
        currentActiveGridCol = ox + Math.floor((tw - 1) / 2);
        ctx.save();
        ctx.globalAlpha = activeFadeAlpha;
        ctx.translate(ox * cellSz, oy * cellSz);
        drawProceduralSpell(ctx, fakeSpellInstance, cellSz, cellSz, currentTime, 1.0);
        if (pAnim && pAnim.particles.length > 0) {
            updateAndDrawParticles(ctx, pAnim.particles, deltaTime);
        }
        ctx.restore();
    };
    if (currentTargetKey === 'Ether' || currentTargetKey === 'Phlegm') {
        const gridColorsArray = currentTargetKey === 'Ether'
            ? ['rgba(230,57,70,0.18)', 'rgba(230,57,70,0.12)', 'rgba(230,57,70,0.06)']
            : ['rgba(78,168,222,0.18)', 'rgba(78,168,222,0.12)', 'rgba(78,168,222,0.06)'];
        const sIdx = uiState.currentSizeIdx + 1;
        ctx.fillStyle = gridColorsArray[sIdx - 1];
        ctx.save();
        ctx.globalAlpha = activeFadeAlpha;
        ctx.fillRect(1, 1, sIdx * cellSz - 2, sIdx * cellSz - 2);
        ctx.restore();
        drawPreviewSpellWithParticles(sIdx, sIdx, 0, 0);
    }
    else if (currentTargetKey === 'Quicken') {
        const rIdx = uiState.currentSizeIdx;
        const wVal = rIdx + 1;
        ctx.fillStyle = 'rgba(144,224,239,0.15)';
        ctx.save();
        ctx.globalAlpha = activeFadeAlpha;
        ctx.fillRect(1, rIdx * cellSz + 1, wVal * cellSz - 2, cellSz - 2);
        ctx.restore();
        drawPreviewSpellWithParticles(wVal, 1, 0, rIdx);
    }
    else if (currentTargetKey === 'GyreUp' || currentTargetKey === 'GyreDown') {
        const cIdx = uiState.currentSizeIdx;
        const hVal = cIdx + 1;
        ctx.fillStyle = 'rgba(169,169,169,0.15)';
        ctx.save();
        ctx.globalAlpha = activeFadeAlpha;
        ctx.fillRect(cIdx * cellSz + 1, 1, cellSz - 2, hVal * cellSz - 2);
        ctx.restore();
        drawPreviewSpellWithParticles(1, hVal, cIdx, 0);
    }
    ctx.restore();
    if (targetWidgetCenterX > 0 && targetWidgetCenterY > 0) {
        const currentSizeIdx = uiState.currentSizeIdx;
        drawWidgetLineOverlay(
            ctx,
            targetWidgetCenterX,
            targetWidgetCenterY,
            currentTargetKey,
            currentSizeIdx,
            viewW,
            currentActiveGridCol,
            activeFadeAlpha
        );
    }
    ctx.restore();
}  