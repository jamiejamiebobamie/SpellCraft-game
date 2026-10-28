import styled, { keyframes, css } from 'styled-components';
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
 * floor (toppleDeg, landing at landAt, a small bounce: bounceDeg back; settling down onto it: drop, cqw across
 * and down, as tipping over lifts their back off the floor) and settle (seconds: the whole fall).
 * Their head droops onto the pile (headDeg), the far arm goes limp at the sleeve (arm: its turn, deg, about its
 * joint, where the forearm meets the cuff: the top right of its picture), and the wand arm gives a last
 * spasm up (spasmDeg) before flopping limp (limpDeg; the forearm and hand hanging: forearmDeg, handDeg).
 * The heap's shadow (shadow: its width and height, cqw, how far it reaches past the feet, its darkness).
 */
export const DEATH_POSE = {
  seconds: 3, buckle: { height: 0.72, width: 1.1 }, buckleAt: 0.3, toppleDeg: 84, landAt: 0.78, bounceDeg: 6, drop: { x: 0.8, y: 2.2 },
  headDeg: 32, arm: { joint: '88% 5%', deg: -60 }, spasmDeg: -75, limpDeg: 28, forearmDeg: 35, handDeg: 25,
  shadow: { width: 17, height: 2.6, reach: 4, opacity: 0.55 },
};

// Body Death Anim: buckling, then slumping over onto the floor, and staying there (squashed from the floor
// before it's turned, so it stays a heap, not a stretched board)
const pct = (at: number) => `${(at * 100).toFixed(1)}%`;
const { buckle, buckleAt, toppleDeg, landAt, bounceDeg, drop } = DEATH_POSE;
const down = (share: number) => `translate(${drop.x * share}cqw, ${drop.y * share}cqw)`;
export const fallAndSquash = keyframes`
  0% { transform: ${down(0)} rotate(0deg) scale(1, 1); animation-timing-function: ease-in; }
  ${pct(buckleAt)} { transform: ${down(0)} rotate(4deg) scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-in; }
  ${pct(landAt)} { transform: ${down(1)} rotate(${toppleDeg}deg) scale(${buckle.width}, ${buckle.height}); animation-timing-function: ease-out; }
  ${pct(landAt + (1 - landAt) * 0.4)} { transform: ${down(0.85)} rotate(${toppleDeg - bounceDeg}deg) scale(${buckle.width * 1.02}, ${buckle.height * 0.97}); animation-timing-function: ease-in-out; }
  100% { transform: ${down(1)} rotate(${toppleDeg}deg) scale(${buckle.width}, ${buckle.height}); }
`;

// The head drooping onto the pile, and the far arm draping, as they come down
const headDroop = keyframes`
  to { transform: rotate(${DEATH_POSE.headDeg}deg) translateY(0.4cqw) var(--extra-transform, ); }
`;
const armDrape = keyframes`
  to { transform: rotate(${DEATH_POSE.arm.deg}deg) var(--extra-transform, ); }
`;
// The wand arm: a last spasm up, then flopping limp
const armSpasmAndFlop = keyframes`
  0% { transform: rotate(var(--part-angle, 0deg)); }
  20% { transform: rotate(${DEATH_POSE.spasmDeg}deg); animation-timing-function: ease-in; }
  100% { transform: rotate(${DEATH_POSE.limpDeg}deg); }
`;
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

export const AvatarRobe = styled(CharacterPart) <{ $isBeginIntroWalk: boolean; $isDoneWithIntroWalk: boolean }>`
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

// A fallen wizard's shadow on the floor (DEATH_POSE.shadow): wider and flatter than a standing one's, reaching
// past their feet the way they fell, darkening in as they land (outside the falling body, so it stays level)
export const HeapShadow = styled.div<{ $isShown: boolean }>`
  position: absolute;
  z-index: -1;
  top: ${21.5 + 2 / 2 - DEATH_POSE.shadow.height / 2}cqw; /* (level with the standing shadow's middle: FloorShadow) */
  left: ${5.5 + 10 / 2 - DEATH_POSE.shadow.width / 2 + DEATH_POSE.shadow.reach}cqw;
  width: ${DEATH_POSE.shadow.width}cqw;
  height: ${DEATH_POSE.shadow.height}cqw;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, ${DEATH_POSE.shadow.opacity}) 0%, rgba(0, 0, 0, ${DEATH_POSE.shadow.opacity * 0.6}) 55%, rgba(0, 0, 0, 0) 100%);
  pointer-events: none;
  opacity: ${props => props.$isShown ? 1 : 0};
  transition: opacity ${props => props.$isShown ? `0.6s ease-out ${DEATH_POSE.seconds * DEATH_POSE.landAt * 0.8}s` : '0.2s'};
`;

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