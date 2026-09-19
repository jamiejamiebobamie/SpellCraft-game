import React from 'react';
import styled, { keyframes, css } from 'styled-components';

const chainSwing = keyframes`
  0% { transform: rotate(-2.5deg); }
  50% { transform: rotate(2.5deg); }
  100% { transform: rotate(-2.5deg); }
`;

const chandelierSwing = keyframes`
  0% { transform: rotate(1.8deg); }
  50% { transform: rotate(-1.8deg); }
  100% { transform: rotate(1.8deg); }
`;

type ChandelierProps = {
  $imgUrl: string;
  $zIndex: number;
  $width: string;
  $aspectRatio: string;
  $top: string;
  $left?: string;
  $right?: string;
  $transformOrigin?: string;
  $animType?: string | undefined;
  $animDelay?: string;
  $brightness?: number;
}

const ChandelierImg = styled.div<ChandelierProps>`
  position: absolute;
  transform-origin: ${props => props.$transformOrigin};
  top: ${props => props.$top};
  ${props => props.$left && `left: ${props.$left};`}
  ${props => props.$right && `right: ${props.$right};`}
  width: ${props => props.$width};
  aspect-ratio: ${props => props.$aspectRatio};
  z-index: ${props => props.$zIndex};

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url(${props => props.$imgUrl});
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
      
      filter: brightness(.6) hue-rotate(90deg);
      z-index: -1;
  }

    ${props => props.$animType === 'chain' && css`
    animation: ${chainSwing} 7s infinite ease-in-out;
    animation-delay: ${props.$animDelay || '0s'};
  `}
  
  ${props => props.$animType === 'chandelier' && css`
    animation: ${chandelierSwing} 6.2s infinite ease-in-out;
    animation-delay: ${props.$animDelay || '0s'};
  `}
`;


type ChandelierComponentProps = {
  left?: string;
  right?: string;
  animDelay?: string;
}

export default function ChandelierComponent({ left, right, animDelay }: ChandelierComponentProps) {
  return (
      <ChandelierImg
        $transformOrigin={'top center'}
        $top={'0cqw'}
        $left={left}
        $right={right}
        $width={'1.32cqw'}
        $aspectRatio={'22/214'}
        $zIndex={1}
        $imgUrl={'background-scene/Chandelier/Chandelier-chain-iron.png'}
        $animType={'chain'}
        $animDelay={animDelay}
      >
        <ChandelierImg
          $transformOrigin={'bottom center'}
          $top={'9.3cqw'}
          $left={'-5cqw'}
          $width={'11.5cqw'}
          $aspectRatio={'139/78'}
          $zIndex={2}
          $imgUrl={'background-scene/Chandelier/Chandelier-candles-holder-iron.png'}
          $animType={'chandelier'}
          $animDelay={animDelay}
        >
          <ChandelierImg
            $top={'-1.5cqw'}
            $left={'0cqw'}
            $width={'11.5cqw'}
            $aspectRatio={'140/38'}
            $zIndex={3}
            $imgUrl={'background-scene/Chandelier/Chandelier-candle-flames.png'} />
        </ChandelierImg>
      </ChandelierImg>
  );
}
