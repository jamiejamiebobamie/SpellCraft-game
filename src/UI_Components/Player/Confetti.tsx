// Confetti.tsx
// A burst of confetti around a wizard still standing when the game over card comes in (PlayerComponent): little
// paper pieces thrown up and out from them, tumbling as they flutter down and fade.
import { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';

/**
 * The confetti: how many pieces (count), their colors, size (cqw: width and height; tiny). It bursts once, at
 * startSeconds after the wizard's rival falls (with the game over card's title still coming in). Each piece
 * starts somewhere around the wizard's head, hat and shoulders (where: that area's middle in the wizard's box,
 * %, and its size, cqw), is thrown up and out (spread: across, either way, rise: up, cqw, ranges), slows to its
 * height (peakShare of its flight), then falls, gathering speed to a steady drift down, spinning (spinTurns),
 * fading out toward its end. Each lasts its own time (seconds: a range), falling further the longer it lasts: the
 * longest reaching the foot of the robe (fallToRobeHem: cqw below where they start).
 */
export const CONFETTI = {
  isOn: true, count: 60, colors: ['#ff5fa2', '#3d8bff', '#ff3b3b', '#ffd23f', '#3ddc6b', '#ff9a3c', '#a66bff'], // (pink, blue, red, yellow, green, orange, purple)
  size: [0.18, 0.32], startSeconds: 2, seconds: [1.6, 3.6], spread: [1, 7], rise: [2.5, 6.5], peakShare: 0.22,
  fallToRobeHem: 19, spinTurns: [1, 3], where: { x: 50, y: 30, width: 9, height: 6 },
};

const between = (range: Array<number>) => range[0] + Math.random() * (range[1] - range[0]);

// (one piece's flight, in its own custom properties: up and out, slowing to its height; then down, gathering speed to a
// steady fall; spinning; fading out over the second half of its time)
const peak = CONFETTI.peakShare * 100;
const fly = keyframes`
  0% { transform: translate(0, 0) rotate(0turn); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.75, 0.4, 1); }
  4% { opacity: 1; }
  ${peak}% { transform: translate(var(--x), calc(var(--rise) * -1)) rotate(calc(var(--spin) * 0.2)); animation-timing-function: cubic-bezier(0.45, 0, 1, 1); }
  ${peak + 14}% { transform: translate(calc(var(--x) * 1.1), calc(var(--rise) * -1 + var(--fall) * 0.08)) rotate(calc(var(--spin) * 0.35)); animation-timing-function: linear; }
  72% { opacity: 1; }
  100% { transform: translate(calc(var(--x) * 1.3), var(--fall)) rotate(var(--spin)); opacity: 0; }
`;

const Burst = styled.div`
  position: absolute;
  left: ${CONFETTI.where.x}%;
  top: ${CONFETTI.where.y}%;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 5;
`;

const Piece = styled.span`
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  border-radius: 0.06cqw;
  will-change: transform, opacity;
  animation-name: ${fly};
  animation-fill-mode: both;
  animation-iteration-count: 1;
`;

/** Confetti bursting around a wizard (CONFETTI), from when it's shown. */
export default function Confetti({ delaySeconds }: { delaySeconds: number }) {
  const pieces = useMemo(() => Array.from({ length: CONFETTI.count }, () => {
    const side = Math.random() < 0.5 ? -1 : 1, seconds = between(CONFETTI.seconds);
    return {
      color: CONFETTI.colors[Math.floor(Math.random() * CONFETTI.colors.length)],
      w: between(CONFETTI.size), h: between(CONFETTI.size) * 0.55,
      // (its start: somewhere around the head, hat and shoulders)
      startX: (Math.random() - 0.5) * CONFETTI.where.width, startY: (Math.random() - 0.5) * CONFETTI.where.height,
      // (the longer it lasts, the further it falls: the longest to the robe's hem)
      fall: CONFETTI.fallToRobeHem * seconds / CONFETTI.seconds[1],
      x: side * between(CONFETTI.spread), rise: between(CONFETTI.rise),
      spin: (Math.random() < 0.5 ? -1 : 1) * between(CONFETTI.spinTurns),
      seconds, delay: delaySeconds + Math.random() * 0.12,
    };
  }), [delaySeconds]);
  if (!CONFETTI.isOn) return null;
  return (
    <Burst aria-hidden>
      {pieces.map((p, k) => (
        <Piece key={k} style={{
          width: `${p.w}cqw`, height: `${p.h}cqw`, left: `${p.startX - p.w / 2}cqw`, top: `${p.startY - p.h / 2}cqw`, background: p.color,
          animationDuration: `${p.seconds}s`, animationDelay: `${p.delay}s`,
          ['--x' as string]: `${p.x}cqw`, ['--rise' as string]: `${p.rise}cqw`, ['--fall' as string]: `${p.fall}cqw`,
          ['--spin' as string]: `${p.spin}turn`,
        }} />
      ))}
    </Burst>
  );
}
