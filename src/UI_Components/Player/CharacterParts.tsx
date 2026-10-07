import styled, { keyframes, css } from 'styled-components';
import { InferenceString } from '../../DataClasses/types';

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

// Wand Arm Death Anim
export const armFlingUp = keyframes`
  0% { transform: rotate(var(--part-angle, 0deg)); }
  100% { transform: rotate(-75deg); } /* Forces arm to point straight "up" skyward */
`;

export const noAnim = keyframes`
  0%, 100% { var(--extra-transform, ); }
`;

const flashDamage = keyframes`
  0% { opacity: 0; }
  15% { opacity: 0.6; }
  100% { opacity: 0; }
`;

// Body Death Anim
export const fallAndSquash = keyframes`
  0% {
    transform: rotate(0deg) scale(1, 1) skewX(0deg) translate(0cqw, 0cqw);
    opacity: 1;
  }
  /* The fall accelerates naturally. The squash, skew, and slide 
     happen rapidly right as the body impacts the ground. */
  85% {
    transform: rotate(75deg) scale(1, 1) skewX(-5deg) translate(0.5cqw, 1cqw);
    opacity: 1;
  }
  100% {
    transform: rotate(90deg) scale(0.6, 1.2) skewX(-15deg) translate(2cqw, 3cqw);
    opacity: 0; /* Fades out smoothly at the very end */
  }
`;

export const Damageable = styled.div<{ $healthDiff: number; $isDead: boolean }>`
  width: 100%;
  height: 100%;
  
  /* Set the transform-origin near the feet/base so the body tilts forward naturally */
  transform-origin: bottom center;
  
  ${props => props.$isDead ? css`
    /* Switched to cubic-bezier(0.32, 0, 0.67, 0) which mimics gravitational acceleration (Ease-In) */
    animation: ${fallAndSquash} 3s cubic-bezier(0.32, 0, 0.67, 0) forwards;
  ` : props.$healthDiff < 0 && css`
    animation: ${shake} .75s cubic-bezier(.36,.07,.19,.97) both;
  `}
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

// Clean extended components reading structural rules without inline interruptions
export const AvatarRobe = styled(CharacterPart)`
  top: 7.75cqw;
  left: 2.4cqw;
  width: 13cqw;
  aspect-ratio: 544/657; 
  transform-origin: bottom center;
  animation-name: ${bob};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
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


export const AvatarHead = styled(CharacterPart)`
  top: -7.5cqw;
  left: 3.5cqw;
  width: 4.5cqw;
  aspect-ratio: 186/411; 
  z-index: 2;
  transform-origin: bottom center;

  --extra-transform: translateZ(-1px);

  animation-name: ${sway};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
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
  animation-name: ${sway};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
`;

// Update AvatarBicep to fling up when dead
export const AvatarBicep = styled(CharacterPart) <{ $isDead?: boolean }>`
  top: 0cqw;
  left: 6.6cqw;
  width: 6.05cqw;
  aspect-ratio: 255/149; 
  transform-origin: .75cqw 1.5cqw;
  --extra-transform: rotate(var(--part-angle));

  ${props => props.$isDead ? css`
    animation: ${armFlingUp} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  ` : css`
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

// 2s
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
// TO-DO: check anims at different speeds. ('castingDiamondOrTriangle' and 'castingLine' should be fine...) adjust anims so that speed does not need to be changed per anim...
export const castingStar = keyframes`
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

export const castingCircle = keyframes`
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