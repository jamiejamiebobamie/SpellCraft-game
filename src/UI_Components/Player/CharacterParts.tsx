import styled, { keyframes, css } from 'styled-components';
import { useLayoutEffect, useRef, useState } from 'react';
import { InferenceString } from '../../DataClasses/types';

export const INTRO_WALK_ANIM_TIME = 12; // in seconds

export const bob = keyframes`
  0%, 100% { transform: translateY(0px) var(--extra-transform, ); }
  50% { transform: translateY(-4px) var(--extra-transform, ); }
`;

export const sway = keyframes`
  0%, 100% { transform: rotate(0deg) var(--extra-transform, ); }
  50% { transform: rotate(3deg) var(--extra-transform, ); }
`;

export const shift = keyframes`
  0%, 100% { transform: translateX(0px) var(--extra-transform, ); }
  50% { transform: translateX(2px) var(--extra-transform, ); }
`;

export const shake = keyframes`
  10%, 90% { transform: translate3d(-.25cqw, 0, 0) var(--extra-transform, ); }
  20%, 80% { transform: translate3d(.5cqw, 0, 0) var(--extra-transform, ); }
  30%, 50%, 70% { transform: translate3d(-.75cqw, 0, 0) var(--extra-transform, ); }
  40%, 60% { transform: translate3d(.75cqw, 0, 0) var(--extra-transform, ); }
`;

export const ceremonialMarch = keyframes`
  0%, 50%, 100% {
    transform: translateY(0px);
  }
  25%, 75% {
    transform: translateY(-5px); /* Distinct, proud step height lifting the torso */
  }
`;

// Wand Arm Death Anim
export const armFlingUp = keyframes`
  0% { transform: rotate(var(--part-angle, 0deg)); }
  100% { transform: rotate(-75deg); } /* Forces arm to point straight "up" skyward */
`;

const flashDamage = keyframes`
  0% { opacity: 0; }
  15% { opacity: 0.6; }
  100% { opacity: 0; }
`;

/**
 * A wizard's death: they crumple, and stay down in a heap. The knees give (the body sinking into itself:
 * buckle, its height and width, from the floor; by buckleAt of the fall), then they slump over onto the
 * floor (toppleDeg, landing at landAt, a small bounce: bounceDeg back; lying low: lying, its length and its
 * thickness, now across the floor, so the heap lies flat rather than bulging up; the robe's flared hem drawn in
 * as it lands (hem: the robe tipped away from us at the hem, tiltDeg, seen in perspective, cqw: so it narrows to the
 * hem rather than flaring); settling down onto it, centered in their spotlight: drop, cqw across
 * and down, as tipping over lifts their back off the floor) and settle (seconds: the whole fall).
 * Their head droops onto the pile (headDeg), the far arm goes limp at the sleeve (arm: its turn, deg, about its
 * joint, where the forearm meets the cuff: the top right of its picture), and the wand arm gives a last
 * spasm up (spasmDeg) before flopping limp (limpDeg; the forearm and hand hanging: forearmDeg, handDeg).
 * The heap's shadow (shadow: its width and height, cqw, how far it reaches past the feet, its darkness).
 * style: 'sideways', the slump over described above; 'backward', falling away from us instead, about their feet
 * (back: how far, deg, seen in perspective, cqw: the closer, the stronger; a small bounce; where the far arm goes
 * limp, deg; the shadow lying back from their feet, lift, cqw; turning about their feet, feetAt: % down the
 * avatar's box, where the hem meets the floor, below the box's bottom), staying in their spotlight.
 */
export const DEATH_POSE = {
  style: 'backward' as 'backward' | 'sideways',
  back: { deg: 62, perspective: 40, bounceDeg: 6, armDeg: -40, shadowLift: 0, feetAt: 122 },
  seconds: 3, buckle: { height: 0.72, width: 1.1 }, buckleAt: 0.3, toppleDeg: 90, landAt: 0.78, bounceDeg: 6, drop: { x: -5.9, y: 2.6 },
  hem: { tiltDeg: -25, perspective: 25 },
  lying: { height: 0.86, width: 0.78 },
  headDeg: 32, arm: { joint: '88% 5%', deg: -130 }, spasmDeg: -75, limpDeg: 28, forearmDeg: 35, handDeg: 25,
  shadow: { width: 17, height: 2.6, reach: -5.9, opacity: 0.55 },
};

