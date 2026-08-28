import React, { useRef, useEffect, useState } from 'react';
import { ramerDouglasPeucker } from '../utils/rdp';
import { findMaxDistance } from '../utils/maxdistance';
import type { Point } from '../utils/rdp';
import { runSpellInference } from '../utils/inference';
import * as ort from 'onnxruntime-web';

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

export default function SpellCanvas(session: ort.InferenceSession | null) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [rawPoints, setRawPoints] = useState<Point[]>([]);
  const [result, setResult] = useState<string>('');
  const { canvasRef, width, height } = useCanvasSize();

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   if (!canvas || width === 0 || height === 0) return;
  //   const ctx = canvas.getContext('2d');
  //   if (!ctx) return;
  //   // --- DRAWING LOGIC HERE ---
  //   // The hook handles clearing and scaling automatically on resize.
  //   ctx.fillStyle = '#4f46e5';
  //   ctx.fillRect(20, 20, width - 40, height - 40);
  //   ctx.fillStyle = '#ffffff';
  //   ctx.font = '16px sans-serif';
  //   ctx.fillText(`Canvas Size: ${Math.round(width)}x${Math.round(height)}`, 40, 50);
  // }, [width, height]); // Only re-draws when sizes actually change

  // 1. Click & Hold starts the tracking loop
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Wipe old spell line
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#6366f1'; // Spell trial path color

      const rect = canvas.getBoundingClientRect();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    setRawPoints([]);
    setIsDrawing(true);
  };

  // 2. Track points continuously as long as the mouse is down
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (ctx) {
      ctx.lineTo(clientX, clientY);
      ctx.stroke();
    }

    const next: Point = {
      x: e.clientX,
      y: e.clientY
    };

    setRawPoints(prev => [...prev, next]);
  };

  // 3. Releasing the click triggers your ONNX Matrix conversion instantly
  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (rawPoints.length === 0) return;

    /// - -  model.runInference - - - - -

    // Run RDP to strip out hand jitter and keep sharp geometric vertexes
    // Adjust epsilon (0.01 - 0.05 is standard for a 0.0 to 1.0 normalized canvas space)
    const epsilon = .005;

    const minXY = rawPoints.reduce((acc, item) => {
      if (acc.x > item.x) acc.x = item.x;
      if (acc.y > item.y) acc.y = item.y;
      return acc;
    }, { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER });

    const maxDistance = findMaxDistance(rawPoints);

    const simplifiedPoints = ramerDouglasPeucker(rawPoints.map(p => {
      const normalizedPoint: Point = {
        x: (p.x - minXY.x) / maxDistance,
        y: (p.y - minXY.y) / maxDistance
      }
      return normalizedPoint;
    }), epsilon);

    console.log(`RDP Compression: Reduced points from ${rawPoints.length} to ${simplifiedPoints.length}`);

    if (session) {
      const result = await runSpellInference(simplifiedPoints, session);
      console.log({ result, simplifiedPoints });
      setResult(result);
    } else console.log({ session });
    // - - - - -  - - - - 
  };


  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: 'absolute',
      zIndex: 30,
      display: 'flex',
      overflow: 'hidden',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <canvas
        ref={canvasRef}
        width={!!width ? width : 100}
        height={!!height ? height : 100}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Prevents sticking if cursor wanders out
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'crosshair',
          touchAction: 'none'
        }}
      />
    </div>
  );
}