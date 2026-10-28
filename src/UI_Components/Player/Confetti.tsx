// Confetti.tsx
// A burst of confetti around a wizard still standing when their rival falls (PlayerComponent): little paper
// pieces thrown up and out from around their head, falling to the floor about them, and lying there.
import { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';

/**
 * The confetti: how many pieces (count), their colors, size (cqw: width and height; tiny). It bursts once, at
 * startSeconds after the wizard's rival falls (with the game over card's title still coming in). Each piece
 * starts somewhere around the wizard's head, hat and shoulders (where: that area's middle in the wizard's box,
 * x %, y cqw, and its size, cqw), is thrown up and out (spread: across, either way, rise: up, cqw, ranges), slows
 * to its height (peakShare of its flight), then falls, gathering speed to a steady drift, spinning (spinTurns),
 * and lands on the floor about them (seconds: how long its flight takes, a range), where it stays.
 * The floor (floor): its middle level with the wizard's floor shadow (y, cqw down the wizard's box), seen from
 * a little above, as that shadow shows (squash: how flat a circle on it looks, 2 / 10); each piece lands some way
 * in front of the wizard or behind (depth: cqw, along the floor, behind negative), so lower or higher, a little
 * smaller the further back (shrinkPerCqw), lying flat; hidden by the robe if behind the wizard or within its
 * footprint on the floor (robeRadius, cqw: the hem's round, about their middle), so none shows on the robe. Those
 * in front land below the hem's bottom edge (hemY, cqw down the wizard's box), nearer us further down.
 */
export const CONFETTI = {
  isOn: true, count: 60, colors: ['#ff5fa2', '#3d8bff', '#ff3b3b', '#ffd23f', '#3ddc6b', '#ff9a3c', '#a66bff'], // (pink, blue, red, yellow, green, orange, purple)
  size: [0.18, 0.32], startSeconds: 2, seconds: [1.8, 3.4], spread: [1, 7], rise: [2.5, 6.5], peakShare: 0.22,
  spinTurns: [1, 3], where: { x: 50, y: 5.6, width: 9, height: 6 },
  floor: { y: 22.5, hemY: 23.4, squash: 0.2, depth: [-7, 5], shrinkPerCqw: 0.025, robeRadius: 4.8 },
};

const between = (range: Array<number>) => range[0] + Math.random() * (range[1] - range[0]);

// (one piece's flight, in its own custom properties: up and out, slowing to its height; then down, gathering speed
// to a steady fall, spinning; then landing, settling flat onto the floor, and staying)
const peak = CONFETTI.peakShare * 100;
const fly = keyframes`
  0% { transform: translate(0, 0) scale(1, 1) rotate(0turn); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.75, 0.4, 1); }
  4% { opacity: 1; }
  ${peak}% { transform: translate(var(--x), calc(var(--rise) * -1)) scale(1, 1) rotate(calc(var(--spin) * 0.2)); animation-timing-function: cubic-bezier(0.45, 0, 1, 1); }
  ${peak + 14}% { transform: translate(calc(var(--x) * 1.1), calc(var(--rise) * -1 + var(--fall) * 0.08)) scale(1, 1) rotate(calc(var(--spin) * 0.35)); animation-timing-function: linear; }
  92% { transform: translate(calc(var(--x) * 1.28), calc(var(--fall) - 0.3cqw)) scale(1, 1) rotate(calc(var(--spin) * 0.92)); opacity: 1; animation-timing-function: ease-out; }
  100% { transform: translate(calc(var(--x) * 1.3), var(--fall)) scale(var(--far), calc(var(--far) * ${CONFETTI.floor.squash})) rotate(var(--spin)); opacity: 1; }
`;

// (two layers: the pieces landing behind the wizard beneath them, the rest in front)
const Burst = styled.div<{ $isBehind: boolean }>`
  position: absolute;
  left: ${CONFETTI.where.x}%;
  top: ${CONFETTI.where.y}cqw;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: ${props => props.$isBehind ? 0 : 5};
`;

const Piece = styled.span`
  position: absolute;
  opacity: 0;
  border-radius: 0.06cqw;
  will-change: transform, opacity;
  animation-name: ${fly};
  animation-fill-mode: both;
  animation-iteration-count: 1;
`;

type ConfettiPiece = { color: string; w: number; h: number; startX: number; startY: number; x: number; rise: number; fall: number; far: number; spin: number; seconds: number; delay: number; isBehind: boolean };

/** Confetti bursting around a wizard and landing on the floor about them (CONFETTI), from when it's shown. */
export default function Confetti({ delaySeconds }: { delaySeconds: number }) {
  const pieces = useMemo(() => Array.from({ length: CONFETTI.count }, (): ConfettiPiece => {
    const side = Math.random() < 0.5 ? -1 : 1, x = side * between(CONFETTI.spread);
    const startX = (Math.random() - 0.5) * CONFETTI.where.width, startY = (Math.random() - 0.5) * CONFETTI.where.height;
    // (where it lands: some way in front or behind, on the floor, seen from a little above)
    const depth = between(CONFETTI.floor.depth);
    // (behind: further up the further back; in front: below the hem, further down the nearer us)
    const landY = (depth < 0 ? CONFETTI.floor.y + depth * CONFETTI.floor.squash : CONFETTI.floor.hemY + depth * CONFETTI.floor.squash) - CONFETTI.where.y;
    return {
      color: CONFETTI.colors[Math.floor(Math.random() * CONFETTI.colors.length)],
      w: between(CONFETTI.size), h: between(CONFETTI.size) * 0.55, startX, startY,
      x, rise: between(CONFETTI.rise), fall: landY - startY,
      far: 1 + Math.min(0, depth) * CONFETTI.floor.shrinkPerCqw,
      spin: (Math.random() < 0.5 ? -1 : 1) * between(CONFETTI.spinTurns),
      seconds: between(CONFETTI.seconds), delay: delaySeconds + Math.random() * 0.12,
      // (behind the wizard, or under the robe's hem: hidden by the robe)
      isBehind: depth < 0 || Math.hypot(startX + x * 1.3, depth) < CONFETTI.floor.robeRadius,
    };
  }), [delaySeconds]);
  if (!CONFETTI.isOn) return null;
  const layer = (isBehind: boolean) => (
    <Burst $isBehind={isBehind} aria-hidden>
      {pieces.filter(p => p.isBehind === isBehind).map((p, k) => (
        <Piece key={k} style={{
          width: `${p.w}cqw`, height: `${p.h}cqw`, left: `${p.startX - p.w / 2}cqw`, top: `${p.startY - p.h / 2}cqw`, background: p.color,
          animationDuration: `${p.seconds}s`, animationDelay: `${p.delay}s`,
          ['--x' as string]: `${p.x}cqw`, ['--rise' as string]: `${p.rise}cqw`, ['--fall' as string]: `${p.fall}cqw`,
          ['--spin' as string]: `${p.spin}turn`, ['--far' as string]: `${p.far}`,
        }} />
      ))}
    </Burst>
  );
  return <>{layer(true)}{layer(false)}</>;
}
