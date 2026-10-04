import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { GameSymbol } from '../../DataClasses/PlacedSpells/GameSymbol';
import { rootGameStore } from '../../DataClasses/store';
import { HARDCODED_SYMBOLS_FOR_DISPLAY } from '../../DataClasses/PlacedSpells/HardCodedSymbolsForDisplay';
import { drawProceduralSpell, updateAndDrawParticles } from '../HTMLCanvas/RenderSpells/renderSpells';
import { spawnQuickenParticles, spawnQuickenHitParticles } from '../HTMLCanvas/RenderSpells/drawQuicken';
import { spawnEtherParticles, spawnEtherHitParticles } from '../HTMLCanvas/RenderSpells/drawEther';
import { spawnPhlegmParticles, spawnPhlegmHitParticles } from '../HTMLCanvas/RenderSpells/drawPhlegm';
import { spawnGyreParticles, spawnGyreHitParticles } from '../HTMLCanvas/RenderSpells/drawGyre';
import { SpellAnimTracker } from '../../DataClasses/types';
import { PALETTE } from '../HTMLCanvas/RenderSpells/ColorPalette';

const MasterCanvasOverlay = styled.canvas < { $zIndex: number } > `
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100cqw; 
  height: 60cqw;
  z-index: ${props => props.$zIndex ? props.$zIndex : 29};
  pointer-events: auto;
  touch-action: none;
  filter: drop-shadow(0 0 1.5cqw rgba(248, 255, 54, 0.4));
`;

interface PlacedSpellsProps {
  gridOverlayRef: React.RefObject<HTMLDivElement | null>;
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  isStar: boolean;
  text?: string;
  life?: number;
  type?: string;
}

interface BookSparkleParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
  decay: number;
  color: string;
}

class SymbolDrawingState {
  progress: number = 0;
  particles: DustParticle[] = [];
  loopTimeout: any = null;
}

class CanvasScrollUI {
  trayProgress: number = 0;
  hoveredSpellName: string | null = null;
  currentMousePos: { x: number; y: number } = { x: -1000, y: -1000 };
  symbolStates: Map<string, SymbolDrawingState> = new Map();
  bookSparkles: BookSparkleParticle[] = [];

  config = {
    startXOffset: 0.1,
    startYOffset: 0.04,
    maxScrollWidth: 0.35,
    scrollTrayHeight: 0.085,
    paddingX: 0.03,
    zigZagOffset: 7,
    symbolDrawSpeed: 0.55
  };

  getSymbolState(name: string): SymbolDrawingState {
    if (!this.symbolStates.has(name)) {
      this.symbolStates.set(name, new SymbolDrawingState());
    }
    return this.symbolStates.get(name)!;
  }

  cleanup() {
    this.symbolStates.forEach(s => {
      if (s.loopTimeout) {
        clearTimeout(s.loopTimeout);
        s.loopTimeout = null;
      }
    });
    this.bookSparkles = [];
  }
}

const displayNameLookup = new Map<string, string>([
  ['GyreDown', 'Downdraft'],
  ['GyreUp', 'Updraft'],
  ['Ether', 'Fireball'],
  ['Phlegm', 'Water Wheel'],
  ['Quicken', 'Chain Lightning'],
]);

