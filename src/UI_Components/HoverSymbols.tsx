// HoverSymbols.tsx
// The ruby buttons' hover effect: the clock's golden symbols (see ClockSymbolFunctions: diamond,
// circle with a dot, hourglass, rhombus, lopsided X, dot), as in an old book of hours.
// While hovered, symbols appear here and there around (and behind) the button, each spot shifting
// through the symbols: a golden symbol is deciphered (flickering through a few glyphs before it
// settles), holds for a moment, then turns a red glow and blurs away as the next is deciphered in its
// place. Each spot shifts a few times, then its last symbol burns out. Quick, like a half-read cipher.
import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

/** The look and timing (sizes in cqw, times in seconds). */
export const HOVER_SYMBOLS = {
  color: '#fff3a8', // the clock symbols' pale gold
  glow: '#ffcf5a',
  burnColor: '#ff6a55', // the red a symbol turns as it gives way to the next
  burnGlow: '#e0281e',
  everySeconds: 1.1, // a new spot this often while hovered
  maxSpots: 5, // at most this many at once
  size: [2.4, 3.6], // smallest, largest
  opacity: [0.6, 0.9], // at their brightest
  holdSeconds: [0.4, 0.7], // how long a golden symbol holds (once deciphered) before turning red
  shifts: [3, 5], // how many symbols a spot shows before it burns out
  decipherSeconds: 0.25, // a new symbol flickering through glyphs before it settles
  flickerSeconds: 0.05, // each glyph in that flicker
  appearSeconds: 0.15, // a new symbol fading in
  burnSeconds: 0.6, // a red symbol blurring away
  burnBlur: 0.4, // how blurred it is by then
  // where they appear: around the button, this far out from its middle (fractions of its width and
  // height from the middle to the edge: 1 is the edge)
  reach: { x: [1, 1.3], y: [1.4, 2.4] },
};

type Shape = 'diamond' | 'circleDot' | 'hourglass' | 'rhombus' | 'lopsidedX' | 'dot';
const SHAPES: Array<Shape> = ['diamond', 'circleDot', 'hourglass', 'rhombus', 'lopsidedX', 'dot'];

/** One symbol, drawn in a 24 x 24 box (its middle at 12, 12), in the current color. */
const Glyph = ({ shape }: { shape: Shape }) => {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (shape) {
    case 'diamond': return <path d="M12 3 L19 12 L12 21 L5 12 Z" {...stroke} />;
    case 'circleDot': return <><circle cx={12} cy={12} r={7.5} {...stroke} /><circle cx={12} cy={12} r={1.6} fill="currentColor" /></>;
    case 'hourglass': return <path d="M5 4 L19 4 L10 12 L19 20 L5 20 L14 12 Z" {...stroke} />;
    case 'rhombus': return <path d="M12 6.5 L22 12 L12 17.5 L2 12 Z" {...stroke} />;
    case 'lopsidedX': return <path d="M4 7 L18 20 M17 4 L5 18" {...stroke} />;
    case 'dot': return <circle cx={12} cy={12} r={4} fill="currentColor" />;
  }
};

const H = HOVER_SYMBOLS;
const glowOf = (glow: string, blur: number) => `drop-shadow(0 0 0.25cqw ${glow}) drop-shadow(0 0 0.6cqw ${glow}) blur(${blur}cqw)`;

const appear = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  to { opacity: var(--peak); transform: translate(-50%, -50%) scale(1); }
`;

const Layer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: -2; /* behind the button's face (any that stray near it are hidden by it) */
`;

/** A symbol at its spot: golden (fading in), or burning (red, blurring away). */
const SymbolAt = styled.svg<{ $isBurning: boolean }>`
  position: absolute;
  overflow: visible;
  transform: translate(-50%, -50%) scale(1);
  color: ${props => props.$isBurning ? H.burnColor : H.color};
  filter: ${props => props.$isBurning ? glowOf(H.burnGlow, H.burnBlur) : glowOf(H.glow, 0)};
  opacity: ${props => props.$isBurning ? 0 : 'var(--peak)'};
  animation: ${appear} ${H.appearSeconds}s ease-out;
  transition: ${props => props.$isBurning
    ? `color ${H.burnSeconds * 0.3}s ease-out, filter ${H.burnSeconds}s ease-in, opacity ${H.burnSeconds}s ease-in`
    : 'none'};
`;

