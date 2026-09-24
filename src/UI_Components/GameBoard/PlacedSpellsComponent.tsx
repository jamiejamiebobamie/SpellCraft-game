import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { Game } from '../../DataClasses/Game';
import { drawProceduralSpell } from './RenderSpells/renderSpells';

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

    const render = (currentTime: number) => {
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

        // 1. Fetch cell span dimensions directly
        const cellCols = spell.getPropertyValue?.('widthCells') || 1;
        const cellRows = spell.getPropertyValue?.('heightCells') || 1;
        const w = cellWidthPx * cellCols;
        const h = cellHeightPx * cellRows;

        // Derive canvas translation using the precise board tracking reference
        const { x, y } = calculateCanvasCoordinates(
          spell,
          canvas.width,
          canvas.height,
          cellWidthPx,
          cellHeightPx
        );

        const dir = Math.sign(spell.getPropertyValue('speedDirection')) || 1;

        ctx.save();

        // 3. Move the canvas origin to the absolute CENTER of the spell's total width and height
        ctx.translate(x + w / 2, y + h / 2);

        // 4. Perform the horizontal flip safely around the center axis
        ctx.scale(dir, 1);

        // 5. Shift back by half the width/height so drawing code can still treat (0,0) as the top-left
        ctx.translate(-w / 2, -h / 2);

        // Execute procedural vectors using calculations driven by the board's scale
        drawProceduralSpell(ctx, spell, cellWidthPx, cellHeightPx, currentTime);

        ctx.restore();
      });

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


