import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';

interface CanvasContainerProps {
  $size?: string; 
  $rotation: number;
}

interface CanvasContainerProps {
  $size?: string; 
  $rotation: number;
  $isTrembling?: boolean; // New prop to toggle the explosive power shake
}


// 1. Define a chaotic, rapid shaking & drifting animation loop
const volatileTremble = keyframes`
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  10% { transform: translate(-51%, -48%) rotate(-0.5deg) scale(1.01); }
  20% { transform: translate(-48%, -51%) rotate(1deg) scale(0.99); }
  // 30% { transform: translate(-52%, -50%) rotate(-1.5deg) scale(1.02); }
  40% { transform: translate(-49%, -52%) rotate(0.5deg) scale(1); }
  // 50% { transform: translate(-50%, -48%) rotate(-1deg) scale(1.01); }
  60% { transform: translate(-51%, -51%) rotate(1.5deg) scale(0.99); }
  // 70% { transform: translate(-48%, -49%) rotate(-0.5deg) scale(1.02); }
  80% { transform: translate(-52%, -52%) rotate(1deg) scale(1); opacity: 1; }
    // 90% { transform: translate(-49%, -50%) rotate(-1deg) scale(1.01); }
  100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
`;

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

  ${props => props.$isTrembling && css`
    /* Runs a rapid 0.15s loop to simulate an energetic, unstable dam breach */
    animation: ${volatileTremble} 15s linear infinite;
    
    /* Adds a violent neon/magical energy wave humming around the entire canvas container boundary */
    filter: drop-shadow(0 0 1.5cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 3cqw rgba(250, 244, 144, 0.3));
  `}
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
  rotation?: number;   
  size?: string;       
  drawSpeed?: number;  
  isLooped?: boolean;  
  loopDelay?: number;  
  callBack?: () => {}
}

// Particle interface for the pixie dust sparkle
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
}

export const AutomaticSpellCanvasComponent: React.FC<SpellCanvasComponentProps> = React.memo(({
  points,
  rotation = 0,
  size,
  drawSpeed = 0.6,
  isLooped = true,
  loopDelay = 1000,
  callBack = () => {}
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0); 
  const lastTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Pixie dust state references
  const particlesRef = useRef<DustParticle[]>([]);
  const colors = ['#FFF7C2', '#FFE53B', '#FFFFFF', '#A6FFEA', '#FFBBE1'];

  // Helper function to draw a 4-pointed star spark
  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
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

  // Monitors layout container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
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
  }, [size]);

  // Main High-Performance Drawing loop with Particle System updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0 || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    progressRef.current = 0;
    lastTimeRef.current = null;
    particlesRef.current = []; // Reset old particles on point/dimension changes
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

      // Only advance drawing line progress if we haven't hit 100% yet
      if (progressRef.current < 1.0) {
        progressRef.current += drawSpeed * deltaTime;
      }

      if (progressRef.current >= 1.0) {
        progressRef.current = 1.0;

        // do callback when drawing is done...
        callBack && callBack()
        
        // Handle looping resets while allowing existing trailing dust particles to completely finish fading out
        if (isLooped && !timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            progressRef.current = 0;
            lastTimeRef.current = null;
            particlesRef.current = [];
            timeoutRef.current = null;
          }, loopDelay);
        }
      }

      // Update particle physics positions
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y += p.vy;
        p.x += p.vx;
        p.vy += 0.02; // gentle gravity drop
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      // Render line strokes and particles together on this tick frame
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

    // --- Part 1: Draw the base neon trail stroke ---
    ctx.lineWidth = canvasSize * 0.015; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // ctx.strokeStyle = '#00ffcc'; 
        ctx.strokeStyle = '#e6c563'; 

    
    ctx.shadowBlur = canvasSize * 0.02;
    // ctx.shadowColor = '#00ffcc';
        ctx.shadowColor = '#fffadd';


    ctx.beginPath();
    ctx.moveTo(coords[0].x * canvasSize, coords[0].y * canvasSize);

    if (totalLength === 0) {
      ctx.stroke();
      return;
    }

    const targetLength = currentProgress * totalLength;
    let accumulatedLength = 0;
    let tipX = coords[0].x * canvasSize;
    let tipY = coords[0].y * canvasSize;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segLength = segments[i];

      if (accumulatedLength + segLength >= targetLength) {
        const remainingLength = targetLength - accumulatedLength;
        const ratio = segLength > 0 ? remainingLength / segLength : 0;
        
        tipX = (p1.x + (p2.x - p1.x) * ratio) * canvasSize;
        tipY = (p1.y + (p2.y - p1.y) * ratio) * canvasSize;

        ctx.lineTo(tipX, tipY);
        break;
      } else {
        ctx.lineTo(p2.x * canvasSize, p2.y * canvasSize);
        accumulatedLength += segLength;
        tipX = p2.x * canvasSize;
        tipY = p2.y * canvasSize;
      }
    }
    ctx.stroke();

    // --- Part 2: Auto-spawn pixie particles right at the front leading edge tip ---
    // Only spawn new particles while the path is actively drawing forward (progress < 1.0)
    if (currentProgress < 1.0) {
      const spawnCount = 3; // Number of particles spawned per animation frame loop
      for (let i = 0; i < spawnCount; i++) {
        particlesRef.current.push({
          x: tipX + (Math.random() - 0.5) * (canvasSize * 0.02),
          y: tipY + (Math.random() - 0.5) * (canvasSize * 0.02),
          size: Math.random() * (canvasSize * 0.006) + 0.5,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.7) * 0.8, // subtle upwards puff direction
          alpha: 1,
          decay: Math.random() * 0.02 + 0.015,
          color: colors[Math.floor(Math.random() * colors.length)],
          isStar: Math.random() > 0.6
        });
      }
    }

    // --- Part 3: Draw existing active magical particles ---
    const particles = particlesRef.current;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;

      if (p.isStar) {
        drawStar(ctx, p.x, p.y, 4, p.size * 2, p.size * 0.4);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  return (
    <CanvasContainer ref={containerRef} $isTrembling={true} $size={size} $rotation={rotation}>
      {dimensions.width > 0 && (
        <StyledCanvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </CanvasContainer>
  );
});

export default AutomaticSpellCanvasComponent;