const HTMLCanvasComponent = (({ gridOverlayRef }: PlacedSpellsProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const animStatesRef = useRef<Map<string, SpellAnimTracker>>(new Map());
  const drawingParticlesRef = useRef<DustParticle[]>([]);
  const scrollUIRef = useRef<CanvasScrollUI>(new CanvasScrollUI());
  const pixieColors = ['#FFF7C2', '#FFE53B', '#FFFFFF', '#A6FFEA', '#FFBBE1'];

  const [isHovered, setIsHovered] = useState(false);

  const availableSymbols = Array.from(GameSymbol.SPELL_LOOKUP.entries()).map(([inferenceString, spellClass]) => ({
    inferenceString,
    spellName: spellClass.spellName,
    points: HARDCODED_SYMBOLS_FOR_DISPLAY.get(inferenceString) || []
  }));

  useEffect(() => {
    const boardElement = gridOverlayRef.current;
    if (!boardElement) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        boardLayoutRef.current = { width, height };
      }
    });
    resizeObserver.observe(boardElement);
    const initialRect = boardElement.getBoundingClientRect();
    boardLayoutRef.current = { width: initialRect.width, height: initialRect.height };
    return () => resizeObserver.disconnect();
  }, [gridOverlayRef]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const draw4PointStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, innerRadius: number) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx; let y = cy;
    const step = Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < 4; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0; let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches.clientX; clientY = e.touches.clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    const localX = clientX - rect.left; const localY = clientY - rect.top;
    scrollUIRef.current.currentMousePos = { x: localX, y: localY };
    if (!rootGameStore.spellCanvas.getIsDrawing()) return;
    for (let i = 0; i < 8; i++) {
      drawingParticlesRef.current.push({
        x: localX + (Math.random() - 0.5) * 12,
        y: localY + (Math.random() - 0.5) * 12,
        size: Math.random() * 2.5 + 0.5,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.8) * 1,
        alpha: 1,
        decay: Math.random() * 0.2 + 0.015,
        color: pixieColors[Math.floor(Math.random() * pixieColors.length)],
        isStar: Math.random() > 0.6
      });
    }
    rootGameStore.addRawPoint(clientX, clientY);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0; let clientY = 0;
    if ('changedTouches' in e) {
      if (e.changedTouches.length === 0) return;
      clientX = e.changedTouches.clientX; clientY = e.changedTouches.clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    const localX = clientX - rect.left; const localY = clientY - rect.top;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.0;
      drawingParticlesRef.current.push({
        x: localX,
        y: localY,
        size: Math.random() * 3.5 + 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        alpha: 1,
        decay: Math.random() * 0.35 + 0.01,
        color: pixieColors[Math.floor(Math.random() * pixieColors.length)],
        isStar: Math.random() > 0.5
      });
    }
  };

  const handleMouseLeave = () => {
    scrollUIRef.current.currentMousePos = { x: -1000, y: -1000 };
    scrollUIRef.current.hoveredSpellName = null;
    setIsHovered(false);
  };

  const drawProceduralScroll = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number, viewH: number, deltaTime: number, currentTime: number) => {
    const isTrayOpen = rootGameStore.isSpellBookOpen;
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
    ctx.globalAlpha = Math.min(1.0, ui.trayProgress);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    for (let x = startX; x <= rightEdgeX; x += 12) {
      const waveY = topY + (Math.sin(x * 0.04) * 1.5);
      ctx.lineTo(x, waveY);
    }

    // EXCLUSIVE WIND RIPPLE MATH: Only added to the right edge path line mapping loop
    for (let y = topY; y <= bottomY; y += 6) {
      const windWave = isTrayOpen ? Math.sin(y * 0.08 + currentTime * 0.002) * (viewW * 0.001) * ui.trayProgress : 0;
      const paperNick = Math.cos(y * 0.12) * 1.2 + (y % 18 === 0 ? -3.5 : 0);
      ctx.lineTo(rightEdgeX + paperNick + windWave, y);
    }
    for (let x = rightEdgeX; x >= startX; x -= 12) {
      const waveY = bottomY + (Math.cos(x * 0.04) * 1.5);
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



        /*******/


        ctx.beginPath();
        ctx.moveTo(pts[0].x * glyphBoundsDiameter, pts[0].y * glyphBoundsDiameter);

        const activeTargetLength = state.progress * totalLen;
        let currentAccumulated = 0;
        let tipX = pts[0].x * glyphBoundsDiameter;
        let tipY = pts[0].y * glyphBoundsDiameter;
        if (state.progress >= 1.0) {
          for (let m = 1; m < pts.length; m++) {
            const p = pts[m] as any;
            if (p.moveTo) {
              ctx.moveTo(p.x * glyphBoundsDiameter, p.y * glyphBoundsDiameter);
            } else {
              ctx.lineTo(p.x * glyphBoundsDiameter, p.y * glyphBoundsDiameter);
            }
          }
          tipX = pts[pts.length - 1].x * glyphBoundsDiameter;
          tipY = pts[pts.length - 1].y * glyphBoundsDiameter;
        } else {
          // ... Keep your existing incremental drawing logic for progress < 1.0 ...
          for (let m = 0; m < pts.length - 1; m++) {
            let p1 = pts[m]; let p2 = pts[m + 1]; let segLen = segments[m];
            if (currentAccumulated + segLen >= activeTargetLength) {
              let rem = activeTargetLength - currentAccumulated;
              let ratio = segLen > 0 ? rem / segLen : 0;
              tipX = (p1.x + (p2.x - p1.x) * ratio) * glyphBoundsDiameter;
              tipY = (p1.y + (p2.y - p1.y) * ratio) * glyphBoundsDiameter;
              ctx.lineTo(tipX, tipY);
              break;
            } else {
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
      if (localHoveredSpell) {
        const match = availableSymbols.find(s => s.spellName === localHoveredSpell);
        if (match) {
          setIsHovered(true);
        }
      } else {
        setIsHovered(false);
      }
    }
    if (ui.hoveredSpellName) {
      const labelText = displayNameLookup.get(ui.hoveredSpellName) || ui.hoveredSpellName;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = viewW * 0.008;
      ctx.fillStyle = '#ffffff'; ctx.font = `${viewW * 0.024}px 'EnchantedLand', sans-serif`;
      ctx.textAlign = 'center'; ctx.fillText(labelText, startX + currentW * 0.5, bottomY + viewW * 0.035);
      ctx.restore();
    }
    ctx.restore();
  };

  const runGlobalBookSparkles = (ctx: CanvasRenderingContext2D, ui: CanvasScrollUI, viewW: number) => {
    const isTrayOpen = rootGameStore.isSpellBookOpen;

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
        x: spawnX,
        y: spawnY,
        size: Math.random() * 2.2 + 0.8,
        speedY: Math.random() * 0.3 + 0.15,
        speedX: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.6 + 0.4,
        decay: Math.random() * 0.005 + 0.002,
        color: pool[Math.floor(Math.random() * pool.length)]
      });
    }

    for (let i = ui.bookSparkles.length - 1; i >= 0; i--) {
      const p = ui.bookSparkles[i];
      p.y += p.speedY;
      p.x += p.speedX;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        ui.bookSparkles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.size);
      ctx.quadraticCurveTo(p.x, p.y, p.x + p.size, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + p.size);
      ctx.quadraticCurveTo(p.x, p.y, p.x - p.size, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - p.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number; let lastTime = performance.now();
    const render = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      const viewW = canvas.width / (window.devicePixelRatio || 1);
      const viewH = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, viewW, viewH);
      const boardWidth = boardLayoutRef.current.width; const boardHeight = boardLayoutRef.current.height;
      if (boardWidth === 0 || boardHeight === 0) {
        animationFrameId = requestAnimationFrame(render); return;
      }
      const cellWidthPx = boardWidth / GameBoard.NUM_COLS; const cellHeightPx = boardHeight / GameBoard.NUM_ROWS;
      const isTrayOpen = rootGameStore.isSpellBookOpen;
      const isShowingModal = !!scrollUIRef.current.hoveredSpellName && isTrayOpen;

      // FULL-SCREEN ISOLATION CUTOFF: completely freeze board drawings if focused on full screen hover sheet description
      if (!isShowingModal) {
        const placedSpells = rootGameStore.placedSpells.spells || [];
        placedSpells.forEach((spell: any) => {
          const id = spell.id; const spellClass = spell.constructor.spellName;
          const targetCoords = calculateCanvasCoordinates(spell, viewW, viewH, cellWidthPx, cellHeightPx);
          if (!animStatesRef.current.has(id)) {
            animStatesRef.current.set(id, { spawnProgress: 0, deathProgress: 0, hasSpawnedParticles: false, particles: [], visualX: targetCoords.x, visualY: targetCoords.y, initialized: false } as any);
          }
          const anim = animStatesRef.current.get(id)!;
          if (!(anim as any).initialized) {
            (anim as any).visualX = targetCoords.x; (anim as any).visualY = targetCoords.y; (anim as any).initialized = true;
          }
          const interpolationSpeed = 3.5;
          (anim as any).visualX += (targetCoords.x - (anim as any).visualX) * interpolationSpeed * deltaTime;
          (anim as any).visualY += (targetCoords.y - (anim as any).visualY) * interpolationSpeed * deltaTime;
          const cellCols = spell.getPropertyValue?.('widthCells') || 1; const cellRows = spell.getPropertyValue?.('heightCells') || 1;
          const w = cellWidthPx * cellCols; const h = cellHeightPx * cellRows;
          const isRemove = spell.getIsRemove?.() || false; const totalCells = cellCols * cellRows;
          const dir = Math.sign(spell.getPropertyValue('speedDirection')) || 1; const isDisplay = !isRemove;
          if (anim.spawnProgress < 1) {
            anim.spawnProgress = Math.min(1, anim.spawnProgress + deltaTime * 4.0);
          }
          if (!isDisplay && !anim.hasSpawnedParticles) {
            anim.hasSpawnedParticles = true; const isPlayerHit = spell.isPlayerHitImpact; const isOpponentHit = spell.isOpponentHitImpact;
            if (isPlayerHit || isOpponentHit) {
              const boardLeftEdgeX = viewW / 2 - boardWidth / 2; const boardRightEdgeX = viewW / 2 + boardWidth / 2; const boardTopEdgeY = viewH / 2 - boardHeight / 2;
              const targetGlobalY = boardTopEdgeY + (cellHeightPx * 1.5); const targetGlobalX = isPlayerHit ? boardLeftEdgeX - (cellWidthPx * 1.5) : boardRightEdgeX + (cellWidthPx * 1.5);
              const targetLocalX = targetGlobalX - (anim as any).visualX; const targetLocalY = targetGlobalY - (anim as any).visualY;
              if (spellClass === 'Quicken') spawnQuickenHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              else if (spellClass === 'Ether') spawnEtherHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              else if (spellClass === 'Phlegm') spawnPhlegmHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') {
                const sweepDir = isOpponentHit ? 'right' : 'left'; spawnGyreHitParticles(anim.particles, targetLocalX, targetLocalY, sweepDir, cellWidthPx);
              }
              const dmgValue = spell.hitDamageAmount; const isHealingText = dmgValue < 0; const displayText = isHealingText ? `+${Math.abs(dmgValue)}` : `-${dmgValue}`; const textColor = isHealingText ? '#3bed8e' : '#ee3737';
              anim.particles.push({ x: targetLocalX + (Math.random() * 120 - 60), y: targetLocalY + (Math.random() * 80 - 40), vx: (Math.random() * 30 - 15), vy: -110 - Math.random() * 30, alpha: 1.0, size: 50, color: textColor, text: displayText, life: 1.0, decay: 0.8, type: 'floatingText' } as any);
            } else {
              if (spellClass === 'Quicken') spawnQuickenParticles(anim.particles, w, h, cellWidthPx);
              else if (spellClass === 'Ether') spawnEtherParticles(anim.particles, w, h, cellWidthPx);
              else if (spellClass === 'Phlegm') spawnPhlegmParticles(anim.particles, w, h, cellWidthPx);
              else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') spawnGyreParticles(anim.particles, w, h, spellClass, cellWidthPx);
            }
          }
          if (isDisplay) {
            if (spellClass === 'Ether' && anim) {
              const cx = w / 2 + (w / 10) * dir; const cy = h / 2; const radius = Math.min(w, h) * 0.3;
              if (Math.random() < Math.min(0.95, 0.4 * totalCells)) {
                const spreadX = (Math.random() - 0.85) * (radius * 1.75) * dir; const spawnX = cx + spreadX; const spawnY = cy + Math.sin(currentTime * 0.005) * (h * 0.04) + ((Math.random() - 0.5) * (radius * 1.75)); const ratio = Math.sqrt(Math.pow((cx - spawnX), 2) + Math.pow((cy - spawnY), 2)) / radius;
                anim.particles.push({ x: spawnX, y: spawnY, vx: -(100 + Math.random() * 100 * cellCols) * dir, vy: -100 - Math.random() * 100 * cellRows, alpha: 1.0, size: Math.max((1 - ratio) * (radius * (0.05 + Math.random() * 0.07)) * 2, radius * (0.05 + Math.random() * 0.07)), color: ratio < .3 ? PALETTE.fireCore : ratio < .8 ? PALETTE.fireMid : PALETTE.fireOuter, life: 1.0, decay: 1.5 + Math.random() * 1, type: 'etherFlame' });
              }
            }
            if (spellClass === 'Phlegm' && anim) {
              const rx = w * 0.44; const ry = h * 0.34;
              if (Math.random() < Math.min(0.95, 0.35 * totalCells)) {
                const angle = Math.random() * Math.PI * 2;
                anim.particles.push({ x: w / 2 + Math.cos(angle) * rx, y: h / 2 + Math.sin(angle) * ry, vx: Math.cos(angle) * (40 + Math.random() * 50), vy: Math.sin(angle) * (40 + Math.random() * 50) - (20 + Math.random() * 40), alpha: 1.0, size: Math.min(w, h) * (0.001 + Math.random() * 0.015), color: Math.random() > 0.7 ? PALETTE.waterFroth : Math.random() > 0.4 ? PALETTE.waterMid : PALETTE.waterDeep, life: 1.0, decay: 1.2 + Math.random() * 1.0, type: 'droplet' });
              }
              if (Math.random() < Math.min(0.2, 0.015 * totalCells)) {
                const angle = Math.random() * Math.PI * 2; const offset = (0.3 + Math.random() * 0.4) * rx;
                anim.particles.push({ x: w / 2 + Math.cos(angle) * offset, y: h / 2 + Math.sin(angle) * (offset * (ry / rx)), vx: (Math.random() * 30 - 15), vy: -(60 + Math.random() * 50), alpha: 1.0, size: Math.min(w, h) * (0.04 + Math.random() * 0.02) * (GameBoard.NUM_ROWS + 1 - cellRows), color: '#a8ff69', shadowColor: '#2ecc71', rotation: Math.random() * Math.PI / 6, vRotation: 0, life: 1.0, decay: 0.1 + Math.random() * 0.3 * (GameBoard.NUM_ROWS + 1 - cellRows), type: 'healCross' });
              }
            }
            if ((spellClass === 'Quicken' || spell.consumedQuickens > 0) && Math.random() < 0.25 * totalCells) {
              const sx = Math.random() * w; const sy = Math.random() * h; const len = Math.min(w, h) * (0.2 + Math.random() * 0.3); const ang = Math.random() * Math.PI * 2;
              anim.particles.push({ x: sx, y: sy, targetX: sx + Math.cos(ang) * len, targetY: sy + Math.sin(ang) * len, vx: 0, vy: 0, initialX: sx, initialY: sy, alpha: 1.0, size: 1.5 + Math.random() * 2.0, color: '#16e0d6', shadowColor: '#00ffff', life: 1.0, decay: 12.0 + Math.random() * 6.0, type: 'lightningArc' });
            }
            if ((spellClass === 'Ether' || spell.consumedEthers > 0) && Math.random() < Math.min(0.9, 0.35 * totalCells)) {
              const ang = Math.random() * Math.PI * 2; const rad = Math.min(w, h) * 0.25;
              anim.particles.push({ x: (w / 2 + (w / 12) * dir) + Math.cos(ang) * (Math.random() * rad), y: h / 2 + Math.sin(ang) * (Math.random() * rad), vx: (Math.random() * 60 - 30) - (80 * dir), vy: (Math.random() * 60 - 30), alpha: 1.0, size: Math.min(w, h) * (0.05 + Math.random() * 0.08), color: Math.random() > 0.6 ? '#ff3300' : Math.random() > 0.3 ? '#ff9900' : '#ffcc00', life: 1.0, decay: 2.0 + Math.random() * 1.5, type: 'fireballOrb' });
            }
            if (spellClass === 'Phlegm' && spell.consumedPhlegms > 0 && Math.random() < Math.min(0.8, 0.12 * totalCells)) {
              const ang = Math.random() * Math.PI * 2; const offset = (0.2 + Math.random() * 0.6) * (w * 0.44);
              anim.particles.push({ x: w / 2 + Math.cos(ang) * offset, y: h / 2 + Math.sin(ang) * (offset * ((h * 0.34) / (w * 0.44))), vx: (Math.random() * 40 - 20), vy: -(90 + Math.random() * 70), alpha: 1.0, size: Math.min(w, h) * (0.05 + Math.random() * 0.03) * (GameBoard.NUM_ROWS + 1 - cellRows), color: '#ffffff', shadowColor: '#a8ff69', rotation: Math.random() * Math.PI / 4, vRotation: Math.random() * 1.0 - 0.5, life: 1.0, decay: 0.4 + Math.random() * 0.4, type: 'healCross' });
            }
          }
          if (isDisplay && anim) {
            ctx.save(); ctx.translate((anim as any).visualX + (cellWidthPx * (spell.getPropertyValue?.('widthCells') || 1)) / 2, (anim as any).visualY + (cellHeightPx * (spell.getPropertyValue?.('heightCells') || 1)) / 2); ctx.scale(Math.sign(spell.getPropertyValue('speedDirection')) || 1, 1); ctx.translate(-(cellWidthPx * (spell.getPropertyValue?.('widthCells') || 1)) / 2, -(cellHeightPx * (spell.getPropertyValue?.('heightCells') || 1)) / 2);
            drawProceduralSpell(ctx, spell, cellWidthPx, cellHeightPx, currentTime, anim.spawnProgress); ctx.restore();
          }
          if (anim && anim.particles.length > 0) {
            ctx.save(); ctx.translate((anim as any).visualX, (anim as any).visualY); updateAndDrawParticles(ctx, anim.particles, deltaTime); ctx.restore();
          }
        });
        const dustParticles = drawingParticlesRef.current;
        for (let i = dustParticles.length - 1; i >= 0; i--) {
          const p = dustParticles[i]; p.y += p.vy; p.x += p.vx; p.vy += 0.02; p.alpha -= p.decay;
          if (p.alpha <= 0) { dustParticles.splice(i, 1); continue; }
          ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.shadowBlur = p.size * 2; ctx.shadowColor = p.color;
          if (p.isStar) draw4PointStar(ctx, p.x, p.y, p.size * 2, p.size * 0.4); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        const currentRawPoints = rootGameStore.getPlayerRawPoints() || [];
        if (currentRawPoints.length > 0 && rootGameStore.spellCanvas.getIsDrawing()) {
          const rect = canvas.getBoundingClientRect(); ctx.save(); ctx.lineWidth = boardWidth * 0.0075; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#e6c56386'; ctx.shadowBlur = boardWidth * 0.05; ctx.shadowColor = '#fffadd'; ctx.beginPath(); ctx.moveTo(currentRawPoints.x - rect.left, currentRawPoints.y - rect.top);
          for (let i = 1; i < currentRawPoints.length; i++) { ctx.lineTo(currentRawPoints[i].x - rect.left, currentRawPoints[i].y - rect.top); }
          ctx.stroke(); ctx.restore();
        }
      }
      // UPSTREAM LAYERING PATH: Sparks always render behind scroll trays and buttons natively
      runGlobalBookSparkles(ctx, scrollUIRef.current, viewW);
      // OPTIMIZED DISPLAY BARRIER: freeze backdrop updates entirely if user is looking over hover cards details
      drawProceduralScroll(ctx, scrollUIRef.current, viewW, viewH, deltaTime, currentTime);

      if (isShowingModal) {
        const currentTargetKey = scrollUIRef.current.hoveredSpellName || '';
        const displayTitle = displayNameLookup.get(currentTargetKey) || currentTargetKey;
        const match = availableSymbols.find(s => s.spellName === currentTargetKey);

        const spellInfoData: Record<string, string[]> = {
          'Ether': [
            '• How to draw: Draw a circle or click on a Cell',
            '• Cost: 1 Focus Point per Cell',
            '• Damage: 5 per Cell + 5',
            '• Speed: 1 per Horizontal Cell',
            '• Deals damage to Players on collision.',
            // '• Can be of sizes: 1x1, 2x2, and 3x3.',
            '• First collision with another spell grants +5 Damage to that spell. (Effect does not stack.)'
          ],
          'Quicken': [
            '• How to draw: Draw a line',
            '• Cost: 1 Focus Point per Cell',
            '• Damage: 5 per Cell',
            '• Speed: 1 per Horizontal Cell + 1',
            '• Deals damage to Players on collision.',
            '• Can be chained horizontally to create a larger effect.',
            '• First collision with another spell grants +1 Speed to that spell. (Effect does not stack.)'
          ],
          'GyreUp': [
            '• How to draw: Draw a triangle pointing down',
            '• Cost: 1 Focus Point per Cell',
            '• Damage: 5 per Cell',
            '• Speed: 1',
            '• Deals damage to Players on collision.',
            '• Can be stacked vertically to create a larger effect.',
            '• Colliding spells are pushed upward. (Spells pushed off the board are destroyed.)'
          ],
          'GyreDown': [
            '• How to draw: Draw a triangle pointing up',
            '• Cost: 1 Focus Point per Cell',
            '• Damage: 5 per Cell',
            '• Speed: 1',
            '• Deals damage to Players on collision.',
            '• Can be stacked vertically to create a larger effect.',
            '• Colliding spells are pushed downward. (Spells pushed off the board are destroyed.)'
          ],
          'Phlegm': [
            '• How to draw: Draw a star',
            '• Cost: 1 Focus Point per Cell',
            '• Damage: -5 per Cell',
            '• Speed: 1 per Horizontal Cell',
            '• Restores health to Players on collision.',
            // '• Can create Water Wheels of sizes: 1x1, 2x2, and 3x3 Cells.',
            '• Every collision with another spell reverses that spell\'s direction.'
          ]
        };

        const currentBullets = spellInfoData[currentTargetKey] || [];

        // Main Modal Dimensions
        const infoW = viewW * 0.76; 
        const infoH = viewH * 0.7; // Slightly reduced height to make sure it doesn't bleed off the bottom of the screen
        const infoX = (viewW - infoW) * 0.5;
        
        // 🌟 SHIFT DOWNWARD: Change from 0.5 center multiplier to explicit lower-anchor position
        const infoY = viewH * 0.22; // This leaves the top 32% of the canvas clear for scroll tray interactions!

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, viewW, viewH);

        // Draw Card Background Window
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

        // 1. HEADER LOGIC: Enormous Title String
        ctx.fillStyle = '#2d1010';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${viewW * 0.052}px 'EnchantedLand', sans-serif`; // Enormous Title Font size

        const padLeft = infoW * 0.05;
        const padTop = infoH * 0.05;
        const titleX = infoX + padLeft;
        const titleY = infoY + padTop;
        ctx.fillText(displayTitle, titleX, titleY);

        // 2. HEADER SYMBOL LOGIC: Large Floating Icon aligned with massive header text
        const titleWidth = ctx.measureText(displayTitle).width;
        if (match && match.points.length > 0) {
          const symSize = viewW * 0.065; // Significantly enlarged symbol canvas scale
          const symX = titleX + titleWidth + (viewW * 0.025);
          const symY = titleY - (viewW * 0.002);

          ctx.save();
          ctx.translate(symX, symY);
          ctx.beginPath();
          ctx.lineWidth = 3.5; // Thicker border weighting to match text density
          ctx.strokeStyle = '#4a3218';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          match.points.forEach((p: any, pIdx) => {
            if (pIdx === 0 || p.moveTo) {
              ctx.moveTo(p.x * symSize, p.y * symSize);
            } else {
              ctx.lineTo(p.x * symSize, p.y * symSize);
            }
          });
          ctx.stroke();
          ctx.restore();
        }

        // 3. INFORMATION BODY: Shifted lower & using custom EnchantedLand typography
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#3a220e';
        ctx.font = `500 ${viewW * 0.024}px 'EnchantedLand', sans-serif`; // Applied requested theme typography

        // Pushed noticeably lower from top title edge layout boundary
        let currentTextY = titleY + (viewW * 0.085);
        const maxDescWidth = infoW * 0.52;
        const lineHeight = viewW * 0.032; // Expanded height to provide breathing room for large font weights

        currentBullets.forEach((bulletText) => {
          const words = bulletText.split(' ');
          let currentLine = '';

          for (let n = 0; n < words.length; n++) {
            let testLine = currentLine + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxDescWidth && n > 0) {
              ctx.fillText(currentLine, titleX, currentTextY);
              currentLine = words[n] + ' ';
              currentTextY += lineHeight;
            } else {
              currentLine = testLine;
            }
          }
          ctx.fillText(currentLine, titleX, currentTextY);
          currentTextY += lineHeight + (viewW * 0.002);
        });
        ctx.restore();

        // 4. PREVIEW GRID: Dynamic grid matrices handling split layout sizes cleanly
        const gridBoxW = infoW * 0.32;
        const rightGridX = infoX + infoW * 0.63;
        const rightGridY = titleY + (viewW * 0.05); // Shifted down slightly to align nicely with body info

        ctx.save();
        ctx.translate(rightGridX, rightGridY);

        ctx.fillStyle = '#4a3218';
        ctx.textAlign = 'center';
        ctx.font = `bold ${viewW * 0.024}px 'EnchantedLand', sans-serif`;
        ctx.fillText("Sizes", gridBoxW / 2, -viewW * 0.025);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, gridBoxW, gridBoxW);

        const gridCellsCount = 3;
        const cellSz = gridBoxW / gridCellsCount;
        ctx.strokeStyle = 'rgba(74, 50, 24, 0.2)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= gridCellsCount; r++) {
          ctx.beginPath(); ctx.moveTo(0, r * cellSz); ctx.lineTo(gridBoxW, r * cellSz); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * cellSz, 0); ctx.lineTo(r * cellSz, gridBoxW); ctx.stroke();
        }

        // Draw structural previews isolating specific growth frames across corresponding fields
        if (currentTargetKey === 'Ether' || currentTargetKey === 'Phlegm') {
          // Nested overlays (1x1, 2x2, 3x3)
          const shades = currentTargetKey === 'Ether' ? ['#ff6b6b', '#e63946', '#9b1c1c'] : ['#72efdd', '#4ea8de', '#0077b6'];
          const dimensions = [{ w: 1, h: 1 }, { w: 2, h: 2 }, { w: 3, h: 3 }];

          for (let sIdx = dimensions.length - 1; sIdx >= 0; sIdx--) {
            ctx.fillStyle = shades[sIdx];
            ctx.fillRect(2, 2, dimensions[sIdx].w * cellSz - 4, dimensions[sIdx].h * cellSz - 4);
          }
        }
        else if (currentTargetKey === 'Quicken') {
          // Rows for horizontal layouts (Row 1: 1x1, Row 2: 2x1, Row 3: 3x1)
          const shades = ['#90e0ef', '#00b4d8', '#0077b6'];
          const widths = [1, 2, 3];

          for (let row = 0; row < 3; row++) {
            ctx.fillStyle = shades[row];
            const yOffset = row * cellSz;
            ctx.fillRect(2, yOffset + 2, widths[row] * cellSz - 4, cellSz - 4);
          }
        }
        else if (currentTargetKey === 'GyreUp' || currentTargetKey === 'GyreDown') {
          // Columns for vertical layouts (Col 1: 1x1, Col 2: 1x2, Col 3: 1x3)
          const shades = ['#d3d3d3', '#a9a9a9', '#696969'];
          const heights = [1, 2, 3];

          for (let col = 0; col < 3; col++) {
            ctx.fillStyle = shades[col];
            const xOffset = col * cellSz;
            ctx.fillRect(xOffset + 2, 2, cellSz - 4, heights[col] * cellSz - 4);
          }
        }

        ctx.restore();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId); if (scrollUIRef.current) scrollUIRef.current.cleanup();
    };
  }, [availableSymbols, rootGameStore]);
  function calculateCanvasCoordinates(spell: any, canvasWidth: number, canvasHeight: number, cellWidthPx: number, cellHeightPx: number) {
    const cellIndex = spell.getCellIndex(); const canvasCenterX = canvasWidth / 2; const canvasCenterY = canvasHeight / 2;
    return {
      x: canvasCenterX + ((cellIndex.j - (GameBoard.NUM_COLS - 1) / 2) * cellWidthPx) - (cellWidthPx / 2),
      y: canvasCenterY + ((cellIndex.i - (GameBoard.NUM_ROWS - 1) / 2) * cellHeightPx) - (cellHeightPx / 2)
    };
  }

  return (
    <MasterCanvasOverlay
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      $zIndex={isHovered ? 32 : 29}
    />
  );
});

export default HTMLCanvasComponent;
