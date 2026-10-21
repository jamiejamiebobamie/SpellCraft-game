// PlayButtonStyles.tsx
// The landing screen's Play button, in candidate looks (to compare, then keep one): the same long
// hexagon, drawn as one SVG so its frame is an even, beveled band of metal all the way round.
//   brass:     a beveled brass frame on a midnight-indigo panel (the window skies), gold-leaf lettering
//   verdigris: an aged bronze frame gone green in its recesses, on a dark green panel
//   vellum:    a thin brass frame on a parchment panel, inked lettering
import styled, { css, keyframes } from 'styled-components';

export type PlayButtonLook = 'brass' | 'verdigris' | 'vellum';

type Look = {
  name: string;
  outline: string; // the dark line around the frame (the logo's lettering outline)
  frame: [string, string, string, string]; // the frame's bevel, top to bottom: highlight, body, shade, deep shade
  hairline: string; // the fine line just inside the frame
  panel: [string, string, string]; // the panel, center to edge
  stars: boolean;
  studs: [string, string]; // the diamond studs at the side points: face, edge
  text: 'gold' | 'ink';
  glow: string; // on hover
};

export const PLAY_BUTTON_LOOKS: Record<PlayButtonLook, Look> = {
  brass: {
    name: 'Brass & Midnight',
    outline: '#1e1202',
    frame: ['#fdeaa7', '#d6a84b', '#8f6722', '#4a3208'],
    hairline: '#f0cf78',
    panel: ['#3d3788', '#1e1b4c', '#0e0c29'],
    stars: true,
    studs: ['#ffe58a', '#7a5414'],
    text: 'gold',
    glow: 'rgba(255, 196, 84, 0.65)',
  },
  verdigris: {
    name: 'Verdigris Bronze',
    outline: '#0d1710',
    frame: ['#d9bb7c', '#94713a', '#4f6e55', '#26382b'],
    hairline: '#86c7a6',
    panel: ['#2e5b46', '#173428', '#0a1a12'],
    stars: false,
    studs: ['#a9dcc0', '#2c4a38'],
    text: 'gold',
    glow: 'rgba(120, 220, 160, 0.55)',
  },
  vellum: {
    name: 'Vellum Plaque',
    outline: '#3a2410',
    frame: ['#f6dd8e', '#c99f48', '#8a6224', '#4f360f'],
    hairline: '#9a7432',
    panel: ['#f3e6c2', '#e3cd97', '#c8ab6c'],
    stars: false,
    studs: ['#f6dd8e', '#6b4a16'],
    text: 'ink',
    glow: 'rgba(255, 220, 140, 0.6)',
  },
};

// The shape (viewBox 386 x 100): the frame's centerline, and a hairline inset inside it
const FRAME = '9,50 52,9 334,9 377,50 334,91 52,91';
const HAIRLINE = '21,50 58,18 328,18 365,50 328,82 58,82';
const PANEL = '15,50 55,14 331,14 371,50 331,86 55,86';
// A few stars on the night panel (x, y, r)
const STARS: Array<[number, number, number]> = [[78, 30, 1.2], [104, 70, 0.9], [136, 24, 0.8], [252, 27, 1], [284, 72, 1.1], [312, 34, 0.8], [96, 48, 0.6], [296, 52, 0.7]];

const shimmer = keyframes`
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
`;

const Frame = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  z-index: -1;
  .panel { transition: filter 0.2s ease; }
  .inner { transition: transform 0.15s ease; }
`;

const Label = styled.span<{ $text: 'gold' | 'ink' }>`
  position: relative;
  ${props => props.$text === 'gold' ? css`
    background: linear-gradient(90deg, #ffd700 0%, #ffe875 25%, #ffffff 45%, #ffffff 55%, #ffe875 75%, #ffa500 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ${shimmer} 3.5s linear infinite;
    filter: drop-shadow(0.15cqw 0.15cqw 0 #1e1202) drop-shadow(-0.15cqw -0.15cqw 0 #1e1202)
            drop-shadow(0.15cqw -0.15cqw 0 #1e1202) drop-shadow(-0.15cqw 0.15cqw 0 #1e1202);
  ` : css`
    color: #2b1a0c;
    text-shadow: 0 0.1cqw 0 rgba(255, 245, 215, 0.6);
  `}
  transition: transform 0.15s ease;
`;

/** The button's face: the frame, panel and lettering (the button itself, and its hover, are the caller's). */
export const PlayButtonFace = ({ look, label }: { look: PlayButtonLook; label: string }) => {
  const l = PLAY_BUTTON_LOOKS[look];
  const id = `play-${look}`;
  return (
    <>
      <Frame viewBox="0 0 386 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={l.frame[0]} />
            <stop offset="0.35" stopColor={l.frame[1]} />
            <stop offset="0.75" stopColor={l.frame[2]} />
            <stop offset="1" stopColor={l.frame[3]} />
          </linearGradient>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
          <radialGradient id={`${id}-panel`} cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor={l.panel[0]} />
            <stop offset="0.6" stopColor={l.panel[1]} />
            <stop offset="1" stopColor={l.panel[2]} />
          </radialGradient>
        </defs>
        {/* The panel (sinks a little when pressed) */}
        <g className="inner">
          <polygon className="panel" points={PANEL} fill={`url(#${id}-panel)`} />
          {l.stars && STARS.map(([x, y, r], k) => <circle key={k} cx={x} cy={y} r={r} fill="#fff6d0" opacity={0.55} />)}
          {/* a soft light from above, in place of a hard gloss line */}
          <polygon points={PANEL} fill={`url(#${id}-light)`} />
        </g>
        {/* The frame: a dark outline, the beveled metal band, and a fine line inside it */}
        <polygon points={FRAME} fill="none" stroke={l.outline} strokeWidth={15} strokeLinejoin="miter" />
        <polygon points={FRAME} fill="none" stroke={`url(#${id}-frame)`} strokeWidth={10} strokeLinejoin="miter" />
        <polygon points={FRAME} fill="none" stroke={l.frame[0]} strokeOpacity={0.5} strokeWidth={1.2} transform="translate(0 -3)" />
        <polygon points={HAIRLINE} fill="none" stroke={l.hairline} strokeWidth={1.2} opacity={0.85} />
        {/* Diamond studs at the side points */}
        {[9, 377].map(x => (
          <polygon key={x} points={`${x},38 ${x + 9},50 ${x},62 ${x - 9},50`} fill={l.studs[0]} stroke={l.studs[1]} strokeWidth={2} />
        ))}
      </Frame>
      <Label className="label" $text={l.text}>{label}</Label>
    </>
  );
};

/** The glow on hover, per look (for the caller's button). */
export const getPlayButtonGlow = (look: PlayButtonLook): string => PLAY_BUTTON_LOOKS[look].glow;
