import styled, { keyframes, css } from 'styled-components';

export const bob = keyframes`
  0%, 100% { transform: translateY(0px) var(--extra-transform, ); }
  50% { transform: translateY(-4px) var(--extra-transform, ); }
`;

// 2. Sway: Rotational pivoting (perfect for limbs and heads)
export const sway = keyframes`
  0%, 100% { transform: rotate(0deg) var(--extra-transform, ); }
  50% { transform: rotate(3deg) var(--extra-transform, ); }
`;

// 3. Shift: Subtle horizontal translation
export const shift = keyframes`
  0%, 100% { transform: translateX(0px) var(--extra-transform, ); }
  50% { transform: translateX(2px) var(--extra-transform, ); }
`;

// 1. Shake from dmg taken
export const shake = keyframes`
  10%, 90% { transform: translate3d(-.25cqw, 0, 0) var(--extra-transform, ); }
  20%, 80% { transform: translate3d(.5cqw, 0, 0) var(--extra-transform, ); }
  30%, 50%, 70% { transform: translate3d(-.75cqw, 0, 0) var(--extra-transform, ); }
  40%, 60% { transform: translate3d(.75cqw, 0, 0) var(--extra-transform, ); }
`;

export const noAnim = keyframes`
  0%, 100% { var(--extra-transform, ); }
`;

// 2. Create the styled component
export const Damageable = styled.div<{ $isDmged: boolean }>`
  width: 100%;
  height: 100%;
  
  ${props => props.$isDmged ? css`
    animation: ${shake} .75s cubic-bezier(.36,.07,.19,.97) both;
  ` : css`
    animation: ${noAnim} 0.1s cubic-bezier(.36,.07,.19,.97) both;
  `}
`;

interface PartProps {
  $src: string;
  $delay?: string;
  $speed?: string;
  $angle?: number;
}

// TO-DO: fix styled-components warning...
export const CharacterPart = styled.div.attrs<PartProps>(props => ({
    style: {
      backgroundImage: `url(${props.$src})`
    }
  }))`
  position: absolute;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  transform-style: preserve-3d; 
  will-change: transform;
`;
  // background-image: url(${props => props.$src});

export const AvatarRobe = styled(CharacterPart)`
  top: 7.75cqw;
  left: 2.4cqw;
  width: 13cqw;
  aspect-ratio: 544/657; 
  transform-origin: bottom center;
  animation: ${bob} ${props => props.$speed || '4s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '0s'};
`;

export const AvatarHead = styled(CharacterPart)`
  top: -7.5cqw;
  left: 3.5cqw;
  width: 4.5cqw;
  aspect-ratio: 186/411; 
  z-index: 2;

  transform-origin: bottom center;

   --extra-transform: translateZ(-1px);

  animation: ${sway} ${props => props.$speed || '3.5s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '-0.2s'};
`;

export const AvatarRightArm = styled(CharacterPart)`
  top: 5.5cqw;
  left: -2cqw;
  width: 4cqw;
  aspect-ratio: 168/215;
  
  z-index: -1;

   --extra-transform: translateZ(-1px);

  transform-origin: top left; /* The elbow joint */
  animation: ${sway} ${props => props.$speed || '3.4s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '-1.4s'};
`;


export const AvatarBicep = styled(CharacterPart)`
  top: 0cqw;
  left: 6.6cqw;
  
  width: 6.05cqw;
  aspect-ratio: 255/149; 

  transform-origin: .75cqw 1.5cqw;

  --extra-transform: rotate(${props => props.$angle}deg);

  animation: ${sway} ${props => props.$speed || '3.8s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '-0.6s'};

`;

export const AvatarForearm = styled(CharacterPart)`
  top: .1cqw;
  left: 4cqw;
  width: 3.3cqw;
  aspect-ratio: 150/80; 
  transform-origin: 1cqw 1.5cqw;
  --extra-transform: translateZ(-1px) rotate(${props => props.$angle}deg);

  animation: ${sway} ${props => props.$speed || '3.2s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '-1.1s'};
`;

export const AvatarWandHand = styled(CharacterPart)`
  top: -.5cqw;
  left: 2.5cqw;
  width: 7.8cqw;
  aspect-ratio: 320/101; 
  z-index: 2;
  transform-origin: .2cqw .8cqw;
  --extra-transform: rotate(${props => props.$angle}deg);

  animation: ${shift} ${props => props.$speed || '2.5s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay || '-0.4s'};
`;