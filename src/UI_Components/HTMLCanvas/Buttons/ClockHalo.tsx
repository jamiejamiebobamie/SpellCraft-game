// ClockHalo.tsx
// A sunburst "glory" behind the clock's face: rays radiating outward that lighten whatever they pass
// over (the clock's body, the wall), slowly turning and pulsing. In front of the clock's body, behind
// its face (ClockFaceComponent).
import { useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../../Player/CharacterParts';

type RayStyle = 'straight' | 'wavy';
type Ray = { length: number; width: number; style: RayStyle; waves: number; wave: number };

export const CLOCK_HALO = {
  enabled: true,
  center: { x: 50, y: 9.8 }, // the clock face's center (cqw: MenuAnchor 45, 4.8 + padding 0.5 + half of 9)
  radius: 11, // how far the long rays reach (cqw; the face's radius is about 4.3)
  rays: 12, // long rays (lined up with the hour marks), with as many short ones between them
  // Each ray type: length (fraction of the radius), width (at its base, fraction of the radius), and
  // style: 'straight' (a spike) or 'wavy' (a flame-like ray snaking outward, as on a monstrance), with
  // waves (how many curves) and wave (how far it swings side to side, fraction of the radius)
  longRay: { length: .8, width: 0.11, style: 'straight' as RayStyle, waves: 2, wave: 0.04 },
  shortRay: { length: 0.8, width: 0.12, style: 'wavy' as RayStyle, waves: 1.5, wave: 0.035 },
  rayStart: 0.36, // where the rays start (fraction of the radius: just inside the face's rim)
  color: '255, 232, 170', // rgb
  rayOpacity: 0.55, // at the rays' base, fading to nothing at their tips
  glowOpacity: 0.35, // a soft glow right around the face (lifts the dark carving there)
  rotationSeconds: 90, // one full turn (0: still)
  pulseSeconds: 6, // a slow brighten and dim (0: none)
  pulseLow: 0.7, // the dimmest point of the pulse (1: no pulse)
  // Showing and hiding (shown on the loading screen, and in play while the clock can end the turn):
  // storybook-style, it grows from nothing past full size and settles, twisting into place; it hides
  // by drawing back a little, then shrinking away
  appear: {
    growSeconds: 0.9,
    shrinkSeconds: 0.6,
    twist: 40, // degrees it turns while growing (and back while shrinking)
    overshoot: 1.56, // how far past full size it springs (1: none; 1.56 is a lively storybook bounce)
  },
  // Breathing: each ray grows and shrinks (long and short rays out of step), the timing rippling
  // around the circle so it shimmers rather than pumping all at once
  breathe: {
    seconds: 4, // one grow-and-shrink (0: off)
    amount: 0.12, // how much shorter a ray gets at its smallest (fraction of its length)
    ripple: 1, // how many times the timing goes around the circle per cycle (0: all rays together)
  },
  sceneBrightness: 2.5, // in play, follows the scene: brightness(scene brightness x this), dim until the lights come up (before Play: LOGO_CONFIG.landingClock)
};

const turn = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const breathe = keyframes`
  0%, 100% { transform: rotate(var(--ray-angle)) scale(1); }
  50% { transform: rotate(var(--ray-angle)) scale(${1 - CLOCK_HALO.breathe.amount}); }
`;

/** A ray, turned to its angle and breathing (in step with `phase`, 0 to 1 of a cycle). */
const BreathingRay = styled.polygon<{ $angle: number; $phase: number }>`
  transform-box: view-box;
  transform-origin: 0 0;
  transform: rotate(${props => props.$angle}deg);
  --ray-angle: ${props => props.$angle}deg;
  ${props => CLOCK_HALO.breathe.seconds > 0 && css`
    animation: ${breathe} ${CLOCK_HALO.breathe.seconds}s ease-in-out infinite;
    animation-delay: ${-props.$phase * CLOCK_HALO.breathe.seconds}s;
  `}
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: ${CLOCK_HALO.pulseLow}; }
`;

const HaloWrapper = styled.div<{ $brightness: number }>`
  position: absolute;
  left: ${CLOCK_HALO.center.x - CLOCK_HALO.radius}cqw;
  top: ${CLOCK_HALO.center.y - CLOCK_HALO.radius}cqw;
  width: ${CLOCK_HALO.radius * 2}cqw;
  height: ${CLOCK_HALO.radius * 2}cqw;
  z-index: 1; /* in front of the clock's body (z-index 0), behind its face (31) */
  pointer-events: none;
  mix-blend-mode: screen; /* lightens what's beneath instead of covering it */
  filter: brightness(${props => props.$brightness});
  transition: filter ${INTRO_WALK_ANIM_TIME / 2}s;
  ${CLOCK_HALO.pulseSeconds > 0 && css`animation: ${pulse} ${CLOCK_HALO.pulseSeconds}s ease-in-out infinite;`}
`;

/** Grows the halo in and shrinks it away (CLOCK_HALO.appear). */
const Appear = styled.div<{ $isShown: boolean }>`
  width: 100%;
  height: 100%;
  transform: ${props => props.$isShown ? 'scale(1) rotate(0deg)' : `scale(0) rotate(${-CLOCK_HALO.appear.twist}deg)`};
  opacity: ${props => props.$isShown ? 1 : 0};
  /* growing: springs past full size and settles; shrinking: draws back a little, then away */
  transition: ${props => props.$isShown
    ? `transform ${CLOCK_HALO.appear.growSeconds}s cubic-bezier(0.34, ${CLOCK_HALO.appear.overshoot}, 0.64, 1), opacity ${CLOCK_HALO.appear.growSeconds * 0.5}s ease-out`
    : `transform ${CLOCK_HALO.appear.shrinkSeconds}s cubic-bezier(0.36, 0, 0.66, -0.56), opacity ${CLOCK_HALO.appear.shrinkSeconds}s ease-in`};
`;

const HaloRays = styled.svg`
  width: 100%;
  height: 100%;
  ${CLOCK_HALO.rotationSeconds > 0 && css`animation: ${turn} ${CLOCK_HALO.rotationSeconds}s linear infinite;`}
`;

/**
 * A ray's outline, from rayStart out to its tip (in a -100..100 box, pointing up, before rotating):
 * straight, a thin triangle; wavy, a tapering flame whose centerline swings side to side.
 */
const rayPoints = ({ length, width, style, waves, wave }: Ray): string => {
  const base = CLOCK_HALO.rayStart * 100, tip = length * 100, half = width * 100 / 2;
  if (style === 'straight') return `${-half},${-base} ${half},${-base} 0,${-tip}`;
  const steps = 32;
  const along = Array.from({ length: steps + 1 }, (_, k) => {
    const u = k / steps; // 0 at the base, 1 at the tip
    const swing = Math.sin(u * waves * 2 * Math.PI) * wave * 100 * Math.sin(u * Math.PI); // no swing at either end
    return { x: swing, y: -(base + (tip - base) * u), half: half * (1 - u) };
  });
  const left = along.map(p => `${(p.x - p.half).toFixed(2)},${p.y.toFixed(2)}`);
  const right = along.map(p => `${(p.x + p.half).toFixed(2)},${p.y.toFixed(2)}`).reverse();
  return [...left, ...right].join(' ');
};

/** `isShown`: grows in when it turns true, shrinks away when it turns false. */
export default function ClockHalo({ brightness, isShown }: { brightness: number; isShown: boolean }) {
  // Starts hidden, so it grows in when it first appears too (a transition only plays on a change)
  const [hasAppeared, setHasAppeared] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasAppeared(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!CLOCK_HALO.enabled) return null;
  const { rays, color, rayOpacity, glowOpacity, rayStart } = CLOCK_HALO;
  const step = 360 / rays;
  return (
    <HaloWrapper $brightness={brightness}>
      <Appear $isShown={isShown && hasAppeared}>
        <HaloRays viewBox='-100 -100 200 200'>
          <defs>
            <radialGradient id='clock-halo-ray' cx='0' cy='0' r='100' gradientUnits='userSpaceOnUse'>
              <stop offset={rayStart} stopColor={`rgb(${color})`} stopOpacity={rayOpacity} />
              <stop offset='1' stopColor={`rgb(${color})`} stopOpacity='0' />
            </radialGradient>
            <radialGradient id='clock-halo-glow' cx='0' cy='0' r='100' gradientUnits='userSpaceOnUse'>
              <stop offset={rayStart * 0.9} stopColor={`rgb(${color})`} stopOpacity={glowOpacity} />
              <stop offset='0.62' stopColor={`rgb(${color})`} stopOpacity='0' />
            </radialGradient>
          </defs>
          <circle cx='0' cy='0' r='62' fill='url(#clock-halo-glow)' />
          {Array.from({ length: rays }, (_, k) => (
            <g key={k}>
              {/* the long and short rays breathe half a cycle apart; the ripple staggers them around the circle */}
              <BreathingRay points={rayPoints(CLOCK_HALO.longRay)} fill='url(#clock-halo-ray)'
                $angle={k * step} $phase={(k / rays) * CLOCK_HALO.breathe.ripple} />
              <BreathingRay points={rayPoints(CLOCK_HALO.shortRay)} fill='url(#clock-halo-ray)'
                $angle={k * step + step / 2} $phase={(k / rays) * CLOCK_HALO.breathe.ripple + 0.5} />
            </g>
          ))}
        </HaloRays>
      </Appear>
    </HaloWrapper>
  );
}
