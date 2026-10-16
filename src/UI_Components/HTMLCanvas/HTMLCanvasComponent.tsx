import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { rootGameStore } from '../../DataClasses/store';
import SettingsComponent from './Buttons/SettingsComponent';
import SpellBookComponent from './Buttons/SpellBookComponent';
import ClockFaceComponent from './Buttons/ClockFaceComponent';
import NpcDifficultyComponent from './Buttons/NpcDifficultyComponent';
import { drawProceduralSpell, updateAndDrawParticles } from './DrawFunctions/RenderSpells/renderSpells';
import { spawnQuickenParticles, spawnQuickenHitParticles } from './DrawFunctions/RenderSpells/drawQuicken';
import { spawnEtherParticles, spawnEtherHitParticles } from './DrawFunctions/RenderSpells/drawEther';
import { spawnPhlegmParticles, spawnPhlegmHitParticles } from './DrawFunctions/RenderSpells/drawPhlegm';
import { spawnGyreParticles, spawnGyreHitParticles } from './DrawFunctions/RenderSpells/drawGyre';
import { spawnBloodMagicHitParticles } from './DrawFunctions/RenderSpells/drawBloodMagicHit';
import { SpellAnimTracker, PlacedSpellsProps, DustParticle, CanvasScrollUI, Point } from '../../DataClasses/types';
import { draw4PointStar } from './DrawFunctions/Sparkles/SparkleFunctions';
import { drawClockAdvanceSymbols } from './DrawFunctions/ClockSymbols/ClockSymbolFunctions';
import { PALETTE } from './DrawFunctions/RenderSpells/ColorPalette';
import { useSnapshot } from 'valtio';
import { pixieColors, runGlobalBookSparkles, drawProceduralScroll, drawModalDetails } from './DrawFunctions/SpellBook/SpellBookFunctions';
import { drawKeyboardOverlay } from './DrawFunctions/KeyBindings/KeyBindingsOverlay';

const MasterCanvasOverlay = styled.canvas<{ $zIndex: number; $cursor: string }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100cqw; 
  height: 60cqw;
  z-index: ${props => (props.$zIndex ? props.$zIndex : 29)};
  pointer-events: auto;
  touch-action: none;
  filter: drop-shadow(0 0 1.5cqw rgba(248, 255, 54, 0.4));
  cursor: ${props => props.$cursor};
