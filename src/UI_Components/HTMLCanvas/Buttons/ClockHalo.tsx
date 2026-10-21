// ClockHalo.tsx
// A sunburst "glory" behind the clock's face: rays radiating outward that lighten whatever they pass
// over (the clock's body, the wall), slowly turning, pulsing and breathing. The rays reach further
// downward (to the clock body's bottom), and the wavy ones are drawn as twisting ribbons. Drawn on a
// canvas each frame, in front of the clock's body, behind its face (ClockFaceComponent).
import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../../Player/CharacterParts';

type RayStyle = 'straight' | 'wavy';
type Ray = { length: number; width: number; style: RayStyle; waves: number; wave: number; ribbon: boolean };

export const CLOCK_HALO = {
  enabled: true,
  center: { x: 50, y: 9.8 }, // the clock face's center (cqw: MenuAnchor 45, 4.8 + padding 0.5 + half of 9)
  radius: 11, // the rays' reach upward (cqw; the face's radius is about 4.3)
  // The long rays' reach straight down (cqw from the face's center): the clock body's bottom edge (its
  // image is 21.8 x 32.7 cqw, from 0.7 cqw down). Rays in between reach smoothly between the two
  bottomReach: 23.6,
  rays: 12, // long rays (lined up with the hour marks), with as many short ones between them
  // Each ray type: length (fraction of the radius), width (at its base, fraction of the radius),
  // style: 'straight' (a spike) or 'wavy' (a flame-like ray snaking outward, as on a monstrance), with
  // waves (how many curves) and wave (how far it swings side to side, fraction of the radius), and
  // ribbon: drawn as a flat ribbon that twists as it flows (CLOCK_HALO.ribbon)
  longRay: { length: .8, width: 0.11, style: 'straight' as RayStyle, waves: 2, wave: 0.04, ribbon: false },
  shortRay: { length: 0.8, width: 0.12, style: 'wavy' as RayStyle, waves: 1.5, wave: 0.035, ribbon: true },
  // Ribbons: how many half-turns along a ray, how long one twist takes to travel along it, how dark
  // the ribbon's back face is (1: as bright as the front), and the sheen where it faces you
  ribbon: { twists: 2, flowSeconds: 3, backShade: 0.55, sheen: 0.35 },
  rayStart: 0.36, // where the rays start (fraction of the radius: just inside the face's rim)
  color: '255, 232, 170', // rgb: the glow around the face (and the rays, if rayColors is empty)
  // The rays' colors, in turn around the circle (long, short, long, ...): the wand sparkles' colors
  // (pixieColors), muted to about the cream's saturation. [] : every ray in `color`.
  // toWhite slides a color toward white: 0 = as written, 1 = white
  rayColors: [
    // (in this order, the long rays alternate pale yellow and pink, the short ones mint and golden)
    { rgb: '255, 246, 196', toWhite: 0 }, // pale yellow (#FFF7C2)
    { rgb: '178, 255, 236', toWhite: 0 }, // mint (#A6FFEA)
    { rgb: '255, 186, 224', toWhite: 0 }, // pink (#FFBBE1)
    { rgb: '255, 229, 160', toWhite: 0 }, // golden yellow (#FFE53B)
  ] as Array<{ rgb: string; toWhite: number }>,
  rayColorsToWhite: .2, // slides all the ray colors toward white, on top of each one's own toWhite
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

/** How far the halo's canvas reaches from the face's center (cqw): its longest rays, plus room. */
const CANVAS_REACH = Math.max(CLOCK_HALO.radius, CLOCK_HALO.bottomReach) * 1.05;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: ${CLOCK_HALO.pulseLow}; }
`;

const HaloWrapper = styled.div<{ $brightness: number }>`
  position: absolute;
  left: ${CLOCK_HALO.center.x - CANVAS_REACH}cqw;
  top: ${CLOCK_HALO.center.y - CANVAS_REACH}cqw;
  width: ${CANVAS_REACH * 2}cqw;
  height: ${CANVAS_REACH * 2}cqw;
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

const HaloCanvas = styled.canvas`
  width: 100%;
  height: 100%;
`;

/** An 'r, g, b' color moved `amount` (0 to 1) of the way to white. */
const towardWhite = (rgb: string, amount: number): string => {
  const t = Math.min(1, Math.max(0, amount));
  return rgb.split(',').map(c => Math.round(Number(c) + (255 - Number(c)) * t)).join(', ');
};

/** An 'r, g, b' color scaled by `factor` (darker below 1). */
const shade = (rgb: string, factor: number): string =>
  rgb.split(',').map(c => Math.round(Math.min(255, Number(c) * factor))).join(', ');

/**
 * How much longer a ray pointing at `angle` (radians, 0 = straight up, clockwise) is than one pointing
 * up: 1 at the top, growing smoothly to its full length straight down (and the sides in between).
 */
const getReachFactor = (angle: number): number => {
  const topReach = CLOCK_HALO.radius * CLOCK_HALO.longRay.length;
  const bottomFactor = CLOCK_HALO.bottomReach / topReach;
  const downness = (1 - Math.cos(angle)) / 2; // 0 up, 1 down
  return 1 + (bottomFactor - 1) * downness * downness;
};