// Body Death Anim: buckling, then slumping over onto the floor, and staying there (squashed from the floor
// before it's turned, so it stays a heap, not a stretched board)
const pct = (at: number) => `${(at * 100).toFixed(1)}%`;
const { buckle, buckleAt, toppleDeg, landAt, bounceDeg, drop, lying, back } = DEATH_POSE;
export const isFallingBackward = DEATH_POSE.style === 'backward';
const down = (share: number) => `translate(${drop.x * share}cqw, ${drop.y * share}cqw)`;
// (backward: tipping away from us about the feet, in perspective: the buckle, then over, a bounce, and down)
const away = (deg: number) => `perspective(${back.perspective}cqw) rotateX(${deg}deg)`;
const fallBackward = keyframes`
  0% { transform: ${away(0)} scale(1, 1); animation-timing-function: ease-in; }
  ${pct(buckleAt)} { transform: ${away(4)} scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-in; }
  ${pct(landAt)} { transform: ${away(back.deg)} scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-out; }
  ${pct(landAt + (1 - landAt) * 0.4)} { transform: ${away(back.deg - back.bounceDeg)} scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-in-out; }
  100% { transform: ${away(back.deg)} scale(${buckle.width}, ${buckle.height}); }
`;
const fallSideways = keyframes`
  0% { transform: ${down(0)} rotate(0deg) scale(1, 1); animation-timing-function: ease-in; }
  ${pct(buckleAt)} { transform: ${down(0)} rotate(4deg) scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-in; }
  ${pct(landAt)} { transform: ${down(1)} rotate(${toppleDeg}deg) scale(${lying.width}, ${lying.height}); animation-timing-function: ease-out; }
  ${pct(landAt + (1 - landAt) * 0.4)} { transform: ${down(0.85)} rotate(${toppleDeg - bounceDeg}deg) scale(${lying.width * 1.04}, ${lying.height * 0.98}); animation-timing-function: ease-in-out; }
  100% { transform: ${down(1)} rotate(${toppleDeg}deg) scale(${lying.width}, ${lying.height}); }
`;

// The head drooping onto the pile, and the far arm draping, as they come down
const headDroop = keyframes`
  to { transform: rotate(${DEATH_POSE.headDeg}deg) translateY(0.4cqw) var(--extra-transform, ); }
`;
const armDrape = keyframes`
  to { transform: rotate(${isFallingBackward ? DEATH_POSE.back.armDeg : DEATH_POSE.arm.deg}deg) var(--extra-transform, ); }
`;
// The wand arm: a last spasm up, then flopping limp
const armSpasmAndFlop = keyframes`
  0% { transform: rotate(var(--part-angle, 0deg)); }
  20% { transform: rotate(${DEATH_POSE.spasmDeg}deg); animation-timing-function: ease-in; }
  100% { transform: rotate(${DEATH_POSE.limpDeg}deg); }
`;
export const fallAndSquash = isFallingBackward ? fallBackward : fallSideways;
const deadPart = (frames: ReturnType<typeof keyframes>, delay: number, seconds: number) => css`
  animation: ${frames} ${seconds}s ease-in-out ${delay}s forwards;
`;

// Intro anim
export const walkIn = keyframes`
  0% {
    transform: translateX(calc(var(--walk-direction, 1) * -100vw));
    filter: brightness(.1);
  }
  60% {
    filter: brightness(.1);
  }
  100% {
    transform: translateX(0);
    filter: brightness(1);
  }
`;