`;

interface NpcDrawTracker {
  progress: number;
  isTriggered: boolean;
  fadeAlpha: number;
  particles: DustParticle[];
  currentInferenceString: string;
  id: string;
}

const HTMLCanvasComponent = ({ gridOverlayRef }: PlacedSpellsProps) => {
  const snap = useSnapshot(rootGameStore);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const animStatesRef = useRef<Map<string, SpellAnimTracker>>(new Map());
  const drawingParticlesRef = useRef<DustParticle[]>([]);
  const scrollUIRef = useRef<CanvasScrollUI>(new CanvasScrollUI());

  // Performance-optimized reference tracking for NPC stroke progress mapping
  const npcTrackersRef = useRef<Map<number, NpcDrawTracker>>(new Map());

  const [isHovered, setIsHovered] = useState(false);
  const [isGearHovered, setIsGearHovered] = useState(false);
  const isComputerPlayerDoingTurn = !snap.getIsComputerPlayerDoneWithTurn();
  const isSpellBookOpen = snap.getIsSpellBookOpen();
  const readiedSpell = snap.getReadiedSpell();

  useEffect(() => {
    const boardElement = gridOverlayRef.current;
    if (!boardElement) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        boardLayoutRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      }
    });
    resizeObserver.observe(boardElement);
    const initialRect = boardElement.getBoundingClientRect();
    boardLayoutRef.current = { width: initialRect.width, height: initialRect.height };
    return () => resizeObserver.disconnect();
  }, [gridOverlayRef]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize); handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX = 'touches' in e ? (e.touches[0]?.clientX || 0) : e.clientX;
    let clientY = 'touches' in e ? (e.touches[0]?.clientY || 0) : e.clientY;
    const localX = clientX - rect.left; const localY = clientY - rect.top;
    scrollUIRef.current.currentMousePos = { x: localX, y: localY };
    if (!rootGameStore.spellCanvas.getIsDrawing()) return;
    for (let i = 0; i < 8; i++) {
      drawingParticlesRef.current.push({
        x: localX + (Math.random() - 0.5) * 12, y: localY + (Math.random() - 0.5) * 12,
        size: Math.random() * 2.5 + 0.5, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.8) * 1,
        alpha: 1, decay: Math.random() * 0.2 + 0.015, color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.6
      });
    }
    rootGameStore.addRawPoint(clientX, clientY);
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX = 'changedTouches' in e ? (e.changedTouches[0]?.clientX || 0) : e.clientX;
    let clientY = 'changedTouches' in e ? (e.changedTouches[0]?.clientY || 0) : e.clientY;
    const localX = clientX - rect.left; const localY = clientY - rect.top;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 3.5 + 1.0;
      drawingParticlesRef.current.push({
        x: localX, y: localY, size: Math.random() * 3.5 + 0.8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
        alpha: 1, decay: Math.random() * 0.35 + 0.01, color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.5
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    scrollUIRef.current.currentMousePos = { x: -1000, y: -1000 };
    scrollUIRef.current.hoveredSpellName = null; setIsHovered(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let animationFrameId: number; let lastTime = performance.now();

    const render = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; lastTime = currentTime;
      const viewW = canvas.width / (window.devicePixelRatio || 1);
      const viewH = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, viewW, viewH);

      const rect = canvas.getBoundingClientRect();
      const boardWidth = boardLayoutRef.current.width; const boardHeight = boardLayoutRef.current.height;
      if (boardWidth === 0 || boardHeight === 0) { animationFrameId = requestAnimationFrame(render); return; }
      const cellWidthPx = boardWidth / GameBoard.NUM_COLS; const cellHeightPx = boardHeight / GameBoard.NUM_ROWS;
      const isTrayOpen = rootGameStore.getIsSpellBookOpen(); const isShowingModal = !!scrollUIRef.current.hoveredSpellName && isTrayOpen;

      if (!isShowingModal && !isGearHovered) {
        const placedSpells = rootGameStore.placedSpells.spells || [];
        placedSpells.forEach((spell: any) => {
          const id = spell.id; const spellClass = spell.constructor.spellName;
          const targetCoords = calculateCanvasCoordinates(spell, viewW, viewH, cellWidthPx, cellHeightPx);
          if (!animStatesRef.current.has(id)) {
            animStatesRef.current.set(id, { spawnProgress: 0, deathProgress: 0, hasSpawnedParticles: false, particles: [], visualX: targetCoords.x, visualY: targetCoords.y, initialized: false } as any);
          }
          const anim = animStatesRef.current.get(id)!;
          if (!anim.initialized) { anim.visualX = targetCoords.x; anim.visualY = targetCoords.y; anim.initialized = true; }
          anim.visualX += (targetCoords.x - anim.visualX) * 3.5 * deltaTime;
          anim.visualY += (targetCoords.y - anim.visualY) * 3.5 * deltaTime;
          const cellCols = spell.getPropertyValue?.('widthCells') || 1, cellRows = spell.getPropertyValue?.('heightCells') || 1;
          const w = cellWidthPx * cellCols, h = cellHeightPx * cellRows, isRemove = spell.getIsRemove?.() || false, totalCells = cellCols * cellRows;
          const dir = Math.sign(spell.getPropertyValue('speedDirection')) || 1;

          if (anim.spawnProgress < 1) anim.spawnProgress = Math.min(1, anim.spawnProgress + deltaTime * 4.0);

          const isPlayerHit = spell.isPlayerHitImpact;
          const isOpponentHit = spell.isOpponentHitImpact;
          const isDisplay = !isRemove;
          const isBloodMagic = spell.isBloodMagic;

          // --- LAYER A: INDEPENDENT IMMEDIATE HIT/BLOOD MAGIC IMPACT PIPELINE ---
          if ((isBloodMagic || isPlayerHit || isOpponentHit) && !(anim as any).hasSpawnedHitParticles) {
            (anim as any).hasSpawnedHitParticles = true;

            // Calculate raw screen metrics relative to current spell container context
            const bLeftX = viewW / 2 - boardWidth / 2;
            const bRightX = viewW / 2 + boardWidth / 2;
            const bTopY = viewH / 2 - boardHeight / 2;

            // Center targets over the player/opponent body silhouettes on the field layout sides
            const tGlobalY = bTopY + (cellHeightPx * 1.5);
            const tGlobalX = isPlayerHit ? bLeftX - (cellWidthPx * 1.5) : bRightX + (cellWidthPx * 1.5);
            const tLocalX = tGlobalX - anim.visualX;
            const tLocalY = tGlobalY - anim.visualY;

            // Execute corresponding blast triggers instantly 
            if (isBloodMagic) {
              spawnBloodMagicHitParticles(anim.particles, tLocalX, tLocalY, spell.hitDamageAmount);
            } else if (spellClass === 'Quicken') {
              spawnQuickenHitParticles(anim.particles, tLocalX, tLocalY, boardHeight);
            } else if (spellClass === 'Ether') {
              spawnEtherHitParticles(anim.particles, tLocalX, tLocalY);
            } else if (spellClass === 'Phlegm') {
              spawnPhlegmHitParticles(anim.particles, tLocalX, tLocalY);
            } else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') {
              spawnGyreHitParticles(anim.particles, tLocalX, tLocalY, isOpponentHit ? 'right' : 'left', cellWidthPx);
            }

            // Render floating text metrics instantly
            anim.particles.push({
              x: tLocalX + (Math.random() * 60 - 30),
              y: tLocalY - 20,
              vx: (Math.random() * 20 - 10),
              vy: -130 - Math.random() * 30,
              alpha: 1.0,
              size: 46,
              color: spell.hitDamageAmount < 0 ? '#3bed8e' : '#ee3737',
              text: spell.hitDamageAmount < 0 ? `+${Math.abs(spell.hitDamageAmount)}` : `-${spell.hitDamageAmount}`,
              life: 1.0,
              decay: 0.75,
              type: 'floatingText'
            } as any);
          }

          // --- LAYER B: INDEPENDENT AMBIENT / REMOVAL TRACKER ---
          if (!isDisplay && !anim.hasSpawnedParticles) {
            anim.hasSpawnedParticles = true;

            // Handled solely if the spell itself didn't use an initial blood magic component trigger above
            if (!spell.isBloodMagic) {
              if (spellClass === 'Quicken') spawnQuickenParticles(anim.particles, w, h);
              else if (spellClass === 'Ether') spawnEtherParticles(anim.particles, w, h);
              else if (spellClass === 'Phlegm') spawnPhlegmParticles(anim.particles, w, h);
              else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') spawnGyreParticles(anim.particles, w, h);
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
            ctx.save(); ctx.translate(anim.visualX + w / 2, anim.visualY + h / 2); ctx.scale(dir, 1); ctx.translate(-w / 2, -h / 2);
            drawProceduralSpell(ctx, spell, cellWidthPx, cellHeightPx, currentTime, anim.spawnProgress); ctx.restore();
          }
          if (anim.particles.length > 0) { ctx.save(); ctx.translate(anim.visualX, anim.visualY); updateAndDrawParticles(ctx, anim.particles, deltaTime); ctx.restore(); }
        });
        // LIVE MOUSE HOVER SPELL PREVIEW PIPELINE
        if (readiedSpell && scrollUIRef.current.currentMousePos.x > -500) {
          const mX = scrollUIRef.current.currentMousePos.x;
          const mY = scrollUIRef.current.currentMousePos.y;
          const mockPreviewInstance = {
            id: 'readied-cursor-preview',
            constructor: { spellName: readiedSpell },
            getPropertyValue: (prop: string) => {
              if (prop === 'widthCells') return 1;
              if (prop === 'heightCells') return 1;
              if (prop === 'speedDirection') return 1;
              return 0;
            }
          };
          ctx.save();
          ctx.globalAlpha = 0.65;
          ctx.translate(mX - cellWidthPx * 0.5, mY - cellHeightPx * 0.5);
          drawProceduralSpell(ctx, mockPreviewInstance, cellWidthPx, cellHeightPx, currentTime, 1.0);
          ctx.restore();
        }
        const dustParticles = drawingParticlesRef.current;
        for (let i = dustParticles.length - 1; i >= 0; i--) {
          const p = dustParticles[i]; if (!p) continue; p.y += p.vy; p.x += p.vx; p.vy += 0.02; p.alpha -= p.decay;
          if (p.alpha <= 0) { dustParticles.splice(i, 1); continue; }
          ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.shadowBlur = p.size * 2; ctx.shadowColor = p.color;
          if (p.isStar) draw4PointStar(ctx, p.x, p.y, p.size * 2, p.size * 0.4); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        const currentRawPoints = rootGameStore.getPlayerRawPoints() || [];
        if (currentRawPoints.length > 0 && rootGameStore.spellCanvas.getIsDrawing()) {
          ctx.save(); ctx.lineWidth = boardWidth * 0.0075; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#e6c56386'; ctx.shadowBlur = boardWidth * 0.05; ctx.shadowColor = '#fffadd'; ctx.beginPath(); ctx.moveTo(currentRawPoints.x - rect.left, currentRawPoints.y - rect.top);
          for (let i = 1; i < currentRawPoints.length; i++) { ctx.lineTo(currentRawPoints[i].x - rect.left, currentRawPoints[i].y - rect.top); }
          ctx.stroke(); ctx.restore();
        }
        // =======================================================
        // DIRECT COGNITIVE PATH FOR NPC ABSOLUTE INFERENCE STRINGS
        // =======================================================
        const maxNpcIndexCount = 4;
        for (let idx = 0; idx < maxNpcIndexCount; idx++) {
          const npcDatum = rootGameStore.getNPCMoveDatum(idx);
          if (!npcDatum) continue;
          const { inferenceString, storedSpell, speed, scale } = npcDatum;
          if (!inferenceString) continue;
          if (!npcTrackersRef.current.has(idx)) {
            npcTrackersRef.current.set(idx, {
              progress: 0, isTriggered: false, fadeAlpha: 1.0, particles: [], currentInferenceString: inferenceString, id: npcDatum.id
            });
          }
          const tracker = npcTrackersRef.current.get(idx)!;
          // FIX: Force tracker structural reset if either the unique id OR inferenceString differs from cache
          if (tracker.id !== npcDatum.id || tracker.currentInferenceString !== inferenceString) {
            tracker.progress = 0; tracker.isTriggered = false; tracker.fadeAlpha = 1.0; tracker.particles = []; tracker.currentInferenceString = inferenceString; tracker.id = npcDatum.id;
          }
          const rawNpcPoints = rootGameStore.getNpcDrawingPoints() || [];
          if (rawNpcPoints.length === 0) continue;
          // Increment stroke rendering index
          if (speed && tracker.progress < 1.0) {
            tracker.progress += speed * deltaTime;
            if (tracker.progress >= 1.0) tracker.progress = 1.0;
            const ptIdx = Math.floor(rawNpcPoints.length * tracker.progress);
            const currentMousePos = rawNpcPoints[Math.min(ptIdx, rawNpcPoints.length - 1)];
            if (currentMousePos) rootGameStore.setNpcMousePos(currentMousePos);
          }
          // Complete drawing stroke
          if (tracker.progress >= 1.0 && !tracker.isTriggered) {
            tracker.isTriggered = true;
            if (storedSpell) storedSpell();
          }
          if (tracker.isTriggered && tracker.fadeAlpha > 0) {
            tracker.fadeAlpha -= deltaTime * 1.0;
            if (tracker.fadeAlpha < 0) tracker.fadeAlpha = 0;
          }
          // Particle processing math inside the local loop
          for (let pIdx = tracker.particles.length - 1; pIdx >= 0; pIdx--) {
            const p = tracker.particles[pIdx]; p.y += p.vy; p.x += p.vx; p.vy += 0.02; p.alpha -= p.decay;
            if (p.alpha <= 0) tracker.particles.splice(pIdx, 1);
          }
          if (tracker.fadeAlpha > 0 || tracker.particles.length > 0) {
            ctx.save();
            ctx.globalAlpha = tracker.fadeAlpha;
            ctx.lineWidth = cellWidthPx * Math.max(scale.x, scale.y || 1) * 0.015;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = '#e6c5639d'; ctx.shadowBlur = cellWidthPx * 0.02; ctx.shadowColor = '#fffadd';
            ctx.beginPath();
            // Translate the first point safely into canvas space box coordinates
            ctx.moveTo(rawNpcPoints[0].x - rect.left, rawNpcPoints[0].y - rect.top);
            const activeIndexThreshold = Math.floor(rawNpcPoints.length * tracker.progress);
            for (let s = 1; s < activeIndexThreshold; s++) {
              ctx.lineTo(rawNpcPoints[s].x - rect.left, rawNpcPoints[s].y - rect.top);
            }
            ctx.stroke();
            // Handle lead spark positioning directly onto the drawing edge tip point tracking
            if (tracker.progress < 1.0 && activeIndexThreshold > 0) {
              const leadTip = rawNpcPoints[Math.min(activeIndexThreshold - 1, rawNpcPoints.length - 1)];
              const canvasTipX = leadTip.x - rect.left;
              const canvasTipY = leadTip.y - rect.top;
              for (let k = 0; k < 3; k++) {
                tracker.particles.push({
                  x: canvasTipX + (Math.random() - 0.5) * (cellWidthPx * 0.05),
                  y: canvasTipY + (Math.random() - 0.5) * (cellWidthPx * 0.05),
                  size: Math.random() * (cellWidthPx * 0.006) + 0.5,
                  vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.7) * 0.8,
                  alpha: 1, decay: Math.random() * 0.02 + 0.015,
                  color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.6
                });
              }
            }
            // Draw trailing active ambient pixie sparks
            for (let pIdx = 0; pIdx < tracker.particles.length; pIdx++) {
              const p = tracker.particles[pIdx]; ctx.save();
              ctx.globalAlpha = p.alpha * tracker.fadeAlpha; ctx.fillStyle = p.color;
              ctx.shadowBlur = p.size * 2; ctx.shadowColor = p.color;
              if (p.isStar) {
                draw4PointStar(ctx, p.x, p.y, p.size * 2, p.size * 0.4);
              } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
              }
              ctx.restore();
            }
            ctx.restore();
          }
        }
      }
      drawClockAdvanceSymbols(ctx, scrollUIRef.current, viewW, viewH, currentTime);
      const isIntroDone = rootGameStore.getIsDoneWithIntroWalk();
      if (isShowingModal && isIntroDone) drawModalDetails(ctx, scrollUIRef.current, deltaTime, viewW, viewH, animStatesRef.current, currentTime);
      if (isGearHovered && !isShowingModal && isIntroDone) drawKeyboardOverlay(ctx, viewW, viewH);
      if (isIntroDone) {
        runGlobalBookSparkles(ctx, scrollUIRef.current, viewW);
        drawProceduralScroll(ctx, scrollUIRef.current, viewW, viewH, deltaTime, currentTime, setIsHovered, animStatesRef.current);
      }
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animationFrameId); if (scrollUIRef.current) scrollUIRef.current.cleanup(); };
  }, [rootGameStore, isGearHovered, readiedSpell, isComputerPlayerDoingTurn]);
  function calculateCanvasCoordinates(spell: any, canvasWidth: number, canvasHeight: number, cellWidthPx: number, cellHeightPx: number) {
    const cellIndex = spell.getCellIndex(); return {
      x: (canvasWidth / 2) + ((cellIndex.j - (GameBoard.NUM_COLS - 1) / 2) * cellWidthPx) - (cellWidthPx / 2),
      y: (canvasHeight / 2) + ((cellIndex.i - (GameBoard.NUM_ROWS - 1) / 2) * cellHeightPx) - (cellHeightPx / 2)
    };
  }
  const buttons = <>
    <SpellBookComponent isGearHovered={isGearHovered} />
    <NpcDifficultyComponent isShowingModal={isGearHovered || isSpellBookOpen && scrollUIRef?.current?.hoveredSpellName != null} />
    <ClockFaceComponent isShowingModal={isSpellBookOpen && scrollUIRef?.current?.hoveredSpellName != null}  />
    <SettingsComponent setIsGearHovered={(bool: boolean) => { if (bool) rootGameStore.setIsSpellBookOpen(false); setIsGearHovered(bool); }} isShowingModal={isSpellBookOpen && scrollUIRef?.current?.hoveredSpellName != null} />
  </>;
  return (
    <>
      {buttons}
      <MasterCanvasOverlay
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        touchAction="none"
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        $zIndex={isHovered || isGearHovered || (readiedSpell != null) ? 32 : 29}
        $cursor={readiedSpell ? 'crosshair' : (isHovered ? 'pointer' : 'default')} />
    </>
  );
};
export default HTMLCanvasComponent;