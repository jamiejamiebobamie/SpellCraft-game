import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

// --- Styled Components ---
const CanvasContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  /* Solid, flat ink background typical of traditional animation */
  background-color: #110d24; 
  overflow: hidden;
`;

const StyledCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
`;

// --- TypeScript Interfaces ---
interface Point {
  x: number;
  y: number;
}

interface StrokePath {
  points: Point[];
  id: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number; // velocity y
  alpha: number;
  size: number;
  hue: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
  type: 'star' | 'glint' | 'orb' | 'speck';
}

export const PixieDustCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathsRef = useRef<StrokePath[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const currentPathIdRef = useRef<number>(0);

  // Handle Screen Resizing and High-DPI Displays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Main Hand-Drawn Particle Engine Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const renderLoop = () => {
      // Opaque painting style (replaces modern digital glow)
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#110d24'; // Redraw solid background color
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // --- 1. Spawning Mechanics ---
      pathsRef.current.forEach((path) => {
        if (path.points.length < 2) return;

        for (let i = 0; i < path.points.length - 1; i++) {
          const p1 = path.points[i];
          const p2 = path.points[i + 1];

          // Higher emission rate while the line is being drawn
          const spawnChance = isDrawingRef.current && path.id === currentPathIdRef.current ? 0.35 : 0.04;

          if (Math.random() < spawnChance) {
            // Linear Interpolation: Fills structural gaps between mouse tracker frames
            const ratio = Math.random();
            const spawnX = p1.x + (p2.x - p1.x) * ratio;
            const spawnY = p1.y + (p2.y - p1.y) * ratio;

            // Roll for a specific asset shape type
            const typeRoll = Math.random();
            let pType: 'star' | 'glint' | 'orb' | 'speck' = 'speck';

            if (typeRoll > 0.85) pType = 'star';
            else if (typeRoll > 0.65) pType = 'glint';
            else if (typeRoll > 0.35) pType = 'orb';

            particlesRef.current.push({
              x: spawnX,
              y: spawnY,
              // vx: (Math.random() - 0.5) * 1.6,             // Swirling outward spread
              // vy: Math.random() * 1.2 + 0.6,               // Fluttering gravitational fall
              vx: (Math.random() - 0.5) * 1.6,             // Swirling outward spread
              vy: Math.random() * 1.2 + 0.6,               // Fluttering gravitational fall
              alpha: 1,
              size: pType === 'star' ? Math.random() * 6 + 4 : Math.random() * 3 + 1.5,
              hue: Math.random() * 15 + 45,                // Vintage golden tint (45-60 Hue)
              decay: Math.random() * 0.02 + 0.01,          // Lifespan
              rotation: Math.random() * Math.PI * 2,       // Random starting orientation
              rotationSpeed: (Math.random() - 0.5) * 0.08, // Frame-by-frame tumble
              type: pType,
            });
          }
        }
      });

      // --- 2. Physics & Vector Rendering Engine ---
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        // Wavy atmospheric drift (simulates hand-drawn float timing)
        p.vx += Math.sin(p.y * 0.03 + p.size) * 0.04;

        if (p.alpha <= 0) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Shrink-to-nothing over lifetime (mimics cell frames popping out of existence)
        const scale = p.alpha;
        ctx.scale(scale, scale);

        // Core Palette styling
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, 1)`; // Saturated cell ink fill
        ctx.strokeStyle = `hsla(${p.hue}, 100%, 25%, 1)`; // Darker illustrative outline
        ctx.lineWidth = 1;

        ctx.beginPath();
        if (p.type === 'star') {
          // Classic Peter Pan pinched 4-point star using curves
          const r = p.size;
          const i = r * 0.2; // Pinch depth factor
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(0, -i, i, -i);
          ctx.quadraticCurveTo(i, 0, r, 0);
          ctx.quadraticCurveTo(i, 0, i, i);
          ctx.quadraticCurveTo(0, r, 0, r);
          ctx.quadraticCurveTo(0, i, -i, i);
          ctx.quadraticCurveTo(-i, 0, -r, 0);
          ctx.quadraticCurveTo(-i, 0, -i, -i);
          ctx.quadraticCurveTo(0, -i, 0, -r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Pure white high-contrast highlight center
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
          ctx.fill();

        } else if (p.type === 'glint') {
          // Sharp twinkle cross asset
          ctx.rect(-p.size * 1.5, -0.75, p.size * 3, 1.5);
          ctx.rect(-0.75, -p.size * 1.5, 1.5, p.size * 3);
          ctx.fill();

        } else if (p.type === 'orb') {
          // Opaque solid bubble circles
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

        } else {
          // Tiny loose specks (White pigment accents)
          ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        ctx.restore();
        return true;
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- Input Vector Coordinate Getters ---
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches.clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    currentPathIdRef.current = Date.now();
    const coord = getCoordinates(e);

    pathsRef.current.push({
      id: currentPathIdRef.current,
      points: [coord],
    });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const coord = getCoordinates(e);

    const activePath = pathsRef.current.find(p => p.id === currentPathIdRef.current);
    if (activePath) {
      activePath.points.push(coord);
    }
  };

  const handleEnd = () => {
    isDrawingRef.current = false;
  };

  return (
    <CanvasContainer>
      <StyledCanvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </CanvasContainer>
  );
};
