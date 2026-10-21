import styled, { keyframes, css } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../Player/CharacterParts';

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
  $style?: string;
  $backgroundSceneBrightness: number;
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

      transition: filter ${INTRO_WALK_ANIM_TIME}s;
      // filter: brightness(.6) hue-rotate(90deg);
      filter: brightness(${props => props.$backgroundSceneBrightness * 1.75}) hue-rotate(90deg);
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
  
  ${props => props.$style && props.$style}
`;


type ChandelierComponentProps = {
  backgroundSceneBrightness: number;
  left?: string;
  right?: string;
  animDelay?: string;
}

export default function ChandelierComponent({ backgroundSceneBrightness, left, right, animDelay }: ChandelierComponentProps) {
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
      $backgroundSceneBrightness={backgroundSceneBrightness}
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
        $backgroundSceneBrightness={backgroundSceneBrightness}
      >
        <ChandelierImg
          $top={'-1.5cqw'}
          $left={'0cqw'}
          $width={'11.5cqw'}
          $aspectRatio={'140/38'}
          $zIndex={3}
          $style={'filter: brightness(1.5) drop-shadow(0px 0px 1px green);'}
          $imgUrl={'background-scene/Chandelier/Chandelier-candle-flames.png'}
          $backgroundSceneBrightness={backgroundSceneBrightness}
        />
      </ChandelierImg>
    </ChandelierImg>
  );
}
