// PlayButtonStyles.tsx
// The ruby button (the landing screen's Play, the game over modal's Yes and No): a long hexagon, drawn
// as one SVG so its frame is an even, beveled band of brass all the way round, set with a faceted
// ruby, its lettering etched into it. (Looks are kept as data, so another could be added beside it.)
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

export type PlayButtonLook = 'ruby';

type Look = {
  name: string;
  outline: string; // the dark line around the frame (the logo's lettering outline)
  frame: [string, string, string, string]; // the frame's bevel, top to bottom: highlight, body, shade, deep shade
  hairline: string; // the fine line just inside the frame
  panel: [string, string, string]; // the panel, center to edge
  jewel: boolean; // cut like a gem: a flat table in the middle, beveled facets around it, and a glint
  studs: [string, string]; // the diamond studs at the side points: face, edge
  text: 'etched'; // etched: cut into the panel (see ETCHING)
  glow: string; // on hover
};

export const PLAY_BUTTON_LOOKS: Record<PlayButtonLook, Look> = {
  ruby: {
    name: 'Ruby',
    outline: '#3a2410',
    frame: ['#f6dd8e', '#c99f48', '#8a6224', '#4f360f'],
    hairline: '#9a7432',
    panel: ['#e8394a', '#9c1024', '#3d030c'],
    jewel: true,
    studs: ['#f6dd8e', '#6b4a16'],
    text: 'etched',
    glow: 'rgba(255, 90, 90, 0.55)',
  },
};

// The shape (viewBox 386 x 100): the frame's centerline, and a hairline inset inside it
const FRAME = '9,50 52,9 334,9 377,50 334,91 52,91';
const HAIRLINE = '21,50 58,18 328,18 365,50 328,82 58,82';
const PANEL = '15,50 55,14 331,14 371,50 331,86 55,86';
// The jewel's cut: its flat table, inside the panel; each facet runs from a panel edge to the table's,
// lit from above (light on the upper facets, shade on the lower)
const TABLE = [[62, 50], [88, 31], [298, 31], [324, 50], [298, 69], [88, 69]];
const PANEL_POINTS = [[15, 50], [55, 14], [331, 14], [371, 50], [331, 86], [55, 86]];
const FACET_LIGHT = [['#ffffff', 0.16], ['#ffffff', 0.26], ['#ffffff', 0.1], ['#000000', 0.22], ['#000000', 0.34], ['#000000', 0.16]] as const;
/**
 * The ruby's light turning with the word's (see getFacetKeyframes): each facet lit as it faces the
 * light and shaded as it faces away, by its outward direction (normal). At rest the light is above, and
 * each facet keeps its resting light (FACET_LIGHT); turning, a facet that's lit at rest can fall into
 * shade by `shade` and one shaded at rest can light up by `light` (opacities, facing the light squarely).
 */
const RUBY_LIGHT = { isTurning: true, light: 0.26, shade: 0.3 };
const FACET_NORMALS = PANEL_POINTS.map((p, k) => {
  const q = PANEL_POINTS[(k + 1) % 6];
  const mx = (p[0] + q[0]) / 2 - 193, my = (p[1] + q[1]) / 2 - 50; // outward: from the middle toward the edge
  const dx = q[0] - p[0], dy = q[1] - p[1];
  let nx = dy, ny = -dx; // perpendicular to the edge
  if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
  const length = Math.hypot(nx, ny);
  return [nx / length, ny / length];
});

/**
 * The glint's timing (while the button is hovered): one glint takes `sweepSeconds` (the band of light
 * crossing the word, the letters' and the ruby's light turning), then it rests `restSeconds` before the next.
 */
export const GLINT = { sweepSeconds: 1.925, restSeconds: 1.575 };

/**
 * The etched lettering (drawn in the SVG, over the panel): the deep red of the stone's depths, its cut
 * shadowed along the top and lit along the bottom, and a glint sweeping across every `glintSeconds`:
 *   glint 'orbit':  the light inside the letters' cuts turns once around with the ruby's light
 *                   (clockwise; its shadow opposite), brightening to `litFlare` mid-turn, then settles
 *                   on the lower walls again (see `orbit`)
 *   glint 'lit':    the light along the letters' bottom edges flares as it passes (`litFlare`)
 *   glint 'stroke': a band of light runs around the letters' outlines as it passes
 * `rim`: how much the outlines catch the light all the time.
 */