export const Damageable = styled.div<{
  $healthDiff: number;
  $isDead: boolean;
  $isDoneWithIntroWalk: boolean;
  $direction: number;
  $isBeginIntroWalk: boolean;
}>`
  width: 100%;
  height: 100%;
  transform-origin: bottom center;
  /* Before the walk begins: waiting offstage in the dark, with no animation yet (a paused one could
     still run on Safari, so the wizards arrived before the walk) */
  ${props => !props.$isDoneWithIntroWalk && !props.$isBeginIntroWalk ? css`
    transform: translateX(calc(var(--walk-direction, 1) * -100vw));
    filter: brightness(.1);
  ` : !props.$isDoneWithIntroWalk ? css`
    will-change: transform, filter;
    animation: ${walkIn} ${INTRO_WALK_ANIM_TIME}s cubic-bezier(0.1, 0.5, 0.3, 1) forwards;
  ` : props.$isDead ? css`
    ${isFallingBackward && `transform-origin: 50% ${DEATH_POSE.back.feetAt}%;`}
    animation: ${fallAndSquash} ${DEATH_POSE.seconds}s linear forwards;
  ` : props.$healthDiff < 0 && css`
    animation: ${shake} .75s cubic-bezier(.36,.07,.19,.97) both;
  `}

  animation-play-state: ${props => props.$isBeginIntroWalk ? 'running' : 'paused'};
`;

interface PartProps {
  $src: string;
  $healthDiff: number;
  $delay?: string;
  $speed?: string;
  $angle?: number;
}

// All frequently changing / unique props mapped directly to CSS Variables
export const CharacterPart = styled.div.attrs<PartProps>(props => ({
  style: {
    backgroundImage: `url(${props.$src})`,
    '--part-src': `url(${props.$src})`,
    '--part-speed': props.$speed || '3.5s',
    '--part-delay': props.$delay || '0s',
    '--part-angle': props.$angle !== undefined ? `${props.$angle}deg` : '0deg'
  }
})) <PartProps>`
  position: absolute;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  transform-style: preserve-3d; 
  will-change: transform;

  /* Set default animation durations using the variables */
  animation-duration: var(--part-speed);
  animation-delay: var(--part-delay);

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: ${props => props.$healthDiff < 0 ? '#ff0000' : '#3bed8e'};
    pointer-events: none;
    opacity: 0;

    mask-image: var(--part-src);
    mask-size: cover;
    mask-position: center;
    mask-repeat: no-repeat;
    -webkit-mask-image: var(--part-src);
    -webkit-mask-size: cover;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;

    ${props => props.$healthDiff != 0 && css`
      animation: ${flashDamage} 0.35s ease-out;
    `}
  }
`;

// The fallen robe's hem drawing in (DEATH_POSE.hem): the robe's picture, on a layer of its own, tipped away at the hem
const hemDrawIn = keyframes`
  from { transform: perspective(${DEATH_POSE.hem.perspective}cqw) rotateX(0deg); }
  to { transform: perspective(${DEATH_POSE.hem.perspective}cqw) rotateX(${DEATH_POSE.hem.tiltDeg}deg); }
`;

export const AvatarRobe = styled(CharacterPart) <{ $isBeginIntroWalk: boolean; $isDoneWithIntroWalk: boolean; $isDead?: boolean }>`
  top: 7.75cqw;
  left: 2.4cqw;
  width: 13cqw;
  aspect-ratio: 544/657; 
  transform-origin: bottom center;
  
  /* If walking, play the heavy march loop over 1.25s chunks. Otherwise, breathe normally. */
  animation-name: ${props => !props.$isDoneWithIntroWalk ? ceremonialMarch : bob};
  animation-duration: ${props => !props.$isDoneWithIntroWalk ? `${INTRO_WALK_ANIM_TIME / 4}s` : 'var(--part-speed)'};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;

  animation-play-state: ${props => props.$isBeginIntroWalk ? 'running' : 'paused'};

  /* Fallen: the robe's picture drawn on a layer of its own (so only it tips, not the head and arms on it) */
  ${props => props.$isDead && !isFallingBackward && css`
    background-image: none !important;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--part-src) center / cover no-repeat;
      transform-origin: 50% 0%;
      animation: ${hemDrawIn} ${DEATH_POSE.seconds * (1 - DEATH_POSE.buckleAt)}s ease-in-out ${DEATH_POSE.seconds * DEATH_POSE.buckleAt}s forwards;
    }
  `}
`;

const shadowPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(0.85);
    opacity: 0.35;
  }
`;

export const FloorShadow = styled.div<{ $isHide: boolean }>`
  position: absolute;
  z-index: -1;
  top: 21.5cqw;
  left: 5.5cqw;
  
  width: 10cqw; 
  height: 2cqw;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  filter: blur(2px);
  
  animation: ${props => !props.$isHide && shadowPulse} 3.5s ease-in-out infinite; 

  transition: opacity .2s;
  opacity: ${props => props.$isHide ? 0 : 1};
