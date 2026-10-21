// titleLettering.ts
// The "SpellCraft" title's lettering (LOGO_CONFIG.title: its gold sheen, brown outline and warm glow),
// for other text to match: "Loading..." (its sheen moving) and the game over modal's title (still).
import { keyframes } from 'styled-components';
import { LOGO_CONFIG } from './logoConfig';

/** A gradient stop ('#rrggbb 40%') with its color scaled by `brightness`. */
export const scaleStop = (stop: string, brightness: number): string => stop.replace(/#([0-9a-f]{6})/i, (_, hex: string) =>
  '#' + [0, 2, 4].map(k => Math.min(255, Math.round(parseInt(hex.slice(k, k + 2), 16) * brightness)).toString(16).padStart(2, '0')).join(''));

/** The title's gradient stops, at its brightness. */
const getStops = (): Array<string> => {
  const { gradient } = LOGO_CONFIG.title;
  return gradient ? gradient.stops.map(stop => scaleStop(stop, gradient.brightness)) : [LOGO_CONFIG.title.color];
};

/** The sheen sliding across (one tile of `tileCqw` per cycle, so it loops seamlessly). */
export const titleSheenSlide = (tileCqw: number) => keyframes`
  from { background-position: 0 0; }
  to { background-position: ${tileCqw}cqw 0; }
`;

/**
 * CSS for text in the title's style. `strokeCqw`: the brown outline's width; `glowCqw`: the glow's
 * reach. With `slide`, the sheen runs left to right in tiles `slide.tileCqw` wide (pair it with an
 * animation of titleSheenSlide(tileCqw)); without, it's the title's own still, slanted sheen.
 */
export const titleLetteringCss = ({ strokeCqw, glowCqw, slide }: { strokeCqw: number; glowCqw: number; slide?: { tileCqw: number } }): string => {
  const { color, outline, glow, gradient } = LOGO_CONFIG.title;
  const stops = getStops();
  // Sliding: the stops there and back (the ends match, so the tiles join without a seam)
  const plain = stops.map(stop => stop.split(' ')[0]);
  const background = slide
    ? `linear-gradient(90deg, ${[...plain, ...plain.slice(0, -1).reverse()].join(', ')}) 0 0 / ${slide.tileCqw}cqw 100% repeat-x`
    : `linear-gradient(${gradient?.angle ?? 180}deg, ${stops.join(', ')})`;
  return `
    color: ${color};
    background: ${background};
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    -webkit-text-stroke: ${strokeCqw}cqw ${outline};
    filter: drop-shadow(0 0 ${glowCqw}cqw ${glow}) drop-shadow(0 ${glowCqw * 0.5}cqw ${glowCqw * 0.5}cqw rgba(0, 0, 0, 0.8));
  `;
};
