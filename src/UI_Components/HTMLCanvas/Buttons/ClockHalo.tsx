// ClockHalo.tsx
// A sunburst "glory" behind the clock's face: rays radiating outward that lighten whatever they pass
// over (the clock's body, the wall), slowly turning, pulsing and breathing. The rays reach further
// downward (to the clock body's bottom), and the wavy ones are drawn as twisting ribbons. Drawn on a
// canvas each frame, in front of the clock's body, behind its face (ClockFaceComponent).
import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../../Player/CharacterParts';
import { rootGameStore } from '../../../DataClasses/store';

type RayStyle = 'straight' | 'wavy';
type Ray = { length: number; width: number; style: RayStyle; waves: number; wave: number; ribbon: boolean };

export const CLOCK_HALO = {
  enabled: true,
  center: { x: 50, y: 9.8 }, // the clock face's center (cqw: MenuAnchor 45, 4.8 + padding 0.5 + half of 9)
  radius: 11, // the rays' reach upward (cqw; the face's radius is about 4.3)
  // The long rays' reach straight down (cqw from the face's center): the clock body's bottom edge (its
  // image is 21.8 x 32.7 cqw, from 0.7 cqw down). Rays in between reach smoothly between the two
  bottomReach: 26.1, // (cqw) straight down: halfway between the clock body's bottom (23.6) and where the wall meets the floor
  rays: 12, // long rays (lined up with the hour marks), with as many short ones between them
  // Each ray type: length (fraction of the radius), width (at its base, fraction of the radius),
  // style: 'straight' (a spike) or 'wavy' (a flame-like ray snaking outward, as on a monstrance), with
  // waves (how many curves) and wave (how far it swings side to side, fraction of the radius), and
  // ribbon: drawn as a flat ribbon that twists as it flows (CLOCK_HALO.ribbon)
  longRay: { length: .8, width: 0.11, style: 'straight' as RayStyle, waves: 2, wave: 0.04, ribbon: false },
  shortRay: { length: 0.8, width: 0.12, style: 'wavy' as RayStyle, waves: 1.5, wave: 0.035, ribbon: true },
  // Ribbons: how many half-turns along a ray, how long one twist takes to travel along it, how dark
  // the ribbon's back face is (1: as bright as the front), and the sheen where it faces you
  // (twistsTop: the half-turns along a ribbon pointing up, rising smoothly to `twists` pointing down)
  ribbon: { twists: 2, twistsTop: 1, flowSeconds: 3, backShade: 1, sheen: 0.35 },
  // A satin sheen: a band of light sliding along each ribbon from base to tip, every `seconds` (each
  // ribbon at its own moment), `strength` toward white where it faces you, `width` (fraction of its length)
  // brightness: the sheen's own brightness (scales strength), apart from the ribbon's
  ribbonSheen: { seconds: 2.6, strength: 0.55, width: 0.12, brightness: 1 },
  // The ribbons' own look, apart from the long rays: opacity (1: completely opaque), how much they fade
  // toward their tips (0: not at all, 1: to nothing), and brightness (multiplying their colors): on the
  // landing page, and in play (where the scene starts dark, so they're brightened to stay vivid)
  ribbonLook: { opacity: 0.75, tipFade: 1, brightness: { landing: 1, play: 1 } }, // (as the long rays: tried opacity 1, tipFade 0, play 1.6)
  // How far the ribbons reach: the short rays' shape (short on top, longest straight down, as the long
  // rays), stretched out to the sides along the walls by `sideStretch` (0: none; 1: twice as far at the
  // sides), top and bottom as they were. (Keep the sides short of the doorways, about 32 cqw out.)
  ribbonShape: { sideStretch: 0.8 },
  // The ribbons flowing of their own accord, like a demon's hair: waves running along each from base to
  // tip (`waves` along it, `waveSeconds` each), growing toward the tip (`whip`: its swing there, as a
  // fraction of its length), each swaying side to side (`sway` degrees, every `swaySeconds`) and
  // lengthening and shortening (`stretch`: by up to this fraction, every `stretchSeconds`), each ribbon at
  // its own pace (`varied`: how much their timings differ)
  ribbonFlow: { waves: 1.4, waveSeconds: 3, whip: 0.03, sway: 3, swaySeconds: 7, stretch: 0.06, stretchSeconds: 5, varied: 0.3 }, // (gentle; whip, sway and stretch 0: still)
  // The ribbons slide in and out: the halo shows with plain rays, which twist into ribbons
  // `delaySeconds` after it appears (over `blendSeconds`); before hiding, they untwist back to
  // plain rays (over `unwindSeconds`), and then the halo shrinks away
  // Spreading the rays apart around the lower sides (where the long rays crowd): `centers` in degrees
  // clockwise from 12 o'clock (135: 4:30, 225: 7:30), `width` how far each spread reaches (degrees),
  // `amount` how much wider the gaps get there (0: evenly spaced all round)
  spread: { centers: [135, 225], width: 28, amount: 1.2 },
  ribbonBlend: { delaySeconds: 1.2, blendSeconds: 1.6, unwindSeconds: 0.5 },
  rayStart: 0.36, // where the rays start (fraction of the radius: just inside the face's rim)
  color: '255, 232, 170', // rgb: the glow around the face (and the rays, if rayColors is empty)
  // The long rays' colors, in turn around the circle: cream and soft gold (framing the ribbons).
  // [] : every ray in `color`. toWhite slides a color toward white: 0 = as written, 1 = white
  rayColors: [
    { rgb: '255, 240, 204', toWhite: 0 }, // cream
    { rgb: '255, 214, 128', toWhite: 0 }, // soft gold
  ] as Array<{ rgb: string; toWhite: number }>,
  // The ribbons' colors (the short rays), in turn around the circle: storybook primaries, warm and a
  // little softened ([] : as the long rays)
  ribbonColors: [
    { rgb: '226, 88, 74', toWhite: 0 }, // red
    { rgb: '244, 196, 82', toWhite: 0 }, // yellow
    { rgb: '82, 132, 204', toWhite: 0 }, // blue
    { rgb: '104, 172, 98', toWhite: 0 }, // green
  ] as Array<{ rgb: string; toWhite: number }>,
  // slides all the ray colors (ribbons too) toward white, on top of each one's own toWhite: on the landing
  // page, and in play
  rayColorsToWhite: { landing: 0.2, play: 0 },
  rayOpacity: 0.75, // at the rays' base, fading to nothing at their tips (was 0.55)
  glowOpacity: 0.42, // a soft glow right around the face (lifts the dark carving there)
  rotationSeconds: 90, // one full turn (0: still)
  pulseSeconds: 6, // a slow brighten and dim (0: none)
  pulseLow: 0.7, // the dimmest point of the pulse (1: no pulse)
  // Showing and hiding (shown on the loading screen, and in play while the clock can end the turn):
  // like a camera's iris, the rays swirl open and closed: each grows out from its base leaning over
  // like an aperture blade (`bladeLean` degrees, straightening as it opens), while the whole halo
  // turns `swirl` degrees
  appear: {
    openSeconds: 1.1,
    closeSeconds: 0.7,
    bladeLean: 70,
    swirl: 80,
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
const CANVAS_REACH = Math.max(CLOCK_HALO.radius, CLOCK_HALO.bottomReach) * (1 + CLOCK_HALO.ribbonShape.sideStretch) * 1.05;

/** How far a ribbon pointing at `angle` (radians, 0 = up, clockwise) reaches (cqw): see CLOCK_HALO.ribbonShape. */
const getRibbonReach = (angle: number): number =>
  CLOCK_HALO.radius * CLOCK_HALO.shortRay.length * getReachFactor(angle) * (1 + CLOCK_HALO.ribbonShape.sideStretch * Math.sin(angle) ** 2);

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: ${CLOCK_HALO.pulseLow}; }
`;

const HaloWrapper = styled.div<{ $brightness: number; $isFrozen: boolean }>`
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
  animation-play-state: ${props => props.$isFrozen ? 'paused' : 'running'};
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
 * Where a ray at `angle` (radians, 0 = up, clockwise) is drawn so the rays spread apart around
 * CLOCK_HALO.spread's centers: the gaps there are wider, and a little narrower elsewhere. (A lookup
 * table of the spacing's running total, so the rays still turn smoothly through it.)
 */
const SPREAD_TABLE = (() => {
  const { centers, width, amount } = CLOCK_HALO.spread;
  const n = 720, table = [0];
  const density = (deg: number) => 1 + amount * centers.reduce((sum, c) => {
    const d = ((deg - c + 540) % 360) - 180; // -180..180 from the center
    return sum + Math.exp(-(d * d) / (2 * width * width));
  }, 0);
  for (let k = 1; k <= n; k++) table.push(table[k - 1] + density(((k - 0.5) / n) * 360));
  const total = table[n];
  return table.map(v => (v / total) * Math.PI * 2);
})();
const spreadAngle = (angle: number): number => {
  const turn = Math.PI * 2, n = SPREAD_TABLE.length - 1;
  const a = ((angle % turn) + turn) % turn;
  const at = (a / turn) * n, k = Math.min(n - 1, Math.floor(at));
  return SPREAD_TABLE[k] + (SPREAD_TABLE[k + 1] - SPREAD_TABLE[k]) * (at - k);
};

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
const drawRay = (ctx: CanvasRenderingContext2D, ray: Ray, base: number, tip: number, halfWidth: number, rgb: string, opacity: number, flow: number, ribbonAmount: number, sheenAt: number = -1, tipFade: number = 1,
  flowing?: { seconds: number; phase: number; pace: number }, twistCount: number = CLOCK_HALO.ribbon.twists) => {
  const isRibbon = ray.ribbon && ribbonAmount > 0;
  const steps = ray.style === 'wavy' || isRibbon || flowing ? 32 : 1;
  // (a flowing ribbon: waves running from base to tip, swinging more toward the tip, like hair)
  const { waves, waveSeconds, whip } = CLOCK_HALO.ribbonFlow;
  const swingOf = (u: number) => flowing
    ? Math.sin(2 * Math.PI * (u * waves - (flowing.seconds * flowing.pace) / waveSeconds) + flowing.phase) * whip * (tip - base) * Math.pow(u, 1.3)
    : ray.style === 'wavy'
      ? Math.sin(u * ray.waves * 2 * Math.PI) * ray.wave * (tip / ray.length) * Math.sin(u * Math.PI)
      : 0;
  const { backShade, sheen } = CLOCK_HALO.ribbon;
  const points = Array.from({ length: steps + 1 }, (_, k) => {
    const u = k / steps; // 0 at the base, 1 at the tip
    // -1..1: back..front (a ribbon partway in only partly twists: `ribbonAmount` of the way from flat)
    const twist = isRibbon ? 1 + (Math.cos(Math.PI * (twistCount * u - flow)) - 1) * ribbonAmount : 1;
    return { u, x: swingOf(u), y: -(base + (tip - base) * u), half: halfWidth * (1 - u), twist };
  });

  for (let k = 0; k < steps; k++) {
    const a = points[k], b = points[k + 1];
    const twist = (a.twist + b.twist) / 2;
    const isFront = twist >= 0;
    // The face toward you is lit (with a sheen where it faces you squarely); the back is in shadow
    // (a ray turning into a ribbon gains its sheen as it does; the plain rays keep theirs)
    const sheenAmount = sheen * (ray.ribbon ? ribbonAmount : 1);
    // (and the satin sheen sliding along a ribbon: brightest where it faces you)
    const u = (a.u + b.u) / 2, band = sheenAt < 0 || !isRibbon ? 0 : Math.exp(-((u - sheenAt) ** 2) / (2 * CLOCK_HALO.ribbonSheen.width ** 2));
    const satin = Math.min(1, band * CLOCK_HALO.ribbonSheen.strength * CLOCK_HALO.ribbonSheen.brightness * ribbonAmount * Math.abs(twist));
    const litRgb = isFront ? (sheenAmount > 0 ? towardWhite(rgb, sheenAmount * twist * twist) : rgb) : shade(rgb, backShade);
    const faceRgb = satin > 0 ? towardWhite(litRgb, satin) : litRgb;
    const alpha = opacity * (1 - tipFade * (a.u + b.u) / 2);
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

  // The iris (CLOCK_HALO.appear): `amount` 0 (closed) to 1 (open), heading for `target`
  const irisRef = useRef({ amount: 0, target: 0 });
  // Frozen time (the turn clock held): the pulse pauses with the drawing (checked each frame)
  const frozenRef = useRef(false);
  const [isFrozen, setIsFrozen] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setIsFrozen(frozenRef.current), 100);
    return () => window.clearInterval(interval);
  }, []);

  // The ribbons sliding in and out (CLOCK_HALO.ribbonBlend): `amount` 0 (plain rays) to 1 (ribbons),
  // heading for `target` from `startAt` (performance.now() milliseconds)
  const ribbonRef = useRef({ amount: 0, target: 0, startAt: 0 });
  // The halo hides once its ribbons have untwisted
  const [isAppearShown, setIsAppearShown] = useState(isShown);
  useEffect(() => {
    const ribbon = ribbonRef.current;
    const { delaySeconds, unwindSeconds } = CLOCK_HALO.ribbonBlend;
    if (isShown) {
      ribbon.target = 1;
      ribbon.startAt = performance.now() + delaySeconds * 1000;
      setIsAppearShown(true);
      return;
    }
    ribbon.target = 0;
    ribbon.startAt = performance.now();
    const unwindMilli = ribbon.amount * unwindSeconds * 1000;
    if (unwindMilli <= 0) { setIsAppearShown(false); return; }
    const timeout = setTimeout(() => setIsAppearShown(false), unwindMilli);
    return () => clearTimeout(timeout);
  }, [isShown]);

  // The iris opens as the halo shows (and closes once its ribbons have untwisted)
  useEffect(() => { irisRef.current.target = isAppearShown && hasAppeared ? 1 : 0; }, [isAppearShown, hasAppeared]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !CLOCK_HALO.enabled) return;
    const { rays, color, rayOpacity, glowOpacity, rayStart, rotationSeconds, breathe, ribbon } = CLOCK_HALO;
    // (the colors on the landing page, and in play: rayColorsToWhite)
    const colorsFor = (toWhiteAll: number) => {
      const toColors = (list: Array<{ rgb: string; toWhite: number }>) =>
        list.map(({ rgb, toWhite }) => towardWhite(rgb, 1 - (1 - toWhite) * (1 - toWhiteAll)));
      const rays = CLOCK_HALO.rayColors.length ? toColors(CLOCK_HALO.rayColors) : [color];
      return { rays, ribbons: CLOCK_HALO.ribbonColors.length ? toColors(CLOCK_HALO.ribbonColors) : rays };
    };
    const landingColors = colorsFor(CLOCK_HALO.rayColorsToWhite.landing), playColors = colorsFor(CLOCK_HALO.rayColorsToWhite.play);

    let frameId = 0, lastNow = performance.now();
    let seconds = 0; // the halo's own time: it stops while time is frozen
    let isPlayLook = rootGameStore.getIsPlaying(); // (its colors: rayColorsToWhite.play, else .landing)
    const draw = (now: number) => {
      // The ribbons slide toward their target (twisting in slowly, untwisting quickly)
      const blend = ribbonRef.current, dt = Math.max(0, (now - lastNow) / 1000);
      lastNow = now;
      // Frozen time: while the turn clock's seconds hand is held, the halo holds still too
      const isFrozen = rootGameStore.getIsTurnClockHeld();
      if (!isFrozen) seconds += Math.min(dt, 0.1);
      frozenRef.current = isFrozen;
      if (now >= blend.startAt && blend.amount !== blend.target) {
        const { blendSeconds, unwindSeconds } = CLOCK_HALO.ribbonBlend;
        const rate = blend.target > blend.amount ? 1 / Math.max(0.01, blendSeconds) : 1 / Math.max(0.01, unwindSeconds);
        blend.amount = blend.target > blend.amount ? Math.min(blend.target, blend.amount + rate * dt) : Math.max(blend.target, blend.amount - rate * dt);
      }
      const ribbonAmount = blend.amount * blend.amount * (3 - 2 * blend.amount); // eased
      // The iris opens or closes toward its target (smoothly, like a lens's blades)
      const iris = irisRef.current;
      if (iris.amount !== iris.target) {
        const { openSeconds, closeSeconds } = CLOCK_HALO.appear;
        iris.amount = iris.target > iris.amount
          ? Math.min(iris.target, iris.amount + dt / Math.max(0.01, openSeconds))
          : Math.max(iris.target, iris.amount - dt / Math.max(0.01, closeSeconds));
      }
      const open = iris.amount * iris.amount * (3 - 2 * iris.amount); // eased
      // The landing page's look (whiter) or the game's: kept until the halo has closed after Play is
      // pressed, so it doesn't change while the ribbons recede
      if (!rootGameStore.getIsPlaying()) isPlayLook = false;
      else if (iris.amount <= 0.001) isPlayLook = true;
      const dpr = window.devicePixelRatio || 1;
      const size = Math.round(canvas.clientWidth * dpr);
      if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
      const pxPerCqw = size / (CANVAS_REACH * 2);
      const radiusPx = CLOCK_HALO.radius * pxPerCqw;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (open <= 0.001) { frameId = requestAnimationFrame(draw); return; } // closed
      ctx.translate(size / 2, size / 2);

      // The soft glow around the face
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusPx * 0.62);
      glow.addColorStop(Math.min(1, rayStart * 0.9 / 0.62), `rgba(${color}, ${glowOpacity * open})`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx * 0.62, 0, Math.PI * 2);
      ctx.fill();

      // (closed or opening, the whole halo is turned back by the iris's swirl)
      const rotation = (rotationSeconds > 0 ? (seconds / rotationSeconds) * Math.PI * 2 : 0) - (1 - open) * CLOCK_HALO.appear.swirl * Math.PI / 180;
      const lean = (1 - open) * CLOCK_HALO.appear.bladeLean * Math.PI / 180;
      const step = (Math.PI * 2) / rays;
      const flow = ribbon.flowSeconds > 0 ? seconds / ribbon.flowSeconds : 0;
      for (let k = 0; k < rays; k++) {
        ([[CLOCK_HALO.longRay, 0], [CLOCK_HALO.shortRay, 0.5]] as Array<[Ray, number]>).forEach(([ray, offset]) => {
          const angle = spreadAngle(rotation + (k + offset) * step);
          // Breathing: long and short rays half a cycle apart, the timing rippling around the circle
          const phase = (k / rays) * breathe.ripple + offset;
          const breath = breathe.seconds > 0
            ? 1 - breathe.amount * (0.5 - 0.5 * Math.cos(2 * Math.PI * (seconds / breathe.seconds + phase)))
            : 1;
          const base = radiusPx * rayStart;
          const fullTip = ray.ribbon
            ? getRibbonReach(angle) * pxPerCqw * breath // (the ribbons: stretched along the walls, CLOCK_HALO.ribbonShape)
            : radiusPx * ray.length * breath * getReachFactor(angle);
          // A ribbon flows of its own accord: its own pace and phase, swaying and stretching
          const flowFx = CLOCK_HALO.ribbonFlow;
          const seed = Math.sin(k * 12.9898) * 43758.5453, own = seed - Math.floor(seed); // (0..1, steady per ribbon)
          const pace = 1 + (own - 0.5) * 2 * flowFx.varied, flowPhase = own * Math.PI * 2;
          const swayAngle = ray.ribbon ? (flowFx.sway * Math.PI / 180) * Math.sin(2 * Math.PI * seconds * pace / flowFx.swaySeconds + flowPhase) : 0;
          const stretched = ray.ribbon ? 1 - flowFx.stretch * (0.5 + 0.5 * Math.sin(2 * Math.PI * seconds * pace / flowFx.stretchSeconds + flowPhase * 1.7)) : 1;
          const tip = base + (fullTip * stretched - base) * open; // growing out from its base as the iris opens
          ctx.save();
          ctx.rotate(angle + swayAngle);
          // leaning over at its base like an aperture blade, straightening as the iris opens
          ctx.translate(0, -base);
          ctx.rotate(lean);
          ctx.translate(0, base);
          // (the ribbons: their own opacity, tip fade and brightness, on the landing page or in play)
          const { ribbonLook } = CLOCK_HALO;
          const ribbonBrightness = isPlayLook ? ribbonLook.brightness.play : ribbonLook.brightness.landing;
          const { rays: rayColors, ribbons: ribbonColors } = isPlayLook ? playColors : landingColors;
          const rayColor = ray.ribbon ? shade(ribbonColors[k % ribbonColors.length], ribbonBrightness) : rayColors[k % rayColors.length];
          drawRay(ctx, ray, base, tip, (radiusPx * ray.width) / 2, rayColor, (ray.ribbon ? ribbonLook.opacity : rayOpacity) * Math.min(1, open * 1.5), flow + k * 0.37, ribbonAmount,
            ray.ribbon ? ((seconds / CLOCK_HALO.ribbonSheen.seconds + k * 0.29) % 1) * 1.4 - 0.2 : -1,
            ray.ribbon ? ribbonLook.tipFade : 1,
            ray.ribbon ? { seconds, phase: flowPhase, pace } : undefined,
            CLOCK_HALO.ribbon.twistsTop + (CLOCK_HALO.ribbon.twists - CLOCK_HALO.ribbon.twistsTop) * (1 - Math.cos(angle)) / 2); // (fewer twists pointing up)
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
    <HaloWrapper $brightness={brightness} $isFrozen={isFrozen}>
      <HaloCanvas ref={canvasRef} />
    </HaloWrapper>
  );
}
