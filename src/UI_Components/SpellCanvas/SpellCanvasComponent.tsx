import React, { useRef, useEffect, useState } from 'react';
import { Game } from '../../DataClasses/Game';
import styled from 'styled-components';

const CanvasContainer = styled.div`
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 29; // Below UI Buttons. Above GameBoard.
    overflow: hidden;
    flex-direction: column;
    align-items: center;
    display: ${props => props.$isShowCanvas ? 'flex' : 'none'};
    filter: drop-shadow(0 0 1.5cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 3cqw rgba(250, 244, 144, 0.3));
`;

export const useCanvasSize = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        setSize({ width, height });
      }
    });

    resizeObserver.observe(parent);
    return () => resizeObserver.disconnect();
  }, []);

  return { canvasRef, ...size };
};

interface GameBoardComponentProps {
  rootGameStore: Game;
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

export default function SpellCanvasComponent({ rootGameStore }: GameBoardComponentProps) {
  const { canvasRef, width, height } = useCanvasSize();

  // Use a ref to hold particles so it doesn't trigger React rerenders on every frame
  const particlesRef = useRef<DustParticle[]>([]);
  const requestRef = useRef<number | null>(null);

  // Pixie dust colors: Magic Gold, Soft Cyan, Sparkle White, Pixie Pink
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

  // Main animation loop to update and draw particles
  useEffect(() => {
    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        requestRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas on every frame to redraw the active particle cluster
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Part 1: Draw the player's active gold spell line trail ---
      // Access points dynamically via the game store snapshot or reference evaluation
      const currentRawPoints = rootGameStore.getPlayerRawPoints() || [];
      if (currentRawPoints.length > 0 && rootGameStore.spellCanvas.getIsDrawing()) {
        const rect = canvas.getBoundingClientRect();

        // let gradient
        // if (currentRawPoints.length > 1) {
        //   gradient = ctx.createLinearGradient(currentRawPoints[0].x, currentRawPoints[0].y, currentRawPoints[currentRawPoints.length - 1].x, currentRawPoints[currentRawPoints.length - 1].y);

        //   gradient.addColorStop(0, '#e6c56303'); // 10% opacity at beginning
        //   gradient.addColorStop(1, '#e6c563'); // 100% opacity at end
        // }


        ctx.save();
        ctx.lineWidth = width * 0.003;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // ctx.strokeStyle = '#e6c563';
        // ctx.strokeStyle = gradient ? gradient : '#e6c563';
        // ctx.strokeStyle = '#e6c5639a';
        ctx.strokeStyle = '#e6c56386';

        ctx.shadowBlur = width * 0.05;
        ctx.shadowColor = '#fffadd';

        ctx.beginPath();
        // Convert screen coordinates to canvas layout space matching the particle system offsets
        ctx.moveTo(currentRawPoints[0].x - rect.left, currentRawPoints[0].y - rect.top);
        for (let i = 1; i < currentRawPoints.length; i++) {
          ctx.lineTo(currentRawPoints[i].x - rect.left, currentRawPoints[i].y - rect.top);
        }
        ctx.stroke();
        ctx.restore();
      }

      // --- Part 2: Draw existing active magical particles ---
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply physics: gentle drifting fall (gravity) and horizontal sway
        p.y += p.vy;
        p.x += p.vx;
        p.vy += 0.02; // soft gravity fall
        p.alpha -= p.decay; // fade away

        // Remove dead particles
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Add a magical bloom/glow behind the sparkles
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;

        if (p.isStar) {
          // Render iconic 4-point stars
          drawStar(ctx, p.x, p.y, 4, p.size * 2, p.size * 0.4);
        } else {
          // Render rounded magical dust circles
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [canvasRef, width, height, rootGameStore]);

  // Track points continuously and burst magical sparkles
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rootGameStore.spellCanvas.getIsDrawing()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Spawn a burst of 6-10 pixie dust particles for every tiny mouse movement
    const spawnCount = 8;
    for (let i = 0; i < spawnCount; i++) {
      particlesRef.current.push({
        x: clientX + (Math.random() - 0.5) * 12, // Slight scatter dispersion
        y: clientY + (Math.random() - 0.5) * 12,
        size: Math.random() * 2.5 + 0.5,       // Random sizing
        vx: (Math.random() - 0.5) * 1.5,       // Slow horizontal drift
        vy: (Math.random() - 0.8) * 1,         // Initial slight upward burst
        alpha: 1,
        decay: Math.random() * 0.2 + 0.015,   // Varied life durations
        color: colors[Math.floor(Math.random() * colors.length)],
        isStar: Math.random() > 0.6            // 40% are stars, 60% are magical dust grains
      });
    }

    rootGameStore.addRawPoint(e.clientX, e.clientY)
  };

  // Spark a large outward explosion of particles instantly on click
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Explode a vibrant ring of 35-45 magical particles out from the core center
    const explosionCount = 40;
    for (let i = 0; i < explosionCount; i++) {
      // Calculate a randomized angle and velocity for an outward shockwave blast direction
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.0;

      particlesRef.current.push({
        x: clientX,
        y: clientY,
        size: Math.random() * 3.5 + 0.8, // Slightly larger particles for the impact explosion
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5, // Subtle upward launch bias
        alpha: 1,
        decay: Math.random() * 0.35 + 0.01, // Exploded particles drift slightly longer before vanishing
        color: colors[Math.floor(Math.random() * colors.length)],
        isStar: Math.random() > 0.5 // Higher star density (50%) for click impacts
      });
    }
  };

  return (
    <CanvasContainer>
      <canvas
        ref={canvasRef}
        width={!!width ? width : 100}
        height={!!height ? height : 100}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