const ETCHING = {
  fill: '#4d0510', shadow: 'rgba(0, 0, 0, 0.75)', lit: '#ff96a0', litOpacity: 0.6, litFlare: '#ffb4bc',
  rim: 0.22, glint: 'orbit' as 'orbit' | 'lit' | 'stroke', glintSeconds: GLINT.sweepSeconds + GLINT.restSeconds, fontSize: 57, y: 63, // (glintSeconds: one glint and its rest: see GLINT)
  // steady: as the light swings, each letter's dark core would seem to slide away from it (and the
  // letter with it), so the letter shifts toward the light by this much of the light's move (0: off)
  // rest: how far the light reaches into the cut (its width): at rest on the bottom walls, and never more;
  // top: its width on the top walls, as a fraction of rest (thinner than the bottom's);
  // byHeight: mid-turn, shorter letters' light is thinner, in proportion to their height (0: all alike)
  orbit: { rest: 1.6, top: 0.6, byHeight: 1, shadowRest: 1.4, peakOpacity: 0.7, steady: 0.5 },
  sweepToo: false, // with 'orbit': the 'stroke' glint's band of light sweeping across the outlines too
};

/**
 * The sweeping glint's band: it crosses from `from` to `to` (a shift in the viewBox's x) over the first
 * `moving` of each cycle, its middle at x = 145 + the shift (halfway up the word), then waits.
 */
const SWEEP = { from: -90, to: 190, moving: GLINT.sweepSeconds / (GLINT.sweepSeconds + GLINT.restSeconds) };
/** When (a fraction of the cycle) the sweeping band's middle passes x. */
const getSweepTime = (x: number): number => SWEEP.moving * (x - 145 - SWEEP.from) / (SWEEP.to - SWEEP.from);
/** The sweeping band's width across the word (viewBox units): it lights a letter from when its edge arrives until it's past. */
const SWEEP_BAND = 12;

/**
 * One letter's 'orbit' keyframes. Its light follows the ruby's: turning once around, clockwise, over
 * [turnStart, turnStart + turnLength] of the cycle (fractions; see getFacetKeyframes), brightening
 * toward the middle of the turn, and resting otherwise. The light and shadow fall inside the cut, as in a real one: the light on the
 * walls facing it, the shadow on those facing away; each band is the letter minus a copy of itself
 * shifted away from that band's side (`lightCut`, `shadowCut`). The light falls on the walls facing
 * away from the ruby's light (on the lower walls at rest, the light being above), the shadow opposite. The light is never wider than
 * at rest: thinner on the top walls (orbit.top), and mid-swing thinner on shorter letters
 * (`heightFactor`: the letter's height relative to the tallest, 0 to 1).
 */
const getOrbitKeyframes = (heightFactor: number, turnStart: number, turnLength: number) => {
  const steps = 24;
  const { rest, top, byHeight, shadowRest } = ETCHING.orbit;
  const frames = Array.from({ length: steps + 1 }, (_, k) => {
    const u = k / steps; // 0..1 through the turn
    const swell = Math.sin(Math.PI * u); // 0 at rest, 1 mid-turn
    // the lit walls: straight below (SVG y is down), once around clockwise, opposite the ruby's light
    const angle = Math.PI / 2 + u * Math.PI * 2;
    const upness = Math.max(0, -Math.sin(angle)); // 0 below or to the side, 1 on the top walls
    const reach = rest * (1 - (1 - top) * upness) * (1 + (heightFactor - 1) * byHeight * swell);
    const shadowReach = shadowRest;
    return {
      time: turnStart + u * turnLength,
      lightCut: `${(-Math.cos(angle) * reach).toFixed(2)} ${(-Math.sin(angle) * reach).toFixed(2)}`,
      // the counter-shift keeping the letter's dark core in place: toward the light, from where it rests
      steady: `${(ETCHING.orbit.steady * Math.cos(angle) * reach).toFixed(2)} ${(ETCHING.orbit.steady * (Math.sin(angle) * reach - rest)).toFixed(2)}`,
      shadowCut: `${(Math.cos(angle) * shadowReach).toFixed(2)} ${(Math.sin(angle) * shadowReach).toFixed(2)}`,
      opacity: (ETCHING.litOpacity + (ETCHING.orbit.peakOpacity - ETCHING.litOpacity) * swell).toFixed(2),
      flare: swell,
    };
  });
  const atRest = frames[0];
  const all = [
    ...(turnStart > 0.001 ? [{ ...atRest, time: 0 }] : []),
    ...frames,
    ...(turnStart + turnLength < 0.999 ? [{ ...atRest, time: 1 }] : []),
  ];
  all[0] = { ...all[0], time: 0 };
  all[all.length - 1] = { ...all[all.length - 1], time: 1 };
  const mix = (t: number) => { // the light's color, toward litFlare by t
    const from = ETCHING.lit.match(/[0-9a-f]{2}/gi)!.map(h => parseInt(h, 16)), to = ETCHING.litFlare.match(/[0-9a-f]{2}/gi)!.map(h => parseInt(h, 16));
    return '#' + from.map((c, k) => Math.round(c + (to[k] - c) * t).toString(16).padStart(2, '0')).join('');
  };
  return {
    keyTimes: all.map(f => f.time.toFixed(4)).join('; '),
    lightCut: all.map(f => f.lightCut).join('; '),
    steady: all.map(f => f.steady).join('; '),
    shadowCut: all.map(f => f.shadowCut).join('; '),
    opacity: all.map(f => f.opacity).join('; '),
    color: all.map(f => mix(f.flare)).join('; '),
  };
};

