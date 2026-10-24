import { useEffect, useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { BIRDSONG } from '../../DataClasses/AudioHandler/AudioHandler';
import { GameClock } from '../../DataClasses/GameClock/GameClock';
import { rootGameStore } from '../../DataClasses/store';

/**
 * The dawn's birds, from when the birdsong starts (BIRDSONG.fromTurn): a few flying across each window's sky
 * (`perWindow`, each crossing in `crossSeconds` then gone a while: one pass every `cycleSeconds`), and now
 * and then one landing on a window's sill (`sillWindows`: all four; one at a time
 * each), one every `landEverySeconds` among them, staying `perchSeconds` in all (landing and leaving included).
 * All of them outside, in the windows' skies: the wall hides them beyond the openings. Sizes in cqw.
 */
export const DAWN_BIRDS = {
  color: '#1a1512',
  perWindow: 2,
  flySize: 1.8,
  crossSeconds: [4, 7],
  cycleSeconds: [10, 20],
  sillWindows: [0, 1, 2, 3],
  sillTop: 11.9, // (where a perched bird's feet rest: from the sky's top)
  perchSize: 2.2,
  landEverySeconds: [5, 12],
  perchSeconds: 9,
};

// (a window's sky: 9cqw wide, StarrySkyComponent)
const SKY_WIDTH = 9;
const between = ([from, to]: number[]) => from + Math.random() * (to - from);

/** Whether the birds are out: the birdsong's hour. */
const useIsBirdsOut = () => {
  const snap = useSnapshot(rootGameStore);
  return Math.round(snap.getMinuteAngleAcc() / GameClock.MINUTE_INCREMENT_ANGLE) >= BIRDSONG.fromTurn;
};

const flap = keyframes`
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(-0.5); }
`;

/** A bird in flight: two wings (it flaps). */
const FlyingShape = ({ size }: { size: number }) => (
  <FlapSvg viewBox='0 0 20 10' style={{ width: `${size}cqw` }}>
    <path d='M0 4 Q5 0 10 5 Q15 0 20 4' />
  </FlapSvg>
);

const FlapSvg = styled.svg`
  display: block;
  overflow: visible;
  transform-origin: 50% 50%;
  animation: ${flap} 0.32s ease-in-out infinite;
  path { fill: none; stroke: ${DAWN_BIRDS.color}; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
`;

// A sky's bird: across the window, then out of sight until its next pass (the crossing's share of the cycle)
const SkyBird = styled.div<{ $top: number; $cycle: number; $crossShare: number; $delay: number; $isLeftward: boolean }>`
  position: absolute;
  left: 0;
  top: ${props => props.$top}%;
  ${props => css`
    animation: ${keyframes`
      0% { transform: translate(-2cqw, 0); }
      ${props.$crossShare}% { transform: translate(11cqw, -1.5cqw); }
      100% { transform: translate(11cqw, -1.5cqw); }
    `} ${props.$cycle}s linear ${props.$delay}s infinite ${props.$isLeftward ? 'reverse' : 'normal'} both;
  `}
`;

/** The birds flying across a window's sky (inside it: the window frames them). */
export const SkyBirds = () => {
  const isOut = useIsBirdsOut();
  const birds = useMemo(() => Array.from({ length: DAWN_BIRDS.perWindow }).map((_, i) => {
    const cycle = between(DAWN_BIRDS.cycleSeconds);
    return {
      id: i,
      top: 15 + Math.random() * 45,
      cycle,
      crossShare: Math.round(between(DAWN_BIRDS.crossSeconds) / cycle * 100),
      delay: Math.random() * cycle,
      isLeftward: Math.random() < 0.5,
      size: DAWN_BIRDS.flySize * (0.7 + Math.random() * 0.5),
    };
  }), []);
  if (!isOut) return null;
  return <>{birds.map(b => (
    <SkyBird key={b.id} $top={b.top} $cycle={b.cycle} $crossShare={b.crossShare} $delay={b.delay} $isLeftward={b.isLeftward}>
      <FlyingShape size={b.size} />
    </SkyBird>
  ))}</>;
};

// A sill's bird: flying in from above and aside, perched (pecking now and then), then off the other way
const LAND = 14, LEAVE = 86; // (% of its stay)
const visit = keyframes`
  0% { transform: translate(calc(var(--from) * 6cqw), -5cqw); opacity: 0; }
  4% { opacity: 1; }
  ${LAND}% { transform: translate(0, 0); }
  ${LEAVE}% { transform: translate(0, 0); opacity: 1; }
  96% { opacity: 1; }
  100% { transform: translate(calc(var(--from) * -7cqw), -6cqw); opacity: 0; }
`;
const asFlyer = keyframes`
  0%, ${LAND - 1}% { opacity: 1; }
  ${LAND}%, ${LEAVE - 1}% { opacity: 0; }
  ${LEAVE}%, 100% { opacity: 1; }
`;
const asPercher = keyframes`
  0%, ${LAND - 1}% { opacity: 0; }
  ${LAND}%, ${LEAVE - 1}% { opacity: 1; }
  ${LEAVE}%, 100% { opacity: 0; }
`;
const peck = keyframes`
  0%, 30%, 40%, 70%, 80%, 100% { transform: rotate(0deg); }
  35%, 75% { transform: rotate(18deg); }
`;

const SillBird = styled.div<{ $left: number; $from: number; $isFacingLeft: boolean }>`
  position: absolute;
  left: ${props => props.$left}cqw;
  top: ${DAWN_BIRDS.sillTop - DAWN_BIRDS.perchSize * 0.8}cqw;
  width: ${DAWN_BIRDS.perchSize}cqw;
  aspect-ratio: 20 / 16;
  pointer-events: none;
  --from: ${props => props.$from};
  animation: ${visit} ${DAWN_BIRDS.perchSeconds}s ease-in-out both;
  > * { position: absolute; inset: 0; ${props => props.$isFacingLeft && 'scale: -1 1;'} }
  > .flyer { display: flex; align-items: center; justify-content: center; animation: ${asFlyer} ${DAWN_BIRDS.perchSeconds}s step-end both; }
  > .percher { animation: ${asPercher} ${DAWN_BIRDS.perchSeconds}s step-end both; }
  .percher svg { width: 100%; height: 100%; overflow: visible; fill: ${DAWN_BIRDS.color}; }
  .percher g { transform-origin: 55% 75%; animation: ${peck} 3s ease-in-out 1.6s infinite; }
`;

/** A bird perched: body, head and beak (pecking), tail and legs. */
const PerchedShape = () => (
  <svg viewBox='0 0 20 16'>
    <g>
      <ellipse cx='10' cy='10' rx='6' ry='3.8' />
      <circle cx='15' cy='6.3' r='2.7' />
      <polygon points='17.4,5.6 20,6.5 17.4,7.3' />
    </g>
    <polygon points='5,8.5 0,7 1.2,11.5' />
    <path d='M9 13.4 L8.6 16 M11.2 13.4 L11.4 16' stroke={DAWN_BIRDS.color} strokeWidth='0.6' />
  </svg>
);

type Visit = { id: number; left: number; from: number; isFacingLeft: boolean };

/** The birds landing on a window's sill now and then (inside its sky: one at a time). */
export const SillBirds = ({ index }: { index: number }) => {
  const isOut = useIsBirdsOut() && DAWN_BIRDS.sillWindows.includes(index);
  const [visit, setVisit] = useState<Visit | null>(null);
  useEffect(() => {
    if (!isOut) { setVisit(null); return; }
    let nextId = 0, timer = 0;
    // (each sill its share of the landings: one every landEverySeconds among them all)
    const wait = () => between(DAWN_BIRDS.landEverySeconds) * DAWN_BIRDS.sillWindows.length * 1000;
    const land = () => {
      const from = Math.random() < 0.5 ? -1 : 1;
      setVisit({ id: ++nextId, left: SKY_WIDTH / 2 - DAWN_BIRDS.perchSize / 2 + (Math.random() - 0.5) * 4, from, isFacingLeft: from > 0 });
      timer = window.setTimeout(() => { setVisit(null); timer = window.setTimeout(land, wait()); }, DAWN_BIRDS.perchSeconds * 1000);
    };
    timer = window.setTimeout(land, wait() * Math.random());
    return () => window.clearTimeout(timer);
  }, [isOut]);
  if (!visit) return null;
  return (
    <SillBird key={visit.id} $left={visit.left} $from={visit.from} $isFacingLeft={visit.isFacingLeft}>
      <div className='flyer'><FlyingShape size={DAWN_BIRDS.flySize} /></div>
      <div className='percher'><PerchedShape /></div>
    </SillBird>
  );
};
