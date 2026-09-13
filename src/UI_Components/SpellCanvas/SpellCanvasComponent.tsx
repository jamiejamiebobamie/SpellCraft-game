import React, { useRef, useEffect, useState } from 'react';
import { Game } from '../../DataClasses/Game';
import styled from 'styled-components';
import { useSnapshot } from 'valtio';

const CanvasContainer = styled.div<{ $isShowCanvas: boolean }>`
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 50;
    overflow: hidden;
    flex-direction: column;
    align-items: center;
    display: ${props => props.$isShowCanvas ? 'flex' : 'none'};
`;

export const useCanvasSize = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;

    // ResizeObserver tracks the parent container size specifically
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Optimize for Retina/High-DPI displays to eliminate blur
        const dpr = window.devicePixelRatio || 1;

        // Set the internal drawing buffer size
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        // Scale the canvas context once so your drawing code stays simple
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        // Update state to trigger a redraw with the correct CSS layout size
        setSize({ width, height });
      }
    });

    resizeObserver.observe(parent);

    // Clean up observer when component unmounts
    return () => resizeObserver.disconnect();
  }, []);

  return { canvasRef, ...size };
};

interface GameBoardComponentProps {
  rootGameStore: Game;
}

export default function SpellCanvasComponent({ rootGameStore }: GameBoardComponentProps) {
  const { canvasRef, width, height } = useCanvasSize();
  const snap = useSnapshot(rootGameStore.spellCanvas);

  // Track points continuously as long as the mouse is down
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rootGameStore.spellCanvas.getIsDrawing()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (ctx) {
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#6366f1'; // Spell trial path color
      ctx.lineTo(clientX, clientY);
      ctx.stroke();
    }

    rootGameStore.spellCanvas.addRawPoint(e.clientX, e.clientY);
  };

  const isShowCanvas = snap.getIsShowCanvas();
  return (
    <CanvasContainer $isShowCanvas={isShowCanvas}>
      <canvas
        ref={canvasRef}
        width={!!width ? width : 100}
        height={!!height ? height : 100}
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none'
        }}
      />
    </CanvasContainer>
  );
}