import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { Game } from '../../DataClasses/Game';
import { drawProceduralSpell, updateAndDrawParticles } from './RenderSpells/renderSpells';
import { spawnQuickenParticles, spawnQuickenHitParticles } from './RenderSpells/drawQuicken';
import { spawnEtherParticles, spawnEtherHitParticles } from './RenderSpells/drawEther';
import { spawnPhlegmParticles, spawnPhlegmHitParticles } from './RenderSpells/drawPhlegm';
import { spawnGyreParticles, spawnGyreHitParticles } from './RenderSpells/drawGyre';
import { SpellAnimTracker } from '../../DataClasses/types'
import { PALETTE } from './RenderSpells/ColorPalette';

const CanvasOverlay = styled.canvas`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100cqw; 
  height: 60cqw;
  z-index: 1; 
  pointer-events: none;
`;

interface PlacedSpellsProps {
  rootGameStore: Game;
  gridOverlayRef: React.RefObject<HTMLDivElement | null>; // Pass your gameboard's ref from parent
}

export const PlacedSpellsComponent = ({ rootGameStore, gridOverlayRef }: PlacedSpellsProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cached layout measurements of the actual game board (NOT the full canvas)
  const boardLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Local cache for time-based animation data and destruction particles
  const animStatesRef = useRef<Map<string, SpellAnimTracker>>(new Map());

  // 1. Observe the game board element's size asynchronously
  useEffect(() => {
    const boardElement = gridOverlayRef.current;
    if (!boardElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Capture exact width/height without forcing a layout reflow
        const { width, height } = entry.contentRect;
        boardLayoutRef.current = { width, height };
      }
    });

    resizeObserver.observe(boardElement);

    // Initial extraction in case it's already mounted
    const initialRect = boardElement.getBoundingClientRect();
    boardLayoutRef.current = { width: initialRect.width, height: initialRect.height };

    return () => resizeObserver.disconnect();
  }, [gridOverlayRef]);

  // 2. Adjust internal Canvas sizing when window sizes change
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Keep canvas resolution synced to its responsive physical bounding area
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call to map values

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. RENDER LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // time elapsed in seconds

      lastTime = currentTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gracefully guard against moments where references are initializing
      const boardWidth = boardLayoutRef.current.width;
      const boardHeight = boardLayoutRef.current.height;
      if (boardWidth === 0 || boardHeight === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Compute exact sizing variables purely from the tracked board sizes
      const cellWidthPx = boardWidth / GameBoard.NUM_COLS;
      const cellHeightPx = boardHeight / GameBoard.NUM_ROWS;

      const placedSpells = rootGameStore.placedSpells.spells || [];
      if (!Array.isArray(placedSpells)) return;

      placedSpells.forEach((spell: any) => {

        // Inside your placedSpells.forEach iteration block:
        const id = spell.id;
        const spellClass = spell.constructor.name;

        // Gather geometric sizes
        const cellCols = spell.getPropertyValue?.('widthCells') || 1;
        const cellRows = spell.getPropertyValue?.('heightCells') || 1;
        const w = cellWidthPx * cellCols;
        const h = cellHeightPx * cellRows;

        const { x, y } = calculateCanvasCoordinates(spell, canvas.width, canvas.height, cellWidthPx, cellHeightPx);
        const dir = Math.sign(spell.getPropertyValue('speedDirection')) || 1;

        // Inside your placedSpells.forEach processing loop:
        if (!animStatesRef.current.has(id)) {
          animStatesRef.current.set(id, {
            spawnProgress: 0,
            deathProgress: 0,
            hasSpawnedParticles: false,
            particles: []
          });
        }
        const anim = animStatesRef.current.get(id)!;

        // Advance spawn progress over time if it hasn't finished
        if (anim.spawnProgress < 1) {
          anim.spawnProgress = Math.min(1, anim.spawnProgress + deltaTime * 4.0); // ~0.25s duration
        }

        // Inside your placedSpells.forEach iteration loop:
        const cellIndex = spell.getCellIndex();
        const isRemove = spell.getIsRemove?.() || false;

        if (isRemove) {
          anim.deathProgress = Math.min(1, anim.deathProgress + deltaTime * 2.5);

          if (!anim.hasSpawnedParticles) {
            anim.hasSpawnedParticles = true;

            // Detect if collision occurred on the edge columns
            const isPlayerHit = cellIndex.j <= 0;
            const isOpponentHit = cellIndex.j >= GameBoard.NUM_COLS - 1;

            if (isPlayerHit || isOpponentHit) {
              // --- FIXED CHARACTER ANCHOR POSITION MATH ---

              // 1. Calculate the absolute pixel bounds for the edges of your actual board
              const boardLeftEdgeX = canvas.width / 2 - boardWidth / 2;
              const boardRightEdgeX = canvas.width / 2 + boardWidth / 2;
              const boardTopEdgeY = canvas.height / 2 - boardHeight / 2;

              // 2. Set the Y anchor to the center of the SECOND row (Index 1)
              const targetGlobalY = boardTopEdgeY + (cellHeightPx * 1.5);

              // 3. Set the X anchor to 1.5 cell-widths past the respective edges
              const targetGlobalX = isPlayerHit
                ? boardLeftEdgeX - (cellWidthPx * 1.5)  // 1.5 cells to the left of column 0
                : boardRightEdgeX + (cellWidthPx * 1.5); // 1.5 cells to the right of last column

              // 4. Translate these absolute canvas numbers into the local particle context space
              // (Because our canvas container drawing context translates to 'x' and 'y' for this spell)
              const targetLocalX = targetGlobalX - x;
              const targetLocalY = targetGlobalY - y;

              // --- TRIGGER HIT IMPACT FACTORIES ---
              if (spellClass === 'Quicken') {
                spawnQuickenHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              } else if (spellClass === 'Ether') {
                spawnEtherHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              } else if (spellClass === 'Phlegm') {
                spawnPhlegmHitParticles(anim.particles, targetLocalX, targetLocalY, boardHeight);
              } else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') {
                const sweepDir = isOpponentHit ? 'right' : 'left';
                // Pass cellWidthPx so the wind trail knows where the board boundary sits
                spawnGyreHitParticles(anim.particles, targetLocalX, targetLocalY, sweepDir, cellWidthPx);
              }

            } else {
              // --- REGULAR FIELD-OF-PLAY DESTRUCTION BLOCK ---
              if (spellClass === 'Quicken') spawnQuickenParticles(anim.particles, w, h);
              else if (spellClass === 'Ether') spawnEtherParticles(anim.particles, w, h);
              else if (spellClass === 'Phlegm') spawnPhlegmParticles(anim.particles, w, h);
              else if (spellClass === 'GyreUp' || spellClass === 'GyreDown') spawnGyreParticles(anim.particles, w, h);
            }
          }
        }

        const shouldDrawMainSpell = !isRemove;
        if (shouldDrawMainSpell) {
          // --- SPAWN TRAILING ETHER FLAMES ---
          if (spellClass === 'Ether' && anim) {
            const cx = w / 2 + (w / 10) * dir;
            const cy = h / 2;
            const radius = Math.min(w, h) * 0.3;
            const bobY = Math.sin(currentTime * 0.005) * (h * 0.04);

            if (Math.random() < 0.5) {
              const spreadX = (Math.random() - 0.85) * (radius * 1.75) * dir;
              const spreadY = (Math.random() - 0.5) * (radius * 1.75);

              const spawnX = cx + spreadX;
              const spawnY = cy + bobY + spreadY;

              const lengthFromCenter = Math.sqrt(Math.pow((cx - spawnX), 2) + Math.pow((cy - spawnY), 2));
              const ratio = lengthFromCenter / radius;
              const color = ratio < .3 ? PALETTE.fireCore : ratio < .8 ? PALETTE.fireMid : PALETTE.fireOuter;

              const size = radius * (0.05 + Math.random() * 0.07);

              anim.particles.push({
                x: spawnX,
                y: spawnY,
                vx: -(100 + Math.random() * 100 * cellCols) * dir,
                vy: -100 - Math.random() * 100 * cellCols,
                alpha: 1.0,
                size: Math.max((1 - ratio) * size * 2, size),
                color,
                life: 1.0,
                decay: 1.5 + Math.random() * 1,
                type: 'etherFlame',
              });
            }
          }

          ctx.save();
          // 1. Move to the center of the spell bounding box
          ctx.translate(x + w / 2, y + h / 2);
          ctx.scale(dir, 1);
          ctx.translate(-w / 2, -h / 2);

          // 2. Pass spawnProgress as a clean parameter into your drawing router function
          drawProceduralSpell(ctx, spell, cellWidthPx, cellHeightPx, currentTime, anim.spawnProgress);

          ctx.restore();
        }

        // Render destruction/spawn ambient particles if any exist
        if (anim.particles.length > 0) {
          ctx.save();
          ctx.translate(x, y);
          updateAndDrawParticles(ctx, anim.particles, deltaTime);
          ctx.restore();
        }
      })

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [rootGameStore]);

  return <CanvasOverlay ref={canvasRef} />;
};


function calculateCanvasCoordinates(
  spell: any,
  canvasWidth: number,
  canvasHeight: number,
  cellWidthPx: number,
  cellHeightPx: number
) {
  const cellIndex = spell.getCellIndex();

  // Find the exact screen middle of the entire Canvas overlay
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  // FIX: Shift calculation by half-index step offsets to center coordinate spaces perfectly on tiles
  const gridOffsetX = (cellIndex.j - (GameBoard.NUM_COLS - 1) / 2) * cellWidthPx;
  const gridOffsetY = (cellIndex.i - (GameBoard.NUM_ROWS - 1) / 2) * cellHeightPx;

  // Target the exact top-left bounds of the starting tile
  const x = canvasCenterX + gridOffsetX - (cellWidthPx / 2);
  const y = canvasCenterY + gridOffsetY - (cellHeightPx / 2);

  return { x, y };
}


