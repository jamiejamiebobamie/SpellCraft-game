// PixieDust.tsx
// The landing page dissolving into pixie dust as Play is pressed: a burst of tiny glowing motes and
// four-point twinkles (the wand's sparkle colors) rising and drifting off from where the content was,
// while the content itself fades and blurs away (LoaderComponent).
import React, { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';

/** The burst (sizes in cqw, times in seconds). */
export const PIXIE_DUST = {
  count: 150,
  colors: ['#FFF7C2', '#FFE53B', '#FFFFFF', '#A6FFEA', '#FFBBE1'], // the wand's sparkles (pixieColors)
  size: [0.2, 0.6],
  starShare: 0.3, // how many are four-point twinkles rather than round motes
  rise: [3, 9], // how far up they float
  drift: 4, // how far they may wander sideways (either way)
  delay: [0, 0.35], // each starting a little after the last
  seconds: [0.7, 1.05], // each one's life
  // where they start: over the content, as fractions of its box (the logo above, the button below)
  area: { x: [0.12, 0.88], y: [0.05, 0.95] },
};
/** How long the whole dissolve takes, before the game begins. */
export const PIXIE_DUST_SECONDS = PIXIE_DUST.delay[1] + PIXIE_DUST.seconds[1] + 0.05;

const float = keyframes`
  0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
  18% { opacity: 1; }
  60% { opacity: 0.85; }
  100% { transform: translate(var(--drift), calc(-1 * var(--rise))) scale(1) rotate(var(--turn)); opacity: 0; }
`;

const Layer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
`;

const Mote = styled.div<{ $isStar: boolean }>`
  position: absolute;
  border-radius: ${props => props.$isStar ? 0 : '50%'};
  ${props => props.$isStar && 'clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);'}
  opacity: 0;
  animation: ${float} var(--seconds) cubic-bezier(0.2, 0.6, 0.4, 1) var(--delay) forwards;
`;

const between = ([low, high]: Array<number>) => low + Math.random() * (high - low);

/** The burst, over its parent (position: relative), while `isActive`. */
export default function PixieDust({ isActive }: { isActive: boolean }) {
  const motes = useMemo(() => Array.from({ length: PIXIE_DUST.count }, () => {
    const isStar = Math.random() < PIXIE_DUST.starShare;
    const size = between(PIXIE_DUST.size) * (isStar ? 2.2 : 1);
    const color = PIXIE_DUST.colors[Math.floor(Math.random() * PIXIE_DUST.colors.length)];
    return {
      isStar, size, color,
      left: between(PIXIE_DUST.area.x) * 100, top: between(PIXIE_DUST.area.y) * 100,
      rise: between(PIXIE_DUST.rise), drift: (Math.random() - 0.5) * 2 * PIXIE_DUST.drift,
      turn: (Math.random() - 0.5) * 180, delay: between(PIXIE_DUST.delay), seconds: between(PIXIE_DUST.seconds),
    };
  }), [isActive]);
  if (!isActive) return null;
  return (
    <Layer aria-hidden>
      {motes.map((m, k) => (
        <Mote key={k} $isStar={m.isStar} style={{
          left: `${m.left}%`, top: `${m.top}%`, width: `${m.size}cqw`, height: `${m.size}cqw`,
          background: m.color, boxShadow: `0 0 ${m.size * 1.5}cqw ${m.color}`,
          '--rise': `${m.rise}cqw`, '--drift': `${m.drift}cqw`, '--turn': `${m.turn}deg`,
          '--delay': `${m.delay}s`, '--seconds': `${m.seconds}s`,
        } as React.CSSProperties} />
      ))}
    </Layer>
  );
}
