import { rootGameStore } from '../../../../DataClasses/store';
import { CanvasScrollUI } from '../../../../DataClasses/types';
import { draw4PointStar } from '../Sparkles/SparkleFunctions';
import { HARDCODED_SYMBOLS_FOR_DISPLAY } from '../../../../DataClasses/PlacedSpells/HardCodedSymbolsForDisplay';
import { GameSymbol } from '../../../../DataClasses/PlacedSpells/GameSymbol';
import { drawProceduralSpell, spawnPreviewSpellParticles, updateAndDrawParticles } from '../RenderSpells/renderSpells';
import { SpellAnimTracker } from '../../../../DataClasses/types';
import { SPELL_CLASSES, SpellName } from '../../../../DataClasses/GameRules/GameSimulation';
import { getFocusCost } from '../../../../DataClasses/GameRules/gameRules';
import { KELLS, drawDotContour, drawIlluminatedCapital, drawKellsPage, drawMarginNote, getIsQuillFontReady, prewarmQuillFont } from './kellsOrnaments';

/**
 * Notes scribbled in each page by some earlier owner of the book: short ones in the space between the
 * description and the preview ('gap'); longer ones below the preview ('below'); or anywhere ('at': its
 * center, in fractions of the page's width and height from its top left). tilt: degrees, as in CSS
 * (negative: rising to the right). nudge: moved from there, in fractions of the page's width (x right,
 * y down). Underlined unless underline is false; scale: its size (1: as the rest); arrow: one to its right,
 * pointing up or down; a \n in the text starts another line.
 */
type MarginNote = { text: string; place: 'gap' | 'below' | 'at'; tilt: number; nudge?: { x: number; y: number }; at?: { x: number; y: number }; underline?: boolean; scale?: number; arrow?: 'up' | 'down' };
const MARGIN_NOTES: Record<string, Array<MarginNote>> = {
    // (nudged toward 255 degrees on the unit circle: down and a little left, off the preview's edge)
    // (and right of the title, a little below it: at the preview's top left)
    Ether: [{ text: 'hurts a lot!', place: 'gap', tilt: 15, nudge: { x: -0.03, y: 0.045 } }, { text: 'draw a circle\nor click on a cell', place: 'at', tilt: -5, at: { x: 0.46, y: 0.33 }, underline: false }],
    // (nudged up, clear of the description's last line; and under the description, to the left)
    Quicken: [{ text: 'fast!!', place: 'gap', tilt: -15, nudge: { x: 0, y: -0.035 } }, { text: 'draw a line', place: 'at', tilt: -3, at: { x: 0.22, y: 0.86 }, underline: false }],
    // (and under the description, to the left)
    Phlegm: [{ text: 'patches you up', place: 'below', tilt: -3 }, { text: '2x3 cells = heal self', place: 'at', tilt: -3, at: { x: 0.25, y: 0.68 } }],
    // (and under the description, to the left)
    // (and right of the title: which way it goes)
    GyreUp: [{ text: 'gives breathing room', place: 'below', tilt: -3 }, { text: 'off the board = destroyed', place: 'at', tilt: -3, at: { x: 0.25, y: 0.86 } }, { text: 'up', place: 'at', tilt: -4, at: { x: 0.47, y: 0.28 }, scale: 1.4, arrow: 'up' }],
    GyreDown: [{ text: 'gives breathing room', place: 'below', tilt: -3 }, { text: 'off the board = destroyed', place: 'at', tilt: -3, at: { x: 0.25, y: 0.86 } }, { text: 'down', place: 'at', tilt: -4, at: { x: 0.47, y: 0.28 }, scale: 1.4, arrow: 'down' }],
};

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

/**
 * The Spell Book tray's symbols: each always shown in ink (inkColor, its stroke inkWidth of its size), a clear
 * thing to hover, the gold drawing animating over it; while one is hovered, the others are ink only, their drawing
 * stopped. ripple: how much they follow the page's rippling in the wind (1: as the paper; 0: still).
 */
