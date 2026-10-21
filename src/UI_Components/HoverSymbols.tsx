// HoverSymbols.tsx
// The ruby buttons' hover effect: the clock's golden symbols (see ClockSymbolFunctions: diamond,
// circle with a dot, hourglass, rhombus, lopsided X, dot), as in an old book of hours.
// While hovered, symbols appear on the button's outline (partly behind it), each spot shifting
// through the symbols: a golden symbol is deciphered (flickering through a few glyphs before it
// settles), holds for a moment, then turns a red glow and blurs away as the next is deciphered in its
// place. Each spot shifts a few times, then its last symbol burns out; the whole spot falls all the
// while, its afterburns with it: a waterfall, thinning out sooner at its sides. Quick, like a half-read
// cipher. The spots keep to their own slices of the button's outline (so they're all round it, never
// bunched), and a slice that empties fills again right away.
import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

/** The look and timing (sizes in cqw, times in seconds). */
export const HOVER_SYMBOLS = {
  color: '#fff3a8', // the clock symbols' pale gold
  glow: '#ffcf5a',
  burnColor: '#ff6a55', // the red a symbol turns as it gives way to the next
  burnGlow: '#e0281e',
  firstSeconds: 0.2, // on hovering: one spot at once, then two more together this much later
  everySeconds: 0.5, // then, while hovered, a new spot this often (and right away when one burns out)
  maxSpots: 7, // at most this many at once: the ring around the button is cut into this many slices, one spot each
  size: [1.55, 2.35], // smallest, largest (cqw)
  opacity: [0.45, 0.6], // at their brightest (faint, so they don't compete with the button)
  // Quick cuts (like the Batman Beyond intro): symbols snap in, flicker as they're deciphered, hold
  // only a moment, and flash red as the next cuts in
  holdSeconds: [0.15, 0.3], // how long a golden symbol holds (once deciphered) before turning red
  shifts: [2, 4], // how many symbols a spot shows before it burns out
  decipherSeconds: 0.15, // a new symbol flickering through glyphs before it settles
  flickerSeconds: 0.04, // each glyph in that flicker
  appearSeconds: 0.04, // a new symbol cutting in
  redSeconds: 0.06, // a symbol flashing red
  // Then it blurs and fades: slowly near the button's middle, quicker out at its sides (by how far
  // out it is, left or right of the middle)
  burnSeconds: { middle: 1.4, sides: 0.8 },
  burnBlur: 0.4, // how blurred it is by the end
  // Each spot falls from the moment it appears, its symbols and their red afterburns together,
  // gathering speed: this far (cqw) per second of the spot's life
  fallPerSecond: 2.4,
  // A waterfall: each spot fades away as it falls, over this much of its life: all of it at the
  // button's middle, less out toward its ends (so the fall thins out sooner at its sides)
  fadeOver: { middle: 1, sides: 0.4 },
  // where they appear: on the button's outline (touching it, partly behind it), spread all the way
  // round it; out from the outline by up to `outward` (in the button's own units: it's 386 x 100)
  outward: 10,
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
  left: 0;
  top: 0;
  transform: translate(-50%, -50%) scale(1);
  color: ${props => props.$isBurning ? H.burnColor : H.color};
  filter: ${props => props.$isBurning ? glowOf(H.burnGlow, H.burnBlur) : glowOf(H.glow, 0)};
  opacity: ${props => props.$isBurning ? 0 : 'var(--peak)'};
  animation: ${appear} ${H.appearSeconds}s ease-out;
  transition: ${props => props.$isBurning
    ? `color ${H.redSeconds}s linear, filter var(--burn) ease-in, opacity var(--burn) ease-in`
    : 'none'};
`;

const fall = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(var(--fall)); }
`;
const fadeAway = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

/** A spot: where its symbols are, falling from the moment it appears (gathering speed). */
const Falling = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  animation: ${fall} var(--life) cubic-bezier(0.45, 0, 0.85, 0.55) forwards, ${fadeAway} var(--fade) ease-in forwards;
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

/** The button's outline (its frame, in its 386 x 100 units: see PlayButtonStyles), and its length. */
const OUTLINE = [[9, 50], [52, 9], [334, 9], [377, 50], [334, 91], [52, 91]];
const OUTLINE_LENGTH = OUTLINE.reduce((sum, p, k) => { const q = OUTLINE[(k + 1) % 6]; return sum + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
/** The point `along` (0 to 1) the outline, pushed out from it by `out` (units). */
const pointOnOutline = (along: number, out: number): [number, number] => {
  let distance = along * OUTLINE_LENGTH;
  for (let k = 0; k < 6; k++) {
    const p = OUTLINE[k], q = OUTLINE[(k + 1) % 6];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (distance <= length || k === 5) {
      const t = Math.min(1, distance / length);
      const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
      // out: away from the button's middle, square to this side
      let nx = (q[1] - p[1]) / length, ny = -(q[0] - p[0]) / length;
      if (nx * (x - 193) + ny * (y - 50) < 0) { nx = -nx; ny = -ny; }
      return [x + nx * out, y + ny * out];
    }
    distance -= length;
  }
  return [193, 50];
};

const between = ([low, high]: Array<number>) => low + Math.random() * (high - low);
const pick = <T,>(list: Array<T>, not?: T): T => {
  const choices = not === undefined ? list : list.filter(item => item !== not);
  return choices[Math.floor(Math.random() * choices.length)];
};

type SpotInfo = { id: number; slice: number; left: number; top: number; size: number; peak: number; shifts: number; burnSeconds: number; sideways: number; isLeaving?: boolean };
type Showing = { id: number; shape: Shape; isBurning: boolean };

/** One spot: shifting through symbols (each holding, then burning as the next appears), then burning out. */
const Spot = ({ spot, isHovered, onLeaving, onDone }: { spot: SpotInfo; isHovered: boolean; onLeaving: (id: number) => void; onDone: (id: number) => void }) => {
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
      const burning = new Set<number>();
      setShowing(current => { current.forEach(s => burning.add(s.id)); return current; });
      later(spot.burnSeconds + 0.05, () => setShowing(current => current.filter(s => !burning.has(s.id))));
      // ...and the next appears in its place (unless this spot is done, or the hover has ended)
      if (shiftsLeft.current <= 0 || !isHoveredRef.current) {
        onLeaving(spot.id); // (its slice is free for a new spot while this last one falls)
        later(spot.burnSeconds + 0.1, () => onDone(spot.id));
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

  // (its whole life, at the longest: every symbol held as long as they may be, then the last one burning out)
  const life = spot.shifts * (H.decipherSeconds + H.holdSeconds[1]) + spot.burnSeconds;
  return (
    <Falling style={{
      left: `${spot.left}%`, top: `${spot.top}%`, '--life': `${life}s`, '--fall': `${life * H.fallPerSecond}cqw`,
      '--fade': `${life * (H.fadeOver.middle + (H.fadeOver.sides - H.fadeOver.middle) * spot.sideways)}s`,
    } as React.CSSProperties}>
      {showing.map(s => (
        <SymbolAt key={s.id} viewBox="0 0 24 24" $isBurning={s.isBurning}
          style={{ width: `${spot.size}cqw`, height: `${spot.size}cqw`, '--peak': spot.peak, '--burn': `${spot.burnSeconds}s` } as React.CSSProperties}>
          <Deciphering shape={s.shape} />
        </SymbolAt>
      ))}
    </Falling>
  );
};

/** The symbols for a hovered button (place it inside the button, which should be position: relative). */
export default function HoverSymbols({ isHovered }: { isHovered: boolean; hoverKey?: number }) {
  const [spots, setSpots] = useState<Array<SpotInfo>>([]);
  const nextId = useRef(0);
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;
  // A new spot, in a free slice of the button's outline
  const add = () => setSpots(current => {
    const staying = current.filter(spot => !spot.isLeaving);
    if (staying.length >= H.maxSpots) return current;
    const free = Array.from({ length: H.maxSpots }, (_, k) => k).filter(k => !staying.some(spot => spot.slice === k));
    if (!free.length) return current;
    const slice = pick(free);
    // somewhere in its slice of the outline (not at the slice's very ends), touching the button
    const [x, y] = pointOnOutline((slice + 0.15 + Math.random() * 0.7) / H.maxSpots, Math.random() * H.outward);
    const left = (x / 386) * 100, top = y;
    // how far out to the side it is (0 at the middle, 1 at the button's ends)
    const sideways = Math.min(1, Math.abs(left - 50) / 50);
    return [...current, {
      id: nextId.current++, slice,
      left,
      burnSeconds: H.burnSeconds.middle + (H.burnSeconds.sides - H.burnSeconds.middle) * sideways,
      top, sideways,
      size: between(H.size), peak: between(H.opacity),
      // (fewer toward the sides, so those spots, fading sooner, make way for new ones sooner)
      shifts: Math.max(1, Math.round(between(H.shifts) * (1 - 0.5 * sideways))),
    }];
  });
  useEffect(() => {
    if (!isHovered) return;
    // one at once, then two together, then more as they're needed
    add();
    let interval = 0;
    const start = window.setTimeout(() => {
      add(); add();
      interval = window.setInterval(add, H.everySeconds * 1000);
    }, H.firstSeconds * 1000);
    return () => { window.clearTimeout(start); window.clearInterval(interval); };
  }, [isHovered]);
  // A spot's last symbol is falling: its slice fills again right away (while hovered)
  const onLeaving = (id: number) => {
    setSpots(current => current.map(spot => spot.id === id ? { ...spot, isLeaving: true } : spot));
    if (isHoveredRef.current) window.setTimeout(() => { if (isHoveredRef.current) add(); }, 60);
  };
  const onDone = (id: number) => setSpots(current => current.filter(spot => spot.id !== id));

  return (
    <Layer aria-hidden>
      {spots.map(spot => <Spot key={spot.id} spot={spot} isHovered={isHovered} onLeaving={onLeaving} onDone={onDone} />)}
    </Layer>
  );
}