`;

/**
 * Falling backward (DEATH_POSE.style 'backward'): the robe's hem opening toward us as they go over, and their
 * two feet in it, soles up. Where the hem is (cqw, in the avatar's box, as the buckle widens it: its middle,
 * x, y, and width), how tall the opening grows (height, cqw), when it opens (from, to: shares of the fall), the
 * shoes (their colour, size: a share of the opening's width, and how far apart).
 */
export const HEM_OPENING = { x: 11.25, y: 23.2, width: 8.6, height: 3.2, from: 0.45, to: 0.8, shoe: { color: '#2b1d14', sole: '#140c08', size: 0.2, apart: 0.24 } };

const hemOpen = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) scaleY(0.1); }
  to { opacity: 1; transform: translate(-50%, -50%) scaleY(1); }
`;
const HemSvg = styled.svg`
  position: absolute;
  left: ${HEM_OPENING.x}cqw;
  top: ${HEM_OPENING.y}cqw;
  width: ${HEM_OPENING.width}cqw;
  height: ${HEM_OPENING.height}cqw;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  animation: ${hemOpen} ${DEATH_POSE.seconds * (HEM_OPENING.to - HEM_OPENING.from)}s ease-out ${DEATH_POSE.seconds * HEM_OPENING.from}s forwards;
`;

/** The hem's opening and the feet in it (falling backward only): `robe`, the robe's colour, for its rim. */
export const HemOpening = ({ robe }: { robe: string }) => {
  const { shoe } = HEM_OPENING;
  const footW = 100 * shoe.size, footH = 30;
  return (
    <HemSvg viewBox='0 0 100 40' preserveAspectRatio='none' aria-hidden>
      <defs>
        <radialGradient id={`hem-in-${robe}`} cx='50%' cy='40%' r='60%'>
          <stop offset='0' stopColor='#050306' />
          <stop offset='0.75' stopColor='#120a14' />
          <stop offset='1' stopColor={robe} />
        </radialGradient>
      </defs>
      {/* the robe's rim, then the dark inside */}
      <ellipse cx='50' cy='20' rx='50' ry='20' fill={robe} />
      <ellipse cx='50' cy='20' rx='45' ry='16.5' fill={`url(#hem-in-${robe})`} />
      {/* the feet, soles toward us, toes up and turned out a little */}
      {[-1, 1].map(side => (
        <g key={side} transform={`translate(${50 + side * 100 * shoe.apart / 2} 22) rotate(${side * 10})`}>
          <path d={`M 0 ${-footH * 0.62} C ${footW * 0.55} ${-footH * 0.5}, ${footW * 0.55} ${footH * 0.1}, ${footW * 0.32} ${footH * 0.35} C ${footW * 0.2} ${footH * 0.48}, ${-footW * 0.2} ${footH * 0.48}, ${-footW * 0.32} ${footH * 0.35} C ${-footW * 0.55} ${footH * 0.1}, ${-footW * 0.55} ${-footH * 0.5}, 0 ${-footH * 0.62} Z`} fill={shoe.color} />
          <path d={`M 0 ${-footH * 0.5} C ${footW * 0.4} ${-footH * 0.4}, ${footW * 0.4} ${-footH * 0.05}, ${footW * 0.22} ${footH * 0.05} L ${-footW * 0.22} ${footH * 0.05} C ${-footW * 0.4} ${-footH * 0.05}, ${-footW * 0.4} ${-footH * 0.4}, 0 ${-footH * 0.5} Z`} fill={shoe.sole} opacity={0.85} />
          <ellipse cx='0' cy={footH * 0.27} rx={footW * 0.24} ry={footH * 0.11} fill={shoe.sole} />
        </g>
      ))}
    </HemSvg>
  );
};