/**
 * Draws one ray pointing up from the origin (the caller rotates it), its base at `base` and its tip
 * at `tip` (in pixels), fading from `opacity` to nothing at the tip. A ribbon twists as it goes, its
 * width narrowing where it turns edge-on and its back face darker; `flow` moves the twist along it.
 */
const drawRay = (ctx: CanvasRenderingContext2D, ray: Ray, base: number, tip: number, halfWidth: number, rgb: string, opacity: number, flow: number) => {
  const steps = ray.style === 'wavy' || ray.ribbon ? 32 : 1;
  const swingOf = (u: number) => ray.style === 'wavy'
    ? Math.sin(u * ray.waves * 2 * Math.PI) * ray.wave * (tip / ray.length) * Math.sin(u * Math.PI)
    : 0;
  const { twists, backShade, sheen } = CLOCK_HALO.ribbon;
  const points = Array.from({ length: steps + 1 }, (_, k) => {
    const u = k / steps; // 0 at the base, 1 at the tip
    const twist = ray.ribbon ? Math.cos(Math.PI * (twists * u - flow)) : 1; // -1..1: back..front
    return { u, x: swingOf(u), y: -(base + (tip - base) * u), half: halfWidth * (1 - u), twist };
  });

  for (let k = 0; k < steps; k++) {
    const a = points[k], b = points[k + 1];
    const twist = (a.twist + b.twist) / 2;
    const isFront = twist >= 0;
    // The face toward you is lit (with a sheen where it faces you squarely); the back is in shadow
    const faceRgb = isFront ? (sheen > 0 ? towardWhite(rgb, sheen * twist * twist) : rgb) : shade(rgb, backShade);
    const alpha = opacity * (1 - (a.u + b.u) / 2);
    ctx.fillStyle = `rgba(${faceRgb}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(a.x - a.half * Math.abs(a.twist), a.y);
    ctx.lineTo(b.x - b.half * Math.abs(b.twist), b.y);
    ctx.lineTo(b.x + b.half * Math.abs(b.twist), b.y);
    ctx.lineTo(a.x + a.half * Math.abs(a.twist), a.y);
    ctx.closePath();
    ctx.fill();
  }
};

/** `isShown`: grows in when it turns true, shrinks away when it turns false. */
export default function ClockHalo({ brightness, isShown }: { brightness: number; isShown: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Starts hidden, so it grows in when it first appears too (a transition only plays on a change)
  const [hasAppeared, setHasAppeared] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasAppeared(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !CLOCK_HALO.enabled) return;
    const { rays, color, rayOpacity, glowOpacity, rayStart, rotationSeconds, breathe, ribbon } = CLOCK_HALO;
    const rayColors = CLOCK_HALO.rayColors.length
      ? CLOCK_HALO.rayColors.map(({ rgb, toWhite }) => towardWhite(rgb, 1 - (1 - toWhite) * (1 - CLOCK_HALO.rayColorsToWhite)))
      : [color];

    const start = performance.now();
    let frameId = 0;
    const draw = (now: number) => {
      const seconds = (now - start) / 1000;
      const dpr = window.devicePixelRatio || 1;
      const size = Math.round(canvas.clientWidth * dpr);
      if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
      const pxPerCqw = size / (CANVAS_REACH * 2);
      const radiusPx = CLOCK_HALO.radius * pxPerCqw;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);

      // The soft glow around the face
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusPx * 0.62);
      glow.addColorStop(Math.min(1, rayStart * 0.9 / 0.62), `rgba(${color}, ${glowOpacity})`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx * 0.62, 0, Math.PI * 2);
      ctx.fill();

      const rotation = rotationSeconds > 0 ? (seconds / rotationSeconds) * Math.PI * 2 : 0;
      const step = (Math.PI * 2) / rays;
      const flow = ribbon.flowSeconds > 0 ? seconds / ribbon.flowSeconds : 0;
      for (let k = 0; k < rays; k++) {
        ([[CLOCK_HALO.longRay, 0, 2 * k], [CLOCK_HALO.shortRay, 0.5, 2 * k + 1]] as Array<[Ray, number, number]>).forEach(([ray, offset, colorIndex]) => {
          const angle = rotation + (k + offset) * step;
          // Breathing: long and short rays half a cycle apart, the timing rippling around the circle
          const phase = (k / rays) * breathe.ripple + offset;
          const breath = breathe.seconds > 0
            ? 1 - breathe.amount * (0.5 - 0.5 * Math.cos(2 * Math.PI * (seconds / breathe.seconds + phase)))
            : 1;
          const tip = radiusPx * ray.length * breath * getReachFactor(angle);
          ctx.save();
          ctx.rotate(angle);
          drawRay(ctx, ray, radiusPx * rayStart, tip, (radiusPx * ray.width) / 2, rayColors[colorIndex % rayColors.length], rayOpacity, flow + k * 0.37);
          ctx.restore();
        });
      }
      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (!CLOCK_HALO.enabled) return null;
  return (
    <HaloWrapper $brightness={brightness}>
      <Appear $isShown={isShown && hasAppeared}>
        <HaloCanvas ref={canvasRef} />
      </Appear>
    </HaloWrapper>
  );
}
