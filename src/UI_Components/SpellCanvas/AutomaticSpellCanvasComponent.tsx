import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

interface CanvasContainerProps {
  $size?: string; // Changed to accept string CSS units like '40cqw'
  $rotation: number;
}

// Parent container enforcing 1:1 Aspect Ratio using cqw or filling the container
const CanvasContainer = styled.div<CanvasContainerProps>`
  width: ${props => (props.$size ? props.$size : '100%')};
  height: ${props => (props.$size ? props.$size : '100%')};
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(${props => props.$rotation}deg);
  transform-origin: center center;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 41;
`;

const StyledCanvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

export interface Point2D {
  x: number; // Normalized 0.0 to 1.0
  y: number; // Normalized 0.0 to 1.0
}

interface SpellCanvasComponentProps {
  points: Point2D[];
  rotation?: number;   // Optional rotation in degrees
  size?: string;       // Optional size in CSS units (e.g., "50cqw")
  drawSpeed?: number;  // Distance percentage (0.0 to 1.0) drawn per second
  isLooped?: boolean;  // Re-animate once finished
  loopDelay?: number;  // Delay in milliseconds between loops
}

export const AutomaticSpellCanvasComponent: React.FC<SpellCanvasComponentProps> = ({
  points,
  rotation = 0,
  size,
  drawSpeed = 0.6,
  isLooped = true,
  loopDelay = 1000,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0); 
  const lastTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitors the layout container size (fluid or fixed cqw) 
  // and updates the backing canvas texture resolution automatically.
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Fallback to client bounds if contentRect is evaluating cleanly as 0 initially
        const targetWidth = width || containerRef.current?.clientWidth || 0;
        const targetHeight = height || containerRef.current?.clientHeight || 0;
        
        const squareSize = Math.min(targetWidth, targetHeight);
        if (squareSize > 0) {
          setDimensions({ width: squareSize, height: squareSize });
        }
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [size]); // Re-bind if size parameter toggles dynamically

  // Main High-Performance Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0 || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    progressRef.current = 0;
    lastTimeRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const segments: number[] = [];
    let totalLength = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segments.push(len);
      totalLength += len;
    }

    const renderLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      progressRef.current += drawSpeed * deltaTime;

      if (progressRef.current >= 1.0) {
        progressRef.current = 1.0;
        draw(ctx, canvas.width, points, segments, totalLength, 1.0);

        if (isLooped) {
          timeoutRef.current = setTimeout(() => {
            progressRef.current = 0;
            lastTimeRef.current = null;
            animationRef.current = requestAnimationFrame(renderLoop);
          }, loopDelay);
          return;
        }
        return;
      }

      draw(ctx, canvas.width, points, segments, totalLength, progressRef.current);
      animationRef.current = requestAnimationFrame(renderLoop);
    };

    animationRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [points, dimensions, drawSpeed, isLooped, loopDelay]);

  const draw = (
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    coords: Point2D[],
    segments: number[],
    totalLength: number,
    currentProgress: number
  ) => {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    if (coords.length === 0) return;

    ctx.lineWidth = canvasSize * 0.015; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#00ffcc'; 
    
    ctx.shadowBlur = canvasSize * 0.02;
    ctx.shadowColor = '#00ffcc';

    ctx.beginPath();
    ctx.moveTo(coords[0].x * canvasSize, coords[0].y * canvasSize);

    if (totalLength === 0) {
      ctx.stroke();
      return;
    }

    const targetLength = currentProgress * totalLength;
    let accumulatedLength = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segLength = segments[i];

      if (accumulatedLength + segLength >= targetLength) {
        const remainingLength = targetLength - accumulatedLength;
        const ratio = segLength > 0 ? remainingLength / segLength : 0;
        
        const interpolatedX = (p1.x + (p2.x - p1.x) * ratio) * canvasSize;
        const interpolatedY = (p1.y + (p2.y - p1.y) * ratio) * canvasSize;

        ctx.lineTo(interpolatedX, interpolatedY);
        break;
      } else {
        ctx.lineTo(p2.x * canvasSize, p2.y * canvasSize);
        accumulatedLength += segLength;
      }
    }

    ctx.stroke();
  };

  return (
    <CanvasContainer ref={containerRef} $size={size} $rotation={rotation}>
      {dimensions.width > 0 && (
        <StyledCanvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </CanvasContainer>
  );
};

export default AutomaticSpellCanvasComponent;
