// TeacherCatch.tsx
// The teacher's visits at dawn (Game: passLantern, beginCatchScene; timing: teacherCatchConfig.ts). On a
// risky turn nobody was caught on, a lantern's light passes the weaker wizard's doorway; on a catch, the
// light floods through the caught wizard's doorway, they're lifted, struggle in the air (casting in a
// flurry: CastFlurry) and are dragged out (PlayerComponent), and "Caught!" stamps on.
import styled, { css, keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../../DataClasses/store';
import { HARDCODED_SYMBOLS } from '../../DataClasses/PlacedSpells/HardCodedSymbols';
import { CAST_FLURRY, CATCH_DIM, CATCH_LAYERS, CATCH_SCENE, CATCH_TIMES, LANTERN_PASS } from './teacherCatchConfig';

/**
 * The doorways (the open arches behind each wizard, in cqw of the game's width): where the lantern's light
 * shows, its color (r, g, b: blood red), and its blur (cqw).
 */
export const DOORWAYS = { self: { left: 5.5 }, rival: { right: 5.8 }, width: 13, top: 17, height: 22, light: '190, 12, 12', blur: 1.6 };

// A lantern carried past, beyond the doorway: its glow crossing the opening, and its light spilling out
// over the floor in front, brightening and fading as it passes
const passAcross = keyframes`
  0% { transform: translateX(-60%); opacity: 0; }
  30% { opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translateX(60%); opacity: 0; }
`;
const spillPass = keyframes`
  0%, 100% { opacity: 0; }
  45%, 60% { opacity: 1; }
`;
// The catch: the light swelling until it fills the doorway, and staying
const flood = keyframes`
  0% { opacity: 0; transform: scale(0.6); }
  70% { opacity: 1; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1.15); }
`;

// (and once the caught wizard is dragged off: fading away as they go)
const floodFade = keyframes`
  to { opacity: 0; }
`;

const Doorway = styled.div<{ $side: 'self' | 'rival'; $isFading?: boolean }>`
  position: absolute;
  ${props => props.$side === 'self' ? `left: ${DOORWAYS.self.left}cqw;` : `right: ${DOORWAYS.rival.right}cqw;`}
  top: ${DOORWAYS.top}cqw;
  width: ${DOORWAYS.width}cqw;
  height: ${DOORWAYS.height}cqw;
  /* over the background, beneath the wizards; a catch's, over the darkness that falls (CATCH_DIM), still beneath its wizard */
  z-index: ${props => props.$isFading && CATCH_DIM.isOn ? CATCH_LAYERS.doorway : 1};
  pointer-events: none;
  mix-blend-mode: screen; /* light: brightening what's there */
  filter: blur(${DOORWAYS.blur}cqw); /* (one soft glow, not its two shapes) */
  ${props => props.$isFading && css`animation: ${floodFade} ${CATCH_SCENE.dragSeconds}s ease-in ${CATCH_TIMES.drag}s forwards;`}
`;

const Glow = styled.div<{ $isFlood: boolean; $seconds: number }>`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 45% 60% at 50% 60%, rgba(${DOORWAYS.light}, 0.95) 0%, rgba(${DOORWAYS.light}, 0.35) 55%, rgba(${DOORWAYS.light}, 0) 100%);
  opacity: 0;
  ${props => props.$isFlood
    ? css`animation: ${flood} ${props.$seconds}s ease-in forwards;`
    : css`animation: ${passAcross} ${props.$seconds}s ease-in-out forwards;`}
`;

const Spill = styled.div<{ $isFlood: boolean; $seconds: number }>`
  position: absolute;
  left: -40%;
  right: -40%;
  top: 80%;
  height: 45%;
  background: radial-gradient(ellipse 50% 50% at 50% 30%, rgba(${DOORWAYS.light}, 0.6) 0%, rgba(${DOORWAYS.light}, 0) 100%);
  opacity: 0;
  ${props => props.$isFlood
    ? css`animation: ${flood} ${props.$seconds}s ease-in forwards;`
    : css`animation: ${spillPass} ${props.$seconds}s ease-in-out forwards;`}
`;

/** The lantern's light in the doorways: passing (a risky turn) or flooding (a catch). */
export function LanternLight() {
  const snap = useSnapshot(rootGameStore);
  const pass = snap.getLanternPass();
  const scene = snap.getCatchScene();
  return (
    <>
      {LANTERN_PASS.isLightOn && pass && !scene && (
        <Doorway key={pass.id} $side={pass.side}>
          <Glow $isFlood={false} $seconds={LANTERN_PASS.seconds} />
          <Spill $isFlood={false} $seconds={LANTERN_PASS.seconds} />
        </Doorway>
      )}
      {scene && scene.caught.map(side => (
        <Doorway key={`${scene.id}:${side}`} $side={side} $isFading={true}>
          <Glow $isFlood={true} $seconds={CATCH_SCENE.floodSeconds} />
          <Spill $isFlood={true} $seconds={CATCH_SCENE.floodSeconds} />
        </Doorway>
      ))}
    </>
  );
}

const stampOn = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(2.6); }
  35% { opacity: 1; transform: translate(-50%, -50%) scale(0.92); }
  45% { transform: translate(-50%, -50%) scale(1.04); }
  55%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Stamp = styled.div`
  position: absolute;
  left: 50%;
  top: 26cqw;
  z-index: 45;
  pointer-events: none;
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 15cqw;
  line-height: 1;
  color: #8a0303; /* blood red */
  -webkit-text-stroke: 0.12cqw #2a0000;
  text-shadow: 0 0 1.2cqw rgba(170, 0, 0, 0.55), 0 0 2.5cqw rgba(0, 0, 0, 0.85), 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.9);
  opacity: 0;
  animation: ${stampOn} ${CATCH_SCENE.stampSeconds}s cubic-bezier(0.2, 0.8, 0.3, 1) ${CATCH_TIMES.stamp}s forwards;
`;

