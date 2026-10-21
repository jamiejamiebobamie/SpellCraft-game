// HoverSymbols.tsx
// The ruby buttons' hover effect: the clock's golden symbols (see ClockSymbolFunctions: diamond,
// circle with a dot, hourglass, rhombus, lopsided X, dot), as in an old book of hours.
//   rising:  on hovering, a few float up from the button, drifting, turning and fading
//   ghosts:  while hovered, larger, fainter apparitions fade in and out around the button
import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

/** The look and timing (sizes in cqw). */
export const HOVER_SYMBOLS = {
  color: '#fff3a8', // the clock symbols' pale gold
  glow: '#ffcf5a',
  rising: { count: 6, size: 1.3, rise: 15, drift: 6, seconds: 2.2 },
  ghosts: {
    everySeconds: 0.35, // a new one this often while hovered
    size: [1.6, 2.8], // smallest, largest
    opacity: [0.25, 0.55], // at their brightest
    seconds: [1.6, 2.6], // fading in and out
    // where they appear: around the button, this far out from its middle (fractions of its width and
    // height from the middle to the edge: 1 is the edge)
    reach: { x: [0.85, 1.25], y: [1.1, 2.2] },
  },
};

type Shape = 'diamond' | 'circleDot' | 'hourglass' | 'rhombus' | 'lopsidedX' | 'dot';
const SHAPES: Array<Shape> = ['diamond', 'circleDot', 'hourglass', 'rhombus', 'lopsidedX', 'dot'];

/** One symbol, drawn in a 24 x 24 box (its middle at 12, 12). */
const Glyph = ({ shape }: { shape: Shape }) => {
  const stroke = { fill: 'none', stroke: HOVER_SYMBOLS.color, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (shape) {
    case 'diamond': return <path d="M12 3 L19 12 L12 21 L5 12 Z" {...stroke} />;
    case 'circleDot': return <><circle cx={12} cy={12} r={7.5} {...stroke} /><circle cx={12} cy={12} r={1.6} fill={HOVER_SYMBOLS.color} /></>;
    case 'hourglass': return <path d="M5 4 L19 4 L10 12 L19 20 L5 20 L14 12 Z" {...stroke} />;
    case 'rhombus': return <path d="M12 6.5 L22 12 L12 17.5 L2 12 Z" {...stroke} />;
    case 'lopsidedX': return <path d="M4 7 L18 20 M17 4 L5 18" {...stroke} />;
    case 'dot': return <circle cx={12} cy={12} r={4} fill={HOVER_SYMBOLS.color} />;
  }
};

const rise = keyframes`
  0% { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(var(--drift), calc(-1 * var(--rise))) rotate(var(--turn)) scale(1.1); opacity: 0; }
`;

const apparition = keyframes`
  0% { transform: translate(-50%, -50%) rotate(var(--turn0)) scale(0.8); opacity: 0; }
  45% { opacity: var(--peak); }
  100% { transform: translate(-50%, -50%) rotate(var(--turn1)) scale(1.1); opacity: 0; }
`;

const Layer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
`;

const Symbol = styled.svg`
  position: absolute;
  overflow: visible;
  filter: drop-shadow(0 0 0.25cqw ${HOVER_SYMBOLS.glow}) drop-shadow(0 0 0.6cqw ${HOVER_SYMBOLS.glow});
`;

const Rising = styled(Symbol)`
  bottom: 30%;
  animation: ${rise} var(--seconds) cubic-bezier(0.25, 1, 0.5, 1) forwards;
`;

const Ghost = styled(Symbol)`
  opacity: 0;
  animation: ${apparition} var(--seconds) ease-in-out forwards;
`;

const between = ([low, high]: Array<number>) => low + Math.random() * (high - low);
const pick = <T,>(list: Array<T>): T => list[Math.floor(Math.random() * list.length)];

type GhostSymbol = { id: number; shape: Shape; left: number; top: number; size: number; peak: number; seconds: number; turn: number };

/**
 * The symbols for a hovered button (place it inside the button, which should be position: relative).
 * `hoverKey`: changes on each new hover (sending up a fresh burst).
 */
export default function HoverSymbols({ isHovered, hoverKey }: { isHovered: boolean; hoverKey: number }) {
  // The rising burst, made anew each hover
  const [burst, setBurst] = useState<Array<{ shape: Shape; left: number; drift: number; turn: number; delay: number }>>([]);
  useEffect(() => {
    if (!isHovered) return;
    const { count, drift } = HOVER_SYMBOLS.rising;
    setBurst(Array.from({ length: count }, (_, k) => ({
      shape: pick(SHAPES),
      left: 12 + (76 * (k + Math.random() * 0.6)) / count, // spread along the button
      drift: (Math.random() - 0.5) * 2 * drift,
      turn: (Math.random() - 0.5) * 160,
      delay: Math.random() * 0.25,
    })));
  }, [hoverKey]);

  // The apparitions, appearing one after another while hovered (each fading away on its own)
  const [ghosts, setGhosts] = useState<Array<GhostSymbol>>([]);
  const nextId = useRef(0);
  useEffect(() => {
    if (!isHovered) return;
    const { everySeconds, size, opacity, seconds, reach } = HOVER_SYMBOLS.ghosts;
    const timeouts: Array<number> = [];
    const spawn = () => {
      const angle = Math.random() * Math.PI * 2;
      const ghost: GhostSymbol = {
        id: nextId.current++,
        shape: pick(SHAPES),
        left: 50 + Math.cos(angle) * 50 * between(reach.x),
        top: 50 + Math.sin(angle) * 50 * between(reach.y),
        size: between(size), peak: between(opacity), seconds: between(seconds),
        turn: (Math.random() - 0.5) * 50,
      };
      setGhosts(list => [...list, ghost]);
      timeouts.push(window.setTimeout(() => setGhosts(list => list.filter(g => g.id !== ghost.id)), ghost.seconds * 1000 + 100));
    };
    spawn();
    const interval = window.setInterval(spawn, everySeconds * 1000);
    return () => { window.clearInterval(interval); };
  }, [isHovered]);

  return (
    <Layer aria-hidden>
      {isHovered && burst.map((symbol, k) => (
        <Rising key={`${hoverKey}-${k}`} viewBox="0 0 24 24"
          style={{
            left: `${symbol.left}%`, width: `${HOVER_SYMBOLS.rising.size}cqw`, height: `${HOVER_SYMBOLS.rising.size}cqw`,
            animationDelay: `${symbol.delay}s`, opacity: 0,
            '--drift': `${symbol.drift}cqw`, '--rise': `${HOVER_SYMBOLS.rising.rise}cqw`, '--turn': `${symbol.turn}deg`, '--seconds': `${HOVER_SYMBOLS.rising.seconds}s`,
          } as React.CSSProperties}>
          <Glyph shape={symbol.shape} />
        </Rising>
      ))}
      {ghosts.map(ghost => (
        <Ghost key={ghost.id} viewBox="0 0 24 24"
          style={{
            left: `${ghost.left}%`, top: `${ghost.top}%`, width: `${ghost.size}cqw`, height: `${ghost.size}cqw`,
            '--peak': ghost.peak, '--seconds': `${ghost.seconds}s`, '--turn0': `${-ghost.turn / 2}deg`, '--turn1': `${ghost.turn / 2}deg`,
          } as React.CSSProperties}>
          <Glyph shape={ghost.shape} />
        </Ghost>
      ))}
    </Layer>
  );
}