/** A symbol being deciphered: flickering through other glyphs, then settling on `shape`. */
const Deciphering = ({ shape }: { shape: Shape }) => {
  const [showing, setShowing] = useState<Shape>(() => pick(SHAPES, shape));
  useEffect(() => {
    let flicker = 0;
    const flickers = Math.max(1, Math.round(H.decipherSeconds / H.flickerSeconds));
    const interval = window.setInterval(() => {
      flicker++;
      if (flicker >= flickers) { setShowing(shape); window.clearInterval(interval); return; }
      setShowing(current => pick(SHAPES, current));
    }, H.flickerSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [shape]);
  return <Glyph shape={showing} />;
};

const between = ([low, high]: Array<number>) => low + Math.random() * (high - low);
const pick = <T,>(list: Array<T>, not?: T): T => {
  const choices = not === undefined ? list : list.filter(item => item !== not);
  return choices[Math.floor(Math.random() * choices.length)];
};

type SpotInfo = { id: number; left: number; top: number; size: number; peak: number; shifts: number };
type Showing = { id: number; shape: Shape; isBurning: boolean };

/** One spot: shifting through symbols (each holding, then burning as the next appears), then burning out. */
const Spot = ({ spot, isHovered, onDone }: { spot: SpotInfo; isHovered: boolean; onDone: (id: number) => void }) => {
  const [showing, setShowing] = useState<Array<Showing>>(() => [{ id: 0, shape: pick(SHAPES), isBurning: false }]);
  const nextId = useRef(1);
  const shiftsLeft = useRef(spot.shifts - 1);
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;

  useEffect(() => {
    const timeouts: Array<number> = [];
    const later = (seconds: number, run: () => void) => timeouts.push(window.setTimeout(run, seconds * 1000));
    const step = () => {
      // The golden symbol turns red and blurs away...
      setShowing(current => current.map(s => s.isBurning ? s : { ...s, isBurning: true }));
      later(H.burnSeconds + 0.05, () => setShowing(current => current.filter(s => !s.isBurning)));
      // ...and the next appears in its place (unless this spot is done, or the hover has ended)
      if (shiftsLeft.current <= 0 || !isHoveredRef.current) {
        later(H.burnSeconds + 0.1, () => onDone(spot.id));
        return;
      }
      shiftsLeft.current--;
      setShowing(current => {
        const last = current[current.length - 1];
        return [...current, { id: nextId.current++, shape: pick(SHAPES, last?.shape), isBurning: false }];
      });
      later(H.decipherSeconds + between(H.holdSeconds), step);
    };
    later(H.decipherSeconds + between(H.holdSeconds), step);
    return () => timeouts.forEach(window.clearTimeout);
  }, []);

  return (
    <>
      {showing.map(s => (
        <SymbolAt key={s.id} viewBox="0 0 24 24" $isBurning={s.isBurning}
          style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.size}cqw`, height: `${spot.size}cqw`, '--peak': spot.peak } as React.CSSProperties}>
          <Deciphering shape={s.shape} />
        </SymbolAt>
      ))}
    </>
  );
};

/** The symbols for a hovered button (place it inside the button, which should be position: relative). */
export default function HoverSymbols({ isHovered }: { isHovered: boolean; hoverKey?: number }) {
  const [spots, setSpots] = useState<Array<SpotInfo>>([]);
  const nextId = useRef(0);
  useEffect(() => {
    if (!isHovered) return;
    const add = () => setSpots(current => {
      if (current.length >= H.maxSpots) return current;
      const angle = Math.random() * Math.PI * 2;
      return [...current, {
        id: nextId.current++,
        left: 50 + Math.cos(angle) * 50 * between(H.reach.x),
        top: 50 + Math.sin(angle) * 50 * between(H.reach.y),
        size: between(H.size), peak: between(H.opacity),
        shifts: Math.round(between(H.shifts)),
      }];
    });
    add();
    const interval = window.setInterval(add, H.everySeconds * 1000);
    return () => window.clearInterval(interval);
  }, [isHovered]);
  const onDone = (id: number) => setSpots(current => current.filter(spot => spot.id !== id));

  return (
    <Layer aria-hidden>
      {spots.map(spot => <Spot key={spot.id} spot={spot} isHovered={isHovered} onDone={onDone} />)}
    </Layer>
  );
}