export const SPELL_BOOK_TRAY = { inkColor: 'rgba(58, 36, 18, 0.85)', inkWidth: 0.045, ripple: 1 };

export const drawProceduralScroll = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number, _viewH: number, deltaTime: number, currentTime: number, setIsHovered: Function, animStates: Map<string, SpellAnimTracker>) => {
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
    // The page's own ripple at a point (as its edges are drawn above): its top and bottom edges waving a little
    // out of step (blended between them by height), and its far edge fluttering (more toward that edge). The
    // symbols' strokes follow it, inked into the paper.
    const pageRipple = (x: number, y: number): [number, number] => {
        const along = Math.max(0, Math.min(1, (y - topY) / trayH));
        const topWave = Math.sin(x * 0.04 + currentTime * 0.003) * 2.2, bottomWave = Math.cos(x * 0.04 + currentTime * 0.003) * 2.2;
        const flutter = isTrayOpen ? Math.sin(y * 0.08 + currentTime * 0.002) * (viewW * 0.001) * ui.trayProgress * Math.max(0, (x - startX) / Math.max(1, currentW)) : 0;
        return [x + flutter * SPELL_BOOK_TRAY.ripple, y + (topWave + (bottomWave - topWave) * along) * SPELL_BOOK_TRAY.ripple];
    };
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
        let hoverScale = 1.0;
        if (isMouseHovering && isTrayOpen) {
            localHoveredSpell = symbol.spellName; hoverScale = 1.15;
        }
        // (another symbol hovered: this one ink only, its drawing stopped; it starts afresh once nothing is)
        const isInkOnly = !!ui.hoveredSpellName && ui.hoveredSpellName !== symbol.spellName;
        const state = ui.getSymbolState(symbol.spellName);
        if (isInkOnly) {
            state.progress = 0;
            state.particles = [];
            if (state.loopTimeout) { clearTimeout(state.loopTimeout); state.loopTimeout = null; }
        } else if (state.progress < 1.0) {
            state.progress += ui.config.symbolDrawSpeed * deltaTime;
        } else if (state.progress >= 1.0 && !state.loopTimeout && isTrayOpen) {
            state.loopTimeout = setTimeout(() => {
                state.progress = 0;
                state.particles = [];
                state.loopTimeout = null;
            }, 4000);
        }
        if (symbol.points.length === 0) return;
        const pts = symbol.points as Array<{ x: number; y: number; moveTo?: boolean }>;
        // (a point of the symbol, from its 0-1 box, on the page: placed, sized, then rippling with the paper)
        const size = glyphBoundsDiameter * hoverScale;
        const toPage = (p: { x: number; y: number }): [number, number] => pageRipple(symbolX + (p.x - 0.5) * size, symbolY + (p.y - 0.5) * size);
        const tracePath = (until: number): [number, number] => {
            // (the strokes up to \`until\` of their length, 0-1, as a path; returns where the drawing's tip is)
            let tip = toPage(pts[0]);
            ctx.beginPath();
            ctx.moveTo(tip[0], tip[1]);
            const lengths = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.y - pts[k].y));
            let left = until * lengths.reduce((a, b) => a + b, 0);
            for (let m = 1; m < pts.length; m++) {
                const p = pts[m];
                if (p.moveTo) { tip = toPage(p); ctx.moveTo(tip[0], tip[1]); continue; }
                const segment = lengths[m - 1];
                if (left < segment) {
                    const t = segment > 0 ? left / segment : 0;
                    tip = toPage({ x: pts[m - 1].x + (p.x - pts[m - 1].x) * t, y: pts[m - 1].y + (p.y - pts[m - 1].y) * t });
                    ctx.lineTo(tip[0], tip[1]);
                    break;
                }
                left -= segment;
                tip = toPage(p);
                ctx.lineTo(tip[0], tip[1]);
            }
            return tip;
        };
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // The ink: always there, the whole symbol (a clear thing to hover)
        tracePath(1);
        ctx.strokeStyle = SPELL_BOOK_TRAY.inkColor;
        ctx.lineWidth = glyphBoundsDiameter * SPELL_BOOK_TRAY.inkWidth * hoverScale;
        ctx.stroke();
        if (!isInkOnly) {
            // The gold drawing over it, as it's drawn (sparkling at its tip)
            const tip = tracePath(Math.min(1, state.progress));
            ctx.lineWidth = glyphBoundsDiameter * 0.035 * hoverScale;
            ctx.strokeStyle = '#f7cb44';
            ctx.shadowBlur = glyphBoundsDiameter * 0.04; ctx.shadowColor = '#e8dfb9';
            ctx.stroke();
            ctx.shadowBlur = 0;
            if (state.progress < 1.0) {
                for (let pCount = 0; pCount < 2; pCount++) {
                    state.particles.push({
                        x: tip[0] + (Math.random() - 0.5) * (glyphBoundsDiameter * 0.03),
                        y: tip[1] + (Math.random() - 0.5) * (glyphBoundsDiameter * 0.03),
                        size: Math.random() * (glyphBoundsDiameter * 0.009) + 0.4,
                        vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.7) * 0.5 - 0.2,
                        alpha: 1.0, decay: Math.random() * 0.024 + 0.016,
                        color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.6
                    });
                }
            }
            for (let q = state.particles.length - 1; q >= 0; q--) {
                const part = state.particles[q];
                if (!part) continue;
                part.x += part.vx; part.y += part.vy; part.vy += 0.01; part.alpha -= part.decay;
                if (part.alpha <= 0) { state.particles.splice(q, 1); continue; }
                ctx.save(); ctx.globalAlpha = part.alpha; ctx.fillStyle = part.color;
                if (part.isStar) draw4PointStar(ctx, part.x, part.y, part.size * 2, part.size * 0.5);
                else { ctx.beginPath(); ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            }
        }
        ctx.restore();
    });
    if (localHoveredSpell !== ui.hoveredSpellName) {
        ui.hoveredSpellName = localHoveredSpell;
        setIsHovered(!!localHoveredSpell);
        if (!localHoveredSpell) {
            // (every symbol drawn afresh together: the one hovered back in step with the others)
            availableSymbols.forEach(({ spellName }) => {
                const state = ui.getSymbolState(spellName);
                if (state.loopTimeout) { clearTimeout(state.loopTimeout); state.loopTimeout = null; }
                state.progress = 0;
                state.particles = [];
            });
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

/** "Hover for more info": its outline's thickness, as a fraction of the game's width. */
const HOVER_HINT_OUTLINE = 0.0035;
const HOVER_HINT = "Hover for more info";

/**
 * "Hover for more info", one image per letter (a thin dark outline under solid gold, so it reads
 * against the wall and the scroll), drawn once per size and reused: drawn as outlined text letter by
 * letter each frame, it cost about a tenth of every second while the Spell Book was open. (Drawn
 * again once the font has loaded, in case it hadn't the first time.)
 */
type HoverHintGlyph = { char: string; image: HTMLCanvasElement | null; width: number; height: number };
let hoverHintGlyphs: { key: string; glyphs: Array<HoverHintGlyph>; pad: number } | null = null;

const getHoverHintGlyphs = (ctx: CanvasRenderingContext2D, viewW: number): { glyphs: Array<HoverHintGlyph>; pad: number } => {
    const dpr = ctx.getTransform().a || 1; // the canvas' scale (device pixels per drawing unit)
    const fontSize = viewW * 0.03;
    const font = `bold ${fontSize}px 'EnchantedLand', sans-serif`;
    const key = `${fontSize.toFixed(2)}@${dpr}:${document.fonts.check(`20px 'EnchantedLand'`)}`; // (the face alone: see getIsQuillFontReady)
    if (hoverHintGlyphs?.key === key) return hoverHintGlyphs;
    const lineWidth = viewW * HOVER_HINT_OUTLINE;
    const pad = Math.ceil(lineWidth);
    const height = fontSize * 1.4;
    ctx.save();
    ctx.font = font;
    const glyphs = [...HOVER_HINT].map(char => {
        const width = ctx.measureText(char).width;
        if (char === ' ') return { char, image: null, width, height };
        const image = document.createElement('canvas');
        image.width = Math.ceil((width + pad * 2) * dpr);
        image.height = Math.ceil((height + pad * 2) * dpr);
        const g = image.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
        g.font = font;
        g.textBaseline = 'top';
        g.textAlign = 'left';
        g.lineJoin = 'round';
        g.lineWidth = lineWidth;
        g.strokeStyle = 'rgba(45, 30, 10, 0.95)';
        g.strokeText(char, 0, 0);
        g.fillStyle = '#f7d774'; // (was #f0c24de2, slightly see-through)
        g.fillText(char, 0, 0);
        return { char, image, width, height };
    });
    ctx.restore();
    hoverHintGlyphs = { key, glyphs, pad };
    return hoverHintGlyphs;
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
    ctx.save();
    ctx.globalAlpha = activeTrayAlpha;
    const verticalSpacing = viewW * 0.005;
    let runningX = startX + viewW * 0.02;
    const textSparklePool = ui.floatingTextSparkles;
    const { glyphs, pad } = getHoverHintGlyphs(ctx, viewW);
    for (let i = 0; i < glyphs.length; i++) {
        const { char, image, width: charW, height } = glyphs[i];
        const waveCharY = bottomY + (Math.cos(runningX * 0.04 + currentTime * 0.003) * 2.2);
        const targetCharY = waveCharY + verticalSpacing;
        if (image) ctx.drawImage(image, runningX - pad, targetCharY - pad, charW + pad * 2, height + pad * 2);
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

/**
 * The preview's stats (Cost, Damage or Heal, Speed), backlit in gold so they read over the spell behind
 * them: color (the game's gold), blur (the glow's spread, a fraction of the game's width), passes (the
 * glow drawn this many times over: stronger), outline (a solid gold edge under the letters, the same
 * fraction; 0: none).
 */
const STATS_BACKLIGHT = { isOn: true, color: 'rgba(230, 197, 99, 1)', blur: 0.012, passes: 4, outline: 0.004 };

/**
 * A preview's stats, from the game's own spell of that shape (so they follow the rules: Spell.getPropertyValue,
 * getFocusCost): squares (Ether, Phlegm) size x size, Quickens size wide, Gyres size tall. Its cost (focus),
 * power (damage dealt, or healing for a Phlegm) and speed (cells a turn). Made once per spell and size.
 */
const previewStats = new Map<string, { cost: number; power: number; speed: number }>();
const getPreviewStats = (spellKey: string, size: number): { cost: number; power: number; speed: number } => {
    const key = `${spellKey}:${size}`;
    const known = previewStats.get(key);
    if (known) return known;
    const SpellClass = SPELL_CLASSES[spellKey as SpellName];
    if (!SpellClass) return { cost: size, power: 0, speed: 1 };
    const spell = new (SpellClass as any)({ getDirection: () => 1 }); // (a caster facing right: only its direction is read)
    spell.widthCells = spellKey === 'GyreUp' || spellKey === 'GyreDown' ? 1 : size;
    spell.heightCells = spellKey === 'Quicken' ? 1 : size;
    const stats = {
        cost: getFocusCost(SpellClass, spell.widthCells * spell.heightCells),
        power: spell.getPower(),
        speed: Math.abs(spell.getPropertyValue('speedDirection')),
    };
    previewStats.set(key, stats);
    return stats;
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

    const { cost, power, speed } = getPreviewStats(spellKey, sizeIdx + 1);
    const damageOrHeal = power;
    const isHealing = spellKey === 'Phlegm';
    const labelText = isHealing ? "Heal" : "Damage";

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
        // Backlit in gold (STATS_BACKLIGHT), so it reads over the preview's spell (a 1x1 sits right behind it)
        if (STATS_BACKLIGHT.isOn) {
            ctx.save();
            ctx.shadowColor = STATS_BACKLIGHT.color;
            ctx.shadowBlur = viewW * STATS_BACKLIGHT.blur;
            ctx.fillStyle = STATS_BACKLIGHT.color;
            for (let pass = 0; pass < STATS_BACKLIGHT.passes; pass++) ctx.fillText(textLineString, columnTextX, renderYPosition);
            if (STATS_BACKLIGHT.outline > 0) {
                ctx.shadowBlur = 0;
                ctx.lineJoin = 'round';
                ctx.lineWidth = viewW * STATS_BACKLIGHT.outline;
                ctx.strokeStyle = STATS_BACKLIGHT.color;
                ctx.strokeText(textLineString, columnTextX, renderYPosition);
            }
            ctx.restore();
        }
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

/**
 * Builds the Spell Book page's frame (drawKellsPage caches it by size) and starts loading its quill font
 * ahead of time, e.g. while the browser is idle after loading: so the first time the page opens, it
 * needn't build them then (a noticeable pause). The sizes match drawModalDetails's.
 */
export const prewarmSpellBookPage = (viewW: number, viewH: number, dpr: number, onDone?: () => void): void => {
    const scratch = document.createElement('canvas');
    scratch.width = Math.ceil(viewW * dpr);
    scratch.height = Math.ceil(viewH * dpr);
    const ctx = scratch.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const infoW = viewW * 0.76, infoH = viewH * 0.7;
    drawKellsPage(ctx, (viewW - infoW) * 0.5, viewH * 0.22, infoW, infoH, viewW * 0.02, viewW * 0.006);
    prewarmQuillFont();
    // Then each spell's page, drawn once out of sight, one at a time as the browser is idle: the first
    // drawing of a page is slow mostly for its lettering (each letter of its title, capital and text,
    // drawn the first time at its size, in an ornate font), which the browser then keeps
    const spellNames = availableSymbols.map(s => s.spellName);
    const whenIdle = (window as any).requestIdleCallback as ((run: () => void, options: { timeout: number }) => number) | undefined;
    const drawNext = (k: number) => {
        if (k >= spellNames.length) {
            scratch.width = scratch.height = 1; // (its memory, freed)
            onDone?.();
            return;
        }
        const ui = { hoveredSpellName: spellNames[k], sizeCycleTime: 2, currentSizeIdx: 0 } as unknown as CanvasScrollUI;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawModalDetails(ctx, ui, 0, viewW, viewH, new Map(), performance.now());
        if (whenIdle) whenIdle(() => drawNext(k + 1), { timeout: 2000 });
        else window.setTimeout(() => drawNext(k + 1), 50);
    };
    drawNext(0);
};

/**
 * The Spell Book pages' still parts, one image per spell (for the current size and pixel ratio): `draw`
 * draws them, in the view's units, the first time (and again once the fonts they use have loaded).
 */
const stillPages = new Map<string, HTMLCanvasElement>();
let stillPagesSize = '';

/** Draws the page (x, y, w, h, with `pad` of room around it) from its cached image, `draw` drawing it the first time. */
const drawStillPage = (ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, pad: number, draw: (page: CanvasRenderingContext2D) => void): void => {
    const dpr = ctx.getTransform().a || 1; // the canvas' scale (device pixels per drawing unit)
    const size = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (size !== stillPagesSize) { stillPages.clear(); stillPagesSize = size; } // (resized: the old ones freed)
    const isFontsReady = getIsQuillFontReady() && document.fonts.check(`20px 'EnchantedLand'`);
    const fullKey = `${key}:${isFontsReady}`;
    let canvas = stillPages.get(fullKey);
    if (!canvas) {
        stillPages.delete(`${key}:false`);
        canvas = document.createElement('canvas');
        canvas.width = Math.ceil((w + pad * 2) * dpr);
        canvas.height = Math.ceil((h + pad * 2) * dpr);
        const page = canvas.getContext('2d')!;
        page.setTransform(dpr, 0, 0, dpr, (pad - x) * dpr, (pad - y) * dpr);
        draw(page);
        stillPages.set(fullKey, canvas);
    }
    ctx.drawImage(canvas, x - pad, y - pad, w + pad * 2, h + pad * 2);
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
    const spellDescriptions: Record<string, { desc: string }> = {
        'Ether': {
            desc: "A crackling ball of fire,\n   Explodes on impact!\nDestroys weaker spells on collision.\nConfers +5 Damage to any spell\n   that destroys it."
        },
        'Quicken': {
            desc: "A crackling lightning bolt.\nDestroys weaker spells.\nIts destroyer gets +1 move per cell\n   of its width for that turn.\nA 1x1 is fast, and gives a permanent +1 speed."
        },
        'Phlegm': {
            desc: "A revolving torrent of water,\n   Heals those it touches.\nReflects stronger spells backward."
        },
        'GyreUp': {
            desc: "An upward-flowing tornado.\nLifts stronger spells up; destroys weaker.\nA spell leaving it gets +1 move per cell.\nAbsorbs 5 damage a cell, shrinking\n   as it's used up."
        },
        'GyreDown': {
            desc: "A downward-flowing tornado.\nPushes stronger spells down; destroys weaker.\nA spell leaving it gets +1 move per cell.\nAbsorbs 5 damage a cell, shrinking\n   as it's used up."
        }
    };
    const targetData = spellDescriptions[currentTargetKey] || { desc: '' };
    const infoW = viewW * 0.76;
    const infoH = viewH * 0.7;
    const infoX = (viewW - infoW) * 0.5;
    const infoY = viewH * 0.22;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    const padLeft = infoW * 0.07;
    const padTop = infoH * 0.12;
    const titleX = infoX + padLeft;
    const titleY = infoY + padTop;
    const gridBoxW = infoW * 0.32;
    const rightGridX = infoX + infoW * 0.6;
    const rightGridY = titleY + (viewW * 0.03);
    const gridCellsCount = 3;
    const cellSz = gridBoxW / gridCellsCount;
    // Everything on the page that holds still (the page, its lettering, the preview's frame and the margin
    // note) is drawn once per spell and reused: drawn afresh each frame, it cost most of the frame
    drawStillPage(ctx, `${currentTargetKey}:${viewW}x${viewH}`, infoX, infoY, infoW, infoH, Math.max(viewW * 0.03, 30), ctx => {
        // The page (Book of Kells): mottled vellum in a band of interlaced knotwork, triskeles at the corners
        drawKellsPage(ctx, infoX, infoY, infoW, infoH, viewW * 0.02, viewW * 0.006);
        const firstLetter = displayTitle.charAt(0);
        const restOfTitle = displayTitle.slice(1);
        // The title: an illuminated capital (Book of Kells), then the rest of the name in ink
        const accentColors: Record<string, string> = { Ether: '#e65c00', Quicken: '#00b3ff', Phlegm: '#1a936f', GyreUp: '#9a9a9a', GyreDown: '#9a9a9a' };
        const capitalPanelW = drawIlluminatedCapital(ctx, firstLetter, titleX, titleY - viewW * 0.012, viewW * 0.068, accentColors[currentTargetKey] || KELLS.vermilion, "'EnchantedLand', sans-serif");
        ctx.save();
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = KELLS.ink;
        ctx.font = `bold ${viewW * 0.046}px 'EnchantedLand', sans-serif`;
        ctx.fillText(restOfTitle, titleX + capitalPanelW + viewW * 0.012, titleY + viewW * 0.012);
        // A vermilion rule under the name
        const restW = ctx.measureText(restOfTitle).width;
        ctx.strokeStyle = KELLS.vermilion;
        ctx.lineWidth = viewW * 0.002;
        ctx.beginPath();
        ctx.moveTo(titleX + capitalPanelW + viewW * 0.012, titleY + viewW * 0.062);
        ctx.lineTo(titleX + capitalPanelW + viewW * 0.012 + restW, titleY + viewW * 0.062);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = KELLS.ink;
        let currentTextY = titleY + (viewW * 0.095);
        const linesArray = targetData.desc.split('\n');
        // (shrunk, if need be, to fit: no wider than the room left of the preview, no lower than the page's border)
        const textX = titleX + viewW * 0.02;
        ctx.font = `500 ${viewW * 0.029}px 'EnchantedLand', sans-serif`;
        const widest = Math.max(...linesArray.map(lineText => ctx.measureText(lineText).width));
        const fit = Math.min(1, (rightGridX - viewW * 0.02 - textX) / widest, (infoY + infoH - viewW * 0.03 - currentTextY) / (linesArray.length * viewW * 0.037));
        const lineHeight = viewW * 0.037 * fit;
        ctx.font = `500 ${viewW * 0.029 * fit}px 'EnchantedLand', sans-serif`;
        linesArray.forEach((lineText) => {
            ctx.fillText(lineText, textX, currentTextY);
            currentTextY += lineHeight;
        });
        ctx.restore();
        ctx.save();
        ctx.translate(rightGridX, rightGridY);
        // ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillStyle = '#443b1c67';//'rgba(0, 0, 0, 0.37)';
        ctx.fillRect(0, 0, gridBoxW, gridBoxW);
        // Framed like a miniature: an ink rule ringed with red dots
        ctx.strokeStyle = KELLS.ink;
        ctx.lineWidth = viewW * 0.002;
        ctx.strokeRect(0, 0, gridBoxW, gridBoxW);
        drawDotContour(ctx, -viewW * 0.006, -viewW * 0.006, gridBoxW + viewW * 0.012, gridBoxW + viewW * 0.012, viewW * 0.006, viewW * 0.0016);
        ctx.strokeStyle = 'rgba(74, 50, 24, 0.15)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= gridCellsCount; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * cellSz); ctx.lineTo(gridBoxW, r * cellSz); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r * cellSz, 0); ctx.lineTo(r * cellSz, gridBoxW); ctx.stroke();
        }
        ctx.restore();
        // Notes in the margin (MARGIN_NOTES)
        (MARGIN_NOTES[currentTargetKey] ?? []).forEach(marginNote => {
            const nudge = marginNote.nudge ?? { x: 0, y: 0 };
            let x: number, y: number;
            if (marginNote.place === 'gap') {
                // between the description and the preview, level with the description's second-to-last line
                // (its lines start viewW * 0.095 below the title, viewW * 0.037 apart)
                const lineCount = targetData.desc.split('\n').length;
                x = infoX + infoW * 0.535;
                y = titleY + viewW * 0.095 + viewW * 0.037 * (Math.max(1, lineCount - 2) + 0.6);
            } else if (marginNote.place === 'at') {
                x = infoX + infoW * (marginNote.at?.x ?? 0.5);
                y = infoY + infoH * (marginNote.at?.y ?? 0.5);
            } else {
                x = rightGridX + gridBoxW * 0.5;
                y = rightGridY + gridBoxW + viewW * 0.03;
            }
            drawMarginNote(ctx, marginNote.text, x + viewW * nudge.x, y + viewW * nudge.y, viewW * 0.017 * (marginNote.scale ?? 1), marginNote.tilt * Math.PI / 180, marginNote);
        });
    });
    ctx.save();
    ctx.translate(rightGridX, rightGridY);
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