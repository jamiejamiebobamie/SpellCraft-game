// MaskVortex.tsx
// The swirl beneath each mask on the game over card. MASK_VORTEX.style 'etched': flat and quiet, as the buttons'
// inner detail (goldStyle): a disc of dark glass, a faint ring, and a few pale lines spiralling in, turning slowly.
// 'storm': a hurricane seen from above, in the night's colors, its cloud bands winding into a black eye (drawn
// once: a canvas of spiral-streaked noise).
import { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { FRAME_ETCH, GLASS, GOLD } from './goldStyle';

/**
 * size: across (cqw); pixels: the image's resolution (drawn once, shared). twist: how tightly the bands wind;
 * arms: the main bands. seconds: one turn of the whole; innerSeconds: of its core (a smaller copy turning
 * faster: the swirl). colors: the bands (black), the backdrop between them (midnight), the light behind
 * them showing at their edges (backlight: also glow, a soft light around the whole, CSS); flecks: rare
 * specks of red or green over it all (fleckShare: how many).
 */
export const MASK_VORTEX = {
  style: 'etched' as 'etched' | 'storm',
  size: 15,
  opacity: 1, // (the whole maelstrom: 0 gone, 1 full)
  pixels: 320,
  twist: 2.4,
  arms: 3,
  speed: 4, // (how fast it all turns: 2, twice as fast; 0.5, half)
  seconds: 40,
  innerSeconds: 22,
  colors: { black: [0, 0, 0], midnight: [20, 30, 78], backlight: [190, 170, 245] },
  glow: 'drop-shadow(0 0 0.8cqw rgba(170, 140, 240, 0.35))',
  flecks: [[170, 30, 40], [40, 150, 80]],
  fleckShare: 0.05,
};

/**
 * The etched swirl (style 'etched'): the disc's glass (opacity), its lines' colour and opacity (as the buttons'
 * etched frame: FRAME_ETCH) and width (in the disc's units: its radius is 1), how many arms spiral in and how
 * far each winds (turns), and how long a turn of the whole takes (seconds).
 */
export const ETCHED_VORTEX = { glass: GLASS.alpha + 0.12, line: GOLD, /* (gold, as the UI's: was FRAME_ETCH.color, white) */ lineOpacity: FRAME_ETCH.opacity * 1.6, lineWidth: 0.018, arms: 3, turns: 0.9, seconds: 30 };

/** An arm spiralling from the rim in toward the middle, as an SVG path (the disc's radius 1). */
const spiralArm = (start: number): string => {
  const points = Array.from({ length: 41 }, (_, k) => {
    const t = k / 40, r = 0.9 - 0.78 * t, angle = start + t * ETCHED_VORTEX.turns * Math.PI * 2;
    return `${(r * Math.cos(angle)).toFixed(3)} ${(r * Math.sin(angle)).toFixed(3)}`;
  });
  return 'M' + points.join(' L ');
};

const EtchedSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: ${MASK_VORTEX.opacity};
  .turning { animation: ${keyframes`to { transform: rotate(-360deg); }`} ${ETCHED_VORTEX.seconds}s linear infinite; transform-origin: 0 0; }
`;

// --- Noise (value noise, layered: fbm), for the bands' texture
const hash = (x: number, y: number, seed: number) => {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const valueNoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number, seed: number) => {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { sum += amp * valueNoise(x * freq, y * freq, seed + o * 17); amp *= 0.5; freq *= 2; }
  return sum / 0.9375;
};
const smoothstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));
const mix = (p: number[], q: number[], t: number) => p.map((v, i) => v + (q[i] - v) * t);

/**
 * The vortex's image (a data URL): for each pixel its place along the spiral (the angle less the twist by
 * the log of the radius), the noise there stretched along the bands (across them fine, along them broad;
 * blended across the angle's seam), its brightness shaped by the eye, the eyewall and the fading edge.
 */
const drawVortex = (): string => {
  const { pixels: n, twist, arms, colors, flecks, fleckShare } = MASK_VORTEX;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(n, n);
  const TAU = Math.PI * 2;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n * 2 - 1, y = (py + 0.5) / n * 2 - 1;
      const r = Math.hypot(x, y);
      const i = (py * n + px) * 4;
      if (r >= 1) { image.data[i + 3] = 0; continue; }
      const along = Math.log(r + 0.02);
      const spiral = ((Math.atan2(y, x) - twist * along) % TAU + TAU) % TAU; // (0 to 2π: the place across the bands)
      const seam = spiral / TAU;
      const streak = (s: number) => fbm(s * arms * 2.2, along * 1.6, 7);
      const bands = streak(spiral) * (1 - seam) + streak(spiral - TAU) * seam;
      const armShape = 0.5 + 0.5 * Math.cos(arms * spiral + bands * 4);
      const eye = smoothstep(0.05, 0.15, r), edge = 1 - smoothstep(0.5, 0.98, r);
      const eyewall = Math.exp(-(((r - 0.17) / 0.07) ** 2));
      const density = Math.min(1, Math.max(0, (bands * 0.85 + armShape * 0.45 - 0.35) * eye * edge + eyewall * 0.45 * eye));
      // (the backdrop midnight blue; the bands black over it, backlit at their edges; the eye black)
      const rim = Math.exp(-(((density - 0.38) / 0.09) ** 2)) * edge;
      let color = mix(colors.midnight, colors.black, smoothstep(0.38, 0.62, density));
      color = mix(color, colors.backlight, rim * 0.55);
      color = mix(color, colors.black, 1 - smoothstep(0.04, 0.13, r));
      // (over it all: rare flecks of red or green)
      if (valueNoise(x * 18, y * 18, 99) > 1 - fleckShare * 2 && r > 0.12) {
        const fleck = flecks[Math.floor(hash(Math.floor(x * 18), Math.floor(y * 18), 5) * flecks.length)];
        color = mix(color, fleck, 0.75);
      }
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = Math.round(255 * edge);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
};

let vortexImage: string | null = null; // (drawn once, for every card)

const turn = keyframes`
  to { transform: rotate(-360deg); }
`;

const Layer = styled.img<{ $seconds: number; $inset: number; $opacity: number }>`
  position: absolute;
  inset: ${props => props.$inset}%;
  width: ${props => 100 - 2 * props.$inset}%;
  height: ${props => 100 - 2 * props.$inset}%;
  opacity: ${props => props.$opacity};
  filter: blur(0.12cqw) ${MASK_VORTEX.glow};
  pointer-events: none;
  animation: ${turn} ${props => props.$seconds}s linear infinite;
`;

/** The vortex (fills its parent): etched (flat, turning slowly), or the storm (the whole turning slowly, its core faster). */
export const MaskVortex = () => MASK_VORTEX.style === 'etched' ? <EtchedVortex /> : <StormVortex />;

const EtchedVortex = () => {
  const { glass, line, lineOpacity, lineWidth, arms } = ETCHED_VORTEX;
  return (
    <EtchedSvg viewBox='-1 -1 2 2' aria-hidden>
      <circle r={0.97} fill={`rgba(${GLASS.tint}, ${glass})`} />
      <g fill='none' stroke={line} strokeOpacity={lineOpacity} strokeWidth={lineWidth} strokeLinecap='round'>
        <circle r={0.9} />
        <g className='turning'>
          {Array.from({ length: arms }, (_, k) => <path key={k} d={spiralArm(k / arms * Math.PI * 2)} />)}
        </g>
        <circle r={0.12} />
      </g>
    </EtchedSvg>
  );
};

const StormVortex = () => {
  const src = useMemo(() => vortexImage ?? (vortexImage = drawVortex()), []);
  return <>
    <Layer src={src} alt='' aria-hidden $seconds={MASK_VORTEX.seconds / MASK_VORTEX.speed} $inset={0} $opacity={MASK_VORTEX.opacity} />
    <Layer src={src} alt='' aria-hidden $seconds={MASK_VORTEX.innerSeconds / MASK_VORTEX.speed} $inset={22} $opacity={0.6 * MASK_VORTEX.opacity} />
  </>;
};