/**
 * A knocked out wizard's dizzy stars, as in a cartoon: `count` little stars circling above their head on a
 * tilted orbit (its middle, x and y, and its width and height, cqw, in the avatar's box; tiltDeg), every
 * `seconds`, smaller and dimmer round the back (backScale, backOpacity), the orbit's line drawn faintly
 * (orbits: how many rings, each a little wider and tilted the other way). Woozy, always moving: each lap
 * sways a little in its pace (lurch: 0 steadily; kept under 0.08, so no star ever stops or goes back), each
 * star spins in place (spinSeconds a turn) and wobbles on its own rhythm (wobble: every `seconds`, squashing
 * and stretching by squash, swaying swayCqw side to side). The orbit see-saws slowly (seesaw: deg either way of
 * its tilt, every `seconds`), its rings turning in place (ringSeconds a turn: their dashes running round, the
 * rings opposite ways; dash: the dash and gap, as shares of the ring). They appear once the wizard has landed
 * (delaySeconds after their fall begins), fading in as they grow out from their middle (grow: from `from` of
 * their size, a little past full, overshoot, then settling, over `seconds`).
 */
export const DIZZY_STARS = {
  isOn: true, x: 10.3, y: 10, width: 9, height: 1.75, tiltDeg: -3, count: 5, seconds: 5, lurch: 0.05, spinSeconds: 3,
  wobble: { seconds: 2, squash: 0.18, swayCqw: 0.22 },
  size: 1.4, color: '#ffe27a', glow: 'rgba(255, 220, 110, 0.8)', backScale: 0.6, backOpacity: 0.55,
  seesaw: { deg: 19, seconds: 4.5 }, ringSeconds: 6, dash: [0.22, 0.04],
  orbits: 2, orbitColor: 'rgba(230, 236, 245, 0.25)', orbitWidth: 0.07,
  delaySeconds: DEATH_POSE.seconds * DEATH_POSE.landAt + 0.2, fadeSeconds: 1,
  grow: { from: 0, overshoot: 1.12, seconds: 0.7 },
};

const dizzyAppear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
// Round the orbit: front (bottom of the ellipse, nearest us) bright and full size, back small and dim
// (lurching: running ahead, then dragging behind, the way round; a lap still in `seconds`)
const lurch = Math.min(DIZZY_STARS.lurch, 0.075); // (above about 0.08, a star would stall or slip back)
const lurchAt = (share: number) => `${((share + lurch * Math.sin(share * Math.PI * 4)) * 100).toFixed(1)}%`;
const dizzyOrbit = keyframes`
  0% { offset-distance: 0%; }
  ${[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map(share => `${share * 100}% { offset-distance: ${lurchAt(share)}; }`).join(' ')}
  100% { offset-distance: 100%; }
`;
// The wobble: rocking, squashing and stretching, bobbing (its own rhythm, out of step with the lap)
const { wobble } = DIZZY_STARS;
const dizzyWobble = keyframes`
  0%, 100% { transform: translateX(${-wobble.swayCqw}cqw) scale(1, 1); }
  25% { transform: translateX(0) scale(${1 - wobble.squash}, ${1 + wobble.squash}); }
  50% { transform: translateX(${wobble.swayCqw}cqw) scale(1, 1); }
  75% { transform: translateX(0) scale(${1 + wobble.squash}, ${1 - wobble.squash}); }
`;
const dizzySpin = keyframes`
  to { transform: rotate(360deg); }
`;
const dizzyDepth = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(${DIZZY_STARS.backScale}); opacity: ${DIZZY_STARS.backOpacity}; }
`;
const dizzySeesaw = keyframes`
  0%, 100% { transform: rotate(${DIZZY_STARS.tiltDeg - DIZZY_STARS.seesaw.deg}deg); }
  50% { transform: rotate(${DIZZY_STARS.tiltDeg + DIZZY_STARS.seesaw.deg}deg); }
`;
const ringTurn = keyframes`
  to { stroke-dashoffset: -1; }
`;
const dizzyGrow = keyframes`
  0% { transform: scale(${DIZZY_STARS.grow.from}); animation-timing-function: ease-out; }
  65% { transform: scale(${DIZZY_STARS.grow.overshoot}); animation-timing-function: ease-in-out; }
  100% { transform: scale(1); }
`;
// (growing out from the middle: on a layer of its own, as the box's own turn is its see-saw)
const DizzyGrow = styled.div`
  position: absolute;
  inset: 0;
  transform: scale(${DIZZY_STARS.grow.from});
  animation: ${dizzyGrow} ${DIZZY_STARS.grow.seconds}s linear ${DIZZY_STARS.delaySeconds}s forwards;
