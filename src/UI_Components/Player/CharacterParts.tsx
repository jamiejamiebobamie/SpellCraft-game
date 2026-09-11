import styled, { keyframes, css } from 'styled-components';

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

export const noAnim = keyframes`
  0%, 100% { var(--extra-transform, ); }
`;

const flashDamage = keyframes`
  0% { opacity: 0; }
  15% { opacity: 0.6; }
  100% { opacity: 0; }
`;

export const Damageable = styled.div<{ $healthDiff: number }>`
  width: 100%;
  height: 100%;
  
  ${props => props.$healthDiff < 0 && css`
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
}))<PartProps>`
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

export const AvatarRightArm = styled(CharacterPart)`
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

export const AvatarBicep = styled(CharacterPart)`
  top: 0cqw;
  left: 6.6cqw;
  width: 6.05cqw;
  aspect-ratio: 255/149; 
  transform-origin: .75cqw 1.5cqw;

  --extra-transform: rotate(var(--part-angle));

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

export const AvatarWandHand = styled(CharacterPart)`
  top: -.5cqw;
  left: 2.5cqw;
  width: 7.8cqw;
  aspect-ratio: 320/101; 
  z-index: 2;
  transform-origin: .2cqw .8cqw;

  --extra-transform: rotate(var(--part-angle));

  animation-name: ${shift};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
`;
