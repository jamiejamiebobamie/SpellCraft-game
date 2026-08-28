import React, { useRef, useEffect, useState } from 'react';
import { SpellCanvasController } from '../DataClasses/SpellCanvas/SpellCanvasController';
import { Model } from '../DataClasses/NN_Model/Model';

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

export default function SpellCanvasComponent(spellCanvasController: SpellCanvasController, model: Model) {
  const { canvasRef, width, height } = useCanvasSize();

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

    spellCanvasController.clearDrawing();
    spellCanvasController.setIsDrawing(true);
  };

  // 2. Track points continuously as long as the mouse is down
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!spellCanvasController.getIsDrawing()) return;
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

    spellCanvasController.addRawPoint(e.clientX, e.clientY);
  };

  // 3. Releasing the click triggers your ONNX Matrix conversion instantly
  const handleMouseUp = async () => {
    if (!spellCanvasController.getIsDrawing()) return;
    spellCanvasController.setIsDrawing(false);
    if (spellCanvasController.getNumPoints() == 0) return;

    const rawPoints = spellCanvasController.getRawPoints();
    model.runInference(rawPoints);
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