`;
const DizzyBox = styled.div`
  position: absolute;
  left: ${DIZZY_STARS.x - DIZZY_STARS.width / 2}cqw;
  top: ${DIZZY_STARS.y - DIZZY_STARS.height / 2}cqw;
  width: ${DIZZY_STARS.width}cqw;
  height: ${DIZZY_STARS.height}cqw;
  transform: rotate(${DIZZY_STARS.tiltDeg}deg);
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  animation: ${dizzyAppear} ${DIZZY_STARS.fadeSeconds}s ease-out ${DIZZY_STARS.delaySeconds}s forwards,
    ${dizzySeesaw} ${DIZZY_STARS.seesaw.seconds}s ease-in-out infinite;
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  ellipse {
    stroke-dasharray: ${DIZZY_STARS.dash.join(' ')};
    animation: ${ringTurn} ${DIZZY_STARS.ringSeconds}s linear infinite;
  }
  ellipse:nth-child(even) { animation-direction: reverse; }
`;
const DizzyStar = styled.div<{ $phase: number; $orbitPx: string }>`
  position: absolute;
  left: 0;
  top: 0;
  width: ${DIZZY_STARS.size}cqw;
  height: ${DIZZY_STARS.size}cqw;
  offset-path: ${props => props.$orbitPx};
  offset-rotate: 0deg;
  animation: ${dizzyOrbit} ${DIZZY_STARS.seconds}s linear ${props => -props.$phase * DIZZY_STARS.seconds}s infinite;
  > svg {
    animation: ${dizzyDepth} ${DIZZY_STARS.seconds}s linear ${props => -props.$phase * DIZZY_STARS.seconds}s infinite;
    filter: drop-shadow(0 0 0.25cqw ${DIZZY_STARS.glow});
    overflow: visible;
  }
  /* (the wobble on the star's group, its spin on the star itself: each its own transform) */
  > svg > g, > svg > g > path {
    transform-box: fill-box;
    transform-origin: center;
  }
  > svg > g {
    animation: ${dizzyWobble} ${wobble.seconds}s ease-in-out ${props => -props.$phase * wobble.seconds * 1.7}s infinite;
  }
  > svg > g > path {
    animation: ${dizzySpin} ${DIZZY_STARS.spinSeconds}s linear ${props => -props.$phase * DIZZY_STARS.spinSeconds}s infinite;
  }
`;

/** The dizzy stars over a knocked out wizard (DIZZY_STARS). */
export const DizzyStars = () => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [orbit, setOrbit] = useState<string | null>(null);
  // (the orbit's path in pixels: offset-path takes no container units; measured from the box, and on resizing)
  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      if (!box) return;
      const w = box.offsetWidth, h = box.offsetHeight, rx = w / 2, ry = h / 2;
      // (round the ellipse from its front, the bottom middle: so a star's middle follows it)
      setOrbit(`path("M ${rx} ${h} A ${rx} ${ry} 0 1 1 ${rx} 0 A ${rx} ${ry} 0 1 1 ${rx} ${h} Z")`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const { orbits, orbitColor, orbitWidth, width, height, count, color } = DIZZY_STARS;
  return (
    <DizzyBox ref={boxRef} aria-hidden>
      <DizzyGrow>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none'>
        {Array.from({ length: orbits }, (_, k) => (
          <ellipse key={k} cx={width / 2} cy={height / 2} rx={width / 2 * (1 + k * 0.12)} ry={height / 2 * (1 + k * 0.25)}
            transform={`rotate(${k % 2 ? 5 : 0} ${width / 2} ${height / 2})`}
            fill='none' stroke={orbitColor} vectorEffect='non-scaling-stroke' pathLength={1} style={{ strokeWidth: `${orbitWidth}cqw` }} />
        ))}
      </svg>
      {orbit && Array.from({ length: count }, (_, k) => (
        <DizzyStar key={k} $phase={k / count} $orbitPx={orbit}>
          <svg viewBox='-10 -10 20 20' width='100%' height='100%'>
            <g><path d='M0 -10 L2.6 -3.2 L9.5 -3.1 L4 1.3 L5.9 8.1 L0 4.1 L-5.9 8.1 L-4 1.3 L-9.5 -3.1 L-2.6 -3.2 Z' fill={color} /></g>
          </svg>
        </DizzyStar>
      ))}
      </DizzyGrow>
    </DizzyBox>
  );
};

export const AvatarHead = styled(CharacterPart)<{ $isDead?: boolean }>`
  top: -7.5cqw;
  left: 3.5cqw;
  width: 4.5cqw;
  aspect-ratio: 186/411;
  z-index: 2;
  transform-origin: bottom center;

  --extra-transform: translateZ(-1px);

  ${props => props.$isDead ? deadPart(headDroop, DEATH_POSE.seconds * DEATH_POSE.buckleAt, DEATH_POSE.seconds * (DEATH_POSE.landAt - DEATH_POSE.buckleAt) + 0.4) : css`
    animation-name: ${sway};
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  `}
`;

export const AvatarForearm = styled(CharacterPart)`
  top: .1cqw;
  left: 4cqw;
  width: 3.3cqw;
  aspect-ratio: 150/80; 
  transform-origin: 1cqw 1.5cqw;

  --extra-transform: translateZ(-1px) rotate(var(--part-angle));

  animation-name: ${sway};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