/**
 * The ruby's facets' light (white) and shade (black) opacities as the light turns once around over
 * [start, start + length] of the cycle (fractions), the same way the letters' light does (starting and
 * ending above, where it rests).
 */
const getFacetKeyframes = (start: number, length: number) => {
  const steps = 24;
  // the light's direction: the letters' light falls on the walls facing away from it, so it's opposite
  // their light's offset (which starts below): above at rest
  const toward = (u: number) => { const angle = Math.PI / 2 + u * Math.PI * 2; return [-Math.cos(angle), -Math.sin(angle)]; };
  const times = [
    ...(start > 0.001 ? [0] : []),
    ...Array.from({ length: steps + 1 }, (_, k) => start + (k / steps) * length),
    ...(start + length < 0.999 ? [1] : []),
  ];
  times[0] = 0; times[times.length - 1] = 1;
  const uOf = (time: number) => Math.min(1, Math.max(0, (time - start) / length));
  return FACET_NORMALS.map(([nx, ny], k) => {
    const [restColor, restOpacity] = FACET_LIGHT[k];
    const [sx, sy] = toward(0);
    const restFacing = nx * sx + ny * sy;
    // gains keeping the resting light exactly as it is
    const lightGain = restColor === '#ffffff' && restFacing > 0 ? restOpacity / restFacing : RUBY_LIGHT.light;
    const shadeGain = restColor === '#000000' && restFacing < 0 ? restOpacity / -restFacing : RUBY_LIGHT.shade;
    const frames = times.map(time => {
      const [lx, ly] = toward(uOf(time));
      const facing = nx * lx + ny * ly;
      return { light: (lightGain * Math.max(0, facing)).toFixed(3), shade: (shadeGain * Math.max(0, -facing)).toFixed(3) };
    });
    return {
      keyTimes: times.map(t => t.toFixed(4)).join('; '),
      light: frames.map(f => f.light).join('; '),
      shade: frames.map(f => f.shade).join('; '),
      restLight: frames[0].light, restShade: frames[0].shade,
    };
  });
};

/**
 * The little sparkle on the ruby's upper left, varied per button (by its label) so buttons side by side
 * don't flash alike: a slightly different spot (`dx`, `dy`: up to this far, in viewBox units), size
 * (up to `size` larger or smaller) and moment (`delaySeconds`: up to this much later).
 */
const SPARKLE_VARIETY = { dx: 14, dy: 5, size: 0.25, delaySeconds: 3 };
/** A steady pseudo-random 0..1 from a string (the same string, the same number). */
const seedOf = (text: string, salt: number): number => {
  let hash = 2166136261 ^ salt;
  for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return ((hash >>> 0) % 10000) / 10000;
};

const glint = keyframes`
  0%, 70%, 100% { opacity: 0; transform: scale(0.4); }
  80% { opacity: 1; transform: scale(1); }
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
  .glint { transform-box: fill-box; transform-origin: center; animation: ${glint} 4.5s ease-in-out infinite; }
`;