const darken = keyframes`
  from { opacity: 0; }
  to { opacity: ${CATCH_DIM.opacity}; }
`;

const Darkness = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${CATCH_LAYERS.dim};
  pointer-events: none;
  background: #000;
  opacity: 0;
  animation: ${darken} ${CATCH_DIM.fadeSeconds}s ease-in ${CATCH_DIM.fromSeconds}s forwards;
`;

/** A catch: the scene darkening once the other wizard has got away (CATCH_DIM), all but the caught. */
export function CatchDarkness() {
  const snap = useSnapshot(rootGameStore);
  const scene = snap.getCatchScene();
  if (!scene || !CATCH_DIM.isOn) return null;
  return <Darkness key={scene.id} />;
}

/** "Caught!", stamped on once the caught wizard has been dragged away. */
export function CaughtStamp() {
  const snap = useSnapshot(rootGameStore);
  const scene = snap.getCatchScene();
  if (!scene) return null; // (kept until the game over card, fading in, covers it)
  return <Stamp key={scene.id}>{CATCH_SCENE.stampText}</Stamp>;
}

// --- The caught wizard's flurry of spells: the NPC's symbols, drawn large in gold by their own wand (the IK
// aiming at the point being drawn: getFlurryWandPoint), overlapping, each fading as the next is drawn
type Point = { x: number; y: number };
type FlurryCast = { points: Point[]; x: number; y: number; size: number; turn: number; delay: number };
const SYMBOLS = [...HARDCODED_SYMBOLS.values()];

/** A cast's symbol's points turned about its middle (as it's shown), in its 0-to-1 box. */
const turnPoints = (points: Point[], turn: number): Point[] => {
  const angle = turn * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return points.map(({ x, y }) => ({ x: 0.5 + (x - 0.5) * cos - (y - 0.5) * sin, y: 0.5 + (x - 0.5) * sin + (y - 0.5) * cos }));
};

/**
 * The flurry of a catch scene, for the caught wizard on this side (the same for its picture and its wand):
 * each cast's symbol, its box (x, y: its corner, % of the frame; size: % of the frame's width), turn, and
 * when it's drawn (seconds into the scene). Kept per scene.
 */
const flurries = new Map<string, FlurryCast[]>();
export const getFlurryCasts = (sceneId: number, side: 'self' | 'rival'): FlurryCast[] => {
  const key = `${sceneId}:${side}`;
  let casts = flurries.get(key);
  if (!casts) {
    const count = Math.round(CAST_FLURRY.perSecond * CATCH_SCENE.struggleSeconds);
    const from = CATCH_TIMES.lift + CATCH_SCENE.liftSeconds * 0.7;
    const area = getCastArea(side);
    casts = Array.from({ length: count }, (_, k) => {
      // (sizes pushed toward the extremes: tiny ones and huge ones, chaotic; each still square)
      const r = Math.random(), spread = r < 0.5 ? 0.5 * (2 * r) ** 2 : 1 - 0.5 * (2 * (1 - r)) ** 2;
      const size = CAST_FLURRY.size[0] + (k % 2 ? spread : 1 - spread) * (CAST_FLURRY.size[1] - CAST_FLURRY.size[0]);
      const turn = (Math.random() * 2 - 1) * CAST_FLURRY.turn;
      return {
        points: turnPoints(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], turn),
        // (in front of them and above, where the raised wand can reach: toward the hall's middle)
        // (anywhere in the casting area: CAST_FLURRY.area, the whole symbol inside it)
        x: area.x[0] + Math.random() * Math.max(0, area.x[1] - area.x[0] - size),
        y: area.y[0] + Math.random() * Math.max(0, area.y[1] - area.y[0] - size),
        size,
        turn,
        delay: from + k / CAST_FLURRY.perSecond + Math.random() * 0.12,
      };
    });
    flurries.set(key, casts);
  }
  return casts;
};

/**
 * The casting area (CAST_FLURRY.area) in the caught wizard's frame's units (% of its width; it's square):
 * measured against the game (the frame's nearest container: its cqw), as the scene begins.
 */
const getCastArea = (side: 'self' | 'rival'): { x: [number, number]; y: [number, number] } => {
  const frame = document.querySelector(`[data-cast-frame="${side}"]`);
  let game = frame?.parentElement ?? null;
  while (game && getComputedStyle(game).containerType === 'normal') game = game.parentElement;
  if (!frame || !game) return { x: [0, 100], y: [-100, 100] };
  const f = frame.getBoundingClientRect(), g = game.getBoundingClientRect();
  const toX = (at: number) => (g.x + at * g.width - f.x) / f.width * 100, toY = (at: number) => (g.y + at * g.height - f.y) / f.width * 100;
  const across = CAST_FLURRY.area[side];
  return { x: [toX(across[0]), toX(across[1])], y: [toY(CAST_FLURRY.area.y[0]), toY(CAST_FLURRY.area.y[1])] };
};

/** A point along a symbol's strokes (progress: 0 at its start, 1 at its end, by length). */
const pointAlong = (points: Point[], progress: number): Point => {
  const lengths = points.slice(1).map((p, k) => Math.hypot(p.x - points[k].x, p.y - points[k].y));
  let left = progress * lengths.reduce((sum, length) => sum + length, 0);
  for (let k = 0; k < lengths.length; k++) {
    if (left <= lengths[k]) { const t = lengths[k] ? left / lengths[k] : 0; return { x: points[k].x + (points[k + 1].x - points[k].x) * t, y: points[k].y + (points[k + 1].y - points[k].y) * t }; }
    left -= lengths[k];
  }
  return points[points.length - 1];
};

/**
 * Where the caught wizard's wand points, `seconds` into the scene: the point of the symbol being drawn (on
 * the page), or null between symbols (it flails then).
 */
export const getFlurryWandPoint = (sceneId: number, side: 'self' | 'rival', seconds: number): Point | null => {
  const cast = getFlurryCasts(sceneId, side).find(c => seconds >= c.delay && seconds <= c.delay + CAST_FLURRY.drawSeconds);
  const frame = document.querySelector(`[data-cast-frame="${side}"]`);
  if (!cast || !frame) return null;
  const rect = frame.getBoundingClientRect();
  const at = pointAlong(cast.points, (seconds - cast.delay) / CAST_FLURRY.drawSeconds);
  const size = cast.size / 100 * rect.width;
  return { x: rect.x + cast.x / 100 * rect.width + at.x * size, y: rect.y + cast.y / 100 * rect.height + at.y * size };
};

const CAST_SECONDS = CAST_FLURRY.drawSeconds + CAST_FLURRY.holdSeconds + CAST_FLURRY.fadeSeconds;
const castPct = (seconds: number) => `${(seconds / CAST_SECONDS * 100).toFixed(1)}%`;
const symbolCast = keyframes`
  0% { opacity: 1; stroke-dashoffset: 1; stroke: #ffe58a; }
  ${castPct(CAST_FLURRY.drawSeconds)} { stroke-dashoffset: 0; stroke: #ffe58a; opacity: 1; }
  ${castPct(CAST_FLURRY.drawSeconds + CAST_FLURRY.holdSeconds)} { stroke: #ffd36a; opacity: 1; }
  100% { stroke-dashoffset: 0; stroke: #c2412a; opacity: 0; }
`;
// (every symbol drawn over the whole frame, in its units: one scale, so their lines are all the same width)
const SymbolSvg = styled.svg<{ $delay: number }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 0 0.15cqw rgba(255, 236, 160, 0.9)) drop-shadow(0 0 0.6cqw rgba(255, 196, 70, 0.55));
  polyline {
    fill: none;
    stroke-width: 0.85; /* (in the frame's units, 0 to 100) */
    stroke-linecap: round;
    stroke-linejoin: miter; /* (sharp corners: no blobs where a small symbol turns) */
    stroke-miterlimit: 3;
    stroke-dasharray: 1;
    opacity: 0;
    animation: ${symbolCast} ${CAST_SECONDS}s linear ${props => props.$delay}s 1 forwards;
  }
`;

/**
 * Placed over the caught wizard (in a frame the size of its avatar: data-cast-frame, for its wand): the
 * spells they cast in a flurry while held in the air, drawn large in gold before them, overlapping.
 */
export function CastFlurry({ side }: { side: 'self' | 'rival' }) {
  const snap = useSnapshot(rootGameStore);
  const scene = snap.getCatchScene();
  if (!scene || !scene.caught.includes(side)) return null;
  return <>{getFlurryCasts(scene.id, side).map((cast, k) => (
    <SymbolSvg key={`${scene.id}:${k}`} viewBox='0 0 100 100' $delay={cast.delay} aria-hidden>
      <polyline points={cast.points.map(p => `${cast.x + p.x * cast.size},${cast.y + p.y * cast.size}`).join(' ')} pathLength={1} />
    </SymbolSvg>
  ))}</>;
}