`;

// Update AvatarRightArm to fling up when dead
export const AvatarRightArm = styled(CharacterPart) <{ $isDead?: boolean }>`
  top: 5.5cqw;
  left: -2cqw;
  width: 4cqw;
  aspect-ratio: 168/215;
  z-index: -1;
  transform-origin: top left;
  --extra-transform: translateZ(-1px);
  /* (dead: turning about its joint, so the forearm stays in the sleeve's cuff) */
  ${props => props.$isDead ? css`transform-origin: ${DEATH_POSE.arm.joint}; ${deadPart(armDrape, DEATH_POSE.seconds * DEATH_POSE.buckleAt, DEATH_POSE.seconds * (DEATH_POSE.landAt - DEATH_POSE.buckleAt))}` : css`
    animation-name: ${sway};
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  `}
`;

// Update AvatarBicep to fling up when dead
export const AvatarBicep = styled(CharacterPart) <{ $isDead?: boolean }>`
  top: 0cqw;
  left: 6.6cqw;
  width: 6.05cqw;
  aspect-ratio: 255/149; 
  transform-origin: .75cqw 1.5cqw;
  --extra-transform: rotate(var(--part-angle));

  ${props => props.$isDead ? deadPart(armSpasmAndFlop, 0, DEATH_POSE.seconds * DEATH_POSE.landAt) : css`
    animation-name: ${sway};
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  `}
`;

export const castingDiamondOrTriangle = keyframes`
  0% {
    /* Starting point: Center-neutral */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  12.5% {
    /* Loop 1: Wrist tilts down and slightly forward, sweeping the air */
    transform: var(--extra-transform) translate(0.04cqw, 0.05cqw) rotate(12deg);
  }
  25% {
    /* Center crossover point of the figure-eight / circle */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  37.5% {
    /* Loop 2: Wrist tilts up and slightly back, gathering the wind */
    transform: var(--extra-transform) translate(-0.04cqw, -0.05cqw) rotate(-8deg);
  }

    50% {
    /* Starting point: Center-neutral */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  62.5% {
    /* Loop 1: Wrist tilts down and slightly forward, sweeping the air */
    transform: var(--extra-transform) translate(0.04cqw, 0.05cqw) rotate(12deg);
  }
  75% {
    /* Center crossover point of the figure-eight / circle */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  87.5% {
    /* Loop 2: Wrist tilts up and slightly back, gathering the wind */
    transform: var(--extra-transform) translate(-0.04cqw, -0.05cqw) rotate(-8deg);
  }
  100% {
    /* Seamless loop back to start */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
`;

export const castingLine = keyframes`
  0%, 100% {
    /* Base resting position */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  8% {
    /* Sharp micro-snap up and back */
    transform: var(--extra-transform) translate(-0.03cqw, -0.04cqw) rotate(-4deg);
  }
  14% {
    /* Sudden drop down, resisting the charge */
    transform: var(--extra-transform) translate(0.02cqw, 0.05cqw) rotate(6deg);
  }
  22% {
    /* Quick vibration snap left */
    transform: var(--extra-transform) translate(-0.04cqw, 0.01cqw) rotate(-2deg);
  }
  30% {
    /* Brief neutral recovery */
    transform: var(--extra-transform) translate(0, 0) rotate(1deg);
  }
  38% {
    /* Violent jerk forward and down */
    transform: var(--extra-transform) translate(0.05cqw, 0.04cqw) rotate(8deg);
  }
  44% {
    /* Instant recoil snap straight back up */
    transform: var(--extra-transform) translate(-0.05cqw, -0.05cqw) rotate(-7deg);
  }
  56% {
    /* Fast, tiny tremors */
    transform: var(--extra-transform) translate(0.01cqw, -0.02cqw) rotate(2deg);
  }
  68% {
    /* Another quick jolt to the right */
    transform: var(--extra-transform) translate(0.04cqw, 0.02cqw) rotate(5deg);
  }
  78% {
    /* Tension release, dropping low */
    transform: var(--extra-transform) translate(-0.01cqw, 0.05cqw) rotate(-3deg);
  }
  90% {
    /* Rapidly stabilizing tremor before the loop resets */
    transform: var(--extra-transform) translate(0.02cqw, -0.01cqw) rotate(1deg);
  }
`;

export const castingCircle = keyframes`
  0% {
    /* Base resting position - compressing the spark */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  20% {
    /* Swelling: The fire expands. The hand is pushed slowly back and tilts down */
    transform: var(--extra-transform) translate(-0.03cqw, 0.02cqw) rotate(5deg);
  }
  35% {
    /* Heat Jitter: A micro-burst of solar flare energy shakes the wrist */
    transform: var(--extra-transform) translate(-0.02cqw, 0.04cqw) rotate(7deg);
  }
  38% {
    /* Fast counter-shiver */
    transform: var(--extra-transform) translate(-0.04cqw, 0.01cqw) rotate(4deg);
  }
  55% {
    /* Thermal Lift: The mass of the flame gets huge and floats upward, dragging the wand up */
    transform: var(--extra-transform) translate(0.02cqw, -0.05cqw) rotate(-10deg);
  }
  75% {
    /* Roiling: The sphere churns. The wrist rolls forward to keep it under control */
    transform: var(--extra-transform) translate(0.05cqw, -0.02cqw) rotate(-4deg);
  }
  90% {
    /* Heavy Compression: Squishing the magma down tightly right before the loop resets */
    transform: var(--extra-transform) translate(0.01cqw, 0.03cqw) rotate(2deg);
  }
  100% {
    /* Back to starting point */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
`;

export const castingStar = keyframes`
  0% {
    /* Base resting position */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
  25% {
    /* The Crest: Wrist arches up and forward, driving the top of the wheel */
    transform: var(--extra-transform) translate(0.04cqw, -0.04cqw) rotate(8deg);
  }
  50% {
    /* The Descent: Wrist pushes down and forward as the wheel rolls over */
    transform: var(--extra-transform) translate(0.02cqw, 0.03cqw) rotate(4deg);
  }
  75% {
    /* The Undertow: Wrist pulls low and back, gathering water from beneath */
    transform: var(--extra-transform) translate(-0.04cqw, 0.05cqw) rotate(-6deg);
  }
  100% {
    /* Smoothly climbing back up to complete the clockwise loop */
    transform: var(--extra-transform) translate(0, 0) rotate(0deg);
  }
`;

export const AvatarWandHand = styled(CharacterPart) <{ $gameSymbol?: InferenceString }>`
  top: -.5cqw;
  left: 2.5cqw;
  width: 7.8cqw;
  aspect-ratio: 320/101; 
  z-index: 2;
  transform-origin: .2cqw .8cqw;

  --extra-transform: rotate(var(--part-angle));

  animation-name: ${props => props.$gameSymbol == 'line' ? castingLine : props.$gameSymbol == 'circle' ? castingCircle : props.$gameSymbol == 'triangle' || props.$gameSymbol == 'diamond' ? castingDiamondOrTriangle : props.$gameSymbol == 'star' ? castingStar : shift};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
`;