/** The label, for its size and for screen readers: unseen (the SVG draws the etched lettering: see ETCHING). */
const Label = styled.span`
  position: relative;
  color: transparent;
`;

/**
 * The button's face: the frame, panel and lettering (the button itself, and its hover, are the caller's).
 * `isGlinting`: the glint (the sweep, the letters' light and the ruby's facets) plays while true, e.g.
 * while hovered; otherwise it rests (finishing the pass it's in first).
 */
export const PlayButtonFace = ({ look, label, isGlinting = true }: { look: PlayButtonLook; label: string; isGlinting?: boolean }) => {
  const l = PLAY_BUTTON_LOOKS[look];
  // (unique per button: several can be on screen at once, e.g. the game over modal's Yes and No)
  const id = `play-${look}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Where each letter is (once the font has loaded), so each can catch the light as the sweep reaches it
  const measureRef = useRef<SVGTextElement | null>(null);
  const [letters, setLetters] = useState<Array<{ char: string; x: number; orbit: ReturnType<typeof getOrbitKeyframes> }> | null>(null);
  // The ruby's light, turning once while the sweep crosses the word (as its letters' light turns)
  const [facetLight, setFacetLight] = useState<ReturnType<typeof getFacetKeyframes> | null>(null);
  const isOrbit = l.text === 'etched' && ETCHING.glint === 'orbit';
  useLayoutEffect(() => {
    if (!isOrbit) return;
    let isCancelled = false;
    const measure = () => {
      const text = measureRef.current;
      if (isCancelled || !text) return;
      // Each letter's inked height (for orbit.byHeight), relative to the tallest
      const ink = document.createElement('canvas').getContext('2d');
      const heights = Array.from(label).map(char => {
        if (!ink) return 1;
        ink.font = `${ETCHING.fontSize}px 'EnchantedLand', sans-serif`;
        const metrics = ink.measureText(char);
        return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      });
      const tallest = Math.max(...heights, 1);
      const wordStart = text.getStartPositionOfChar(0).x, wordEnd = text.getEndPositionOfChar(label.length - 1).x;
      const turnStart = Math.max(0, getSweepTime(wordStart - SWEEP_BAND / 2));
      const turnLength = Math.min(1 - turnStart, Math.max(0.01, getSweepTime(wordEnd + SWEEP_BAND / 2) - turnStart));
      if (l.jewel && RUBY_LIGHT.isTurning) setFacetLight(getFacetKeyframes(turnStart, turnLength));
      setLetters(Array.from(label).map((char, k) => {
        const x = text.getStartPositionOfChar(k).x;
        return { char, x, orbit: getOrbitKeyframes(heights[k] / tallest, turnStart, turnLength) };
      }));
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
    return () => { isCancelled = true; };
  }, [isOrbit, label]);
  const cycle = `${ETCHING.glintSeconds}s`;

  // The glint plays only while `isGlinting`: its animations (all SVG, on this SVG's own clock) wait
  // at their start, the resting look; when it stops, the pass in progress finishes first
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasStarted = useRef(false);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (isGlinting) {
      if (svg.animationsPaused()) { svg.setCurrentTime(0); svg.unpauseAnimations(); }
      hasStarted.current = true;
      return;
    }
    const rest = () => { svg.pauseAnimations(); svg.setCurrentTime(0); };
    if (!hasStarted.current || svg.animationsPaused()) { rest(); return; }
    const into = svg.getCurrentTime() % ETCHING.glintSeconds, passEnds = SWEEP.moving * ETCHING.glintSeconds;
    const timeout = window.setTimeout(rest, Math.max(0, passEnds - into) * 1000);
    return () => window.clearTimeout(timeout);
  }, [isGlinting]);
  return (
    <>
      <Frame ref={svgRef} viewBox="0 0 386 100" preserveAspectRatio="none" aria-hidden>
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
          <clipPath id={`${id}-clip`}><polygon points={PANEL} /></clipPath>
          {isOrbit && letters?.flatMap((letter, k) => (['light', 'shadow'] as const).map(band => (
            <mask key={`${band}-${k}`} id={`${id}-${band}-band-${k}`} maskUnits="userSpaceOnUse" x={0} y={0} width={386} height={100}>
              <g fontFamily="'EnchantedLand', sans-serif" fontSize={ETCHING.fontSize} textAnchor="start">
                <text x={letter.x} y={ETCHING.y} fill="#fff">{letter.char}</text>
                <text x={letter.x} y={ETCHING.y} fill="#000"
                  transform={band === 'light' ? `translate(0 ${-ETCHING.orbit.rest})` : `translate(0 ${ETCHING.orbit.shadowRest})`}>
                  {letter.char}
                  <animateTransform attributeName="transform" type="translate" values={band === 'light' ? letter.orbit.lightCut : letter.orbit.shadowCut}
                    keyTimes={letter.orbit.keyTimes} dur={cycle} repeatCount="indefinite" />
                </text>
              </g>
            </mask>
          )))}
          {l.text === 'etched' && (
            <linearGradient id={`${id}-lit`} gradientUnits="userSpaceOnUse" x1="120" y1="20" x2="170" y2="80">
              <stop offset="0" stopColor={ETCHING.lit} stopOpacity={ETCHING.litOpacity} />
              <stop offset="0.38" stopColor={ETCHING.lit} stopOpacity={ETCHING.litOpacity} />
              <stop offset="0.5" stopColor={ETCHING.litFlare} stopOpacity={1} />
              <stop offset="0.62" stopColor={ETCHING.lit} stopOpacity={ETCHING.litOpacity} />
              <stop offset="1" stopColor={ETCHING.lit} stopOpacity={ETCHING.litOpacity} />
              <animateTransform attributeName="gradientTransform" type="translate" values={`${SWEEP.from} 0; ${SWEEP.to} 0; ${SWEEP.to} 0`}
                keyTimes={`0; ${SWEEP.moving}; 1`} dur={`${ETCHING.glintSeconds}s`} repeatCount="indefinite" />
            </linearGradient>
          )}
          {l.text === 'etched' && (
            <linearGradient id={`${id}-glint`} gradientUnits="userSpaceOnUse" x1="120" y1="20" x2="170" y2="80">
              <stop offset="0" stopColor="#fff2f2" stopOpacity={0} />
              <stop offset="0.4" stopColor="#ffd9dd" stopOpacity={0} />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
              <stop offset="0.6" stopColor="#ffd9dd" stopOpacity={0} />
              <stop offset="1" stopColor="#fff2f2" stopOpacity={0} />
              {/* sweeps from left of the word to past its right, then waits a moment off to the side */}
              <animateTransform attributeName="gradientTransform" type="translate" values={`${SWEEP.from} 0; ${SWEEP.to} 0; ${SWEEP.to} 0`}
                keyTimes={`0; ${SWEEP.moving}; 1`} dur={`${ETCHING.glintSeconds}s`} repeatCount="indefinite" />
            </linearGradient>
          )}
        </defs>
        {/* The panel (sinks a little when pressed) */}
        <g className="inner">
          <polygon className="panel" points={PANEL} fill={`url(#${id}-panel)`} />
          {l.jewel && (
            <g>
              {PANEL_POINTS.map((p, k) => {
                const q = PANEL_POINTS[(k + 1) % 6], tq = TABLE[(k + 1) % 6], tp = TABLE[k];
                const points = `${p} ${q} ${tq} ${tp}`;
                const [color, opacity] = FACET_LIGHT[k];
                const turning = facetLight?.[k];
                if (!turning) return <polygon key={k} points={points} fill={color} opacity={opacity} />;
                // lit as it faces the turning light, shaded as it faces away
                return (
                  <g key={k}>
                    <polygon points={points} fill="#ffffff" opacity={turning.restLight}>
                      <animate attributeName="opacity" values={turning.light} keyTimes={turning.keyTimes} dur={`${ETCHING.glintSeconds}s`} repeatCount="indefinite" />
                    </polygon>
                    <polygon points={points} fill="#000000" opacity={turning.restShade}>
                      <animate attributeName="opacity" values={turning.shade} keyTimes={turning.keyTimes} dur={`${ETCHING.glintSeconds}s`} repeatCount="indefinite" />
                    </polygon>
                  </g>
                );
              })}
              <polygon points={TABLE.join(' ')} fill="none" stroke="#ff9aa4" strokeOpacity={0.35} strokeWidth={0.8} />
              {PANEL_POINTS.map((p, k) => <line key={k} x1={p[0]} y1={p[1]} x2={TABLE[k][0]} y2={TABLE[k][1]} stroke="#ffb3ba" strokeOpacity={0.3} strokeWidth={0.8} />)}
              {/* a glint flashing on the upper left facet now and then (its spot, size and moment varied per button) */}
              <g transform={`translate(${((seedOf(label, 1) - 0.5) * 2 * SPARKLE_VARIETY.dx).toFixed(1)} ${((seedOf(label, 2) - 0.5) * 2 * SPARKLE_VARIETY.dy).toFixed(1)}) translate(92 35) scale(${(1 + (seedOf(label, 3) - 0.5) * 2 * SPARKLE_VARIETY.size).toFixed(2)}) translate(-92 -35)`}>
                <path className="glint" d="M 92 26 L 94 33 L 101 35 L 94 37 L 92 44 L 90 37 L 83 35 L 90 33 Z" fill="#fff4f4"
                  style={{ animationDelay: `${(-seedOf(label, 4) * SPARKLE_VARIETY.delaySeconds).toFixed(2)}s` }} />
              </g>
            </g>
          )}
          {/* a soft light from above, in place of a hard gloss line */}
          <polygon points={PANEL} fill={`url(#${id}-light)`} />
        </g>
        {/* The etched lettering, with its edges catching the light (inside the panel, so it sinks with it) */}
        {l.text === 'etched' && (
          <g className="inner" fontFamily="'EnchantedLand', sans-serif" fontSize={ETCHING.fontSize} textAnchor="middle">
            {ETCHING.glint === 'orbit' ? null : (
              <>
                <text x={193} y={ETCHING.y + 1.6} fill={ETCHING.glint === 'lit' ? `url(#${id}-lit)` : ETCHING.lit} fillOpacity={ETCHING.glint === 'lit' ? 1 : ETCHING.litOpacity}>{label}</text>
                <text x={193} y={ETCHING.y - 1.4} fill={ETCHING.shadow}>{label}</text>
              </>
            )}
            {!(isOrbit && letters) && <text x={193} y={ETCHING.y} fill={ETCHING.fill}>{label}</text>}
            {/* (for measuring where each letter is) */}
            {isOrbit && <text ref={measureRef} x={193} y={ETCHING.y} opacity={0}>{label}</text>}
            {/* in each letter's cut: the light, swinging around and brightening as the sweep passes, then
                resting on the lower walls; and the shadow, opposite it */}
            {isOrbit && letters?.map((letter, k) => (
              <g key={k}>
                {/* held steady: shifted toward the light so the dark core stays put (the masks move with it) */}
                <animateTransform attributeName="transform" type="translate" values={letter.orbit.steady} keyTimes={letter.orbit.keyTimes} dur={cycle} repeatCount="indefinite" />
                <text x={letter.x} y={ETCHING.y} textAnchor="start" fill={ETCHING.fill}>{letter.char}</text>
                <rect x={0} y={0} width={386} height={100} fill={ETCHING.lit} fillOpacity={ETCHING.litOpacity} mask={`url(#${id}-light-band-${k})`}>
                  <animate attributeName="fill-opacity" values={letter.orbit.opacity} keyTimes={letter.orbit.keyTimes} dur={cycle} repeatCount="indefinite" />
                  <animate attributeName="fill" values={letter.orbit.color} keyTimes={letter.orbit.keyTimes} dur={cycle} repeatCount="indefinite" />
                </rect>
                <rect x={0} y={0} width={386} height={100} fill={ETCHING.shadow} mask={`url(#${id}-shadow-band-${k})`} />
              </g>
            ))}
            <text x={193} y={ETCHING.y} fill="none" stroke="#ffc2c8" strokeOpacity={ETCHING.rim} strokeWidth={0.9}>{label}</text>
            {(ETCHING.glint === 'stroke' || (ETCHING.glint === 'orbit' && ETCHING.sweepToo)) && <text x={193} y={ETCHING.y} fill="none" stroke={`url(#${id}-glint)`} strokeWidth={2.2}>{label}</text>}
          </g>
        )}
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
      <Label className="label">{label}</Label>
    </>
  );
};

/** The glow on hover, per look (for the caller's button). */
export const getPlayButtonGlow = (look: PlayButtonLook): string => PLAY_BUTTON_LOOKS[look].glow;

/** How bright the buttons are (1: as drawn): dimmed so they don't compete with the titles; a little brighter on hover. */
export const PLAY_BUTTON_BRIGHTNESS = { rest: 0.75, hover: 0.88 };
