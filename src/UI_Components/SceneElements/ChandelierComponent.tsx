import styled, { keyframes, css } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../Player/CharacterParts';
import { rootGameStore } from '../../DataClasses/store';

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

// The candle flames: a slow cycle through the colours, and a flicker (transform and opacity only, so cheap)
const FLAME_FX = {
  isGreen: true, // the flames tinted green (hue-rotate), or their own colours
  yellowShiftDeg: 0, // (not green) a hue-rotate nudging the flames from orange towards yellow (0: as drawn)
  isHueCycling: false,
  hueCycleSeconds: 24, // once round the colour wheel (starting from green)
  isFlickering: true,
  flickerSeconds: 1.3,
  // the flames' brightness on the landing page (the scene dark), and in play (the scene lit); it
  // eases from one to the other with the scene as the intro brightens it (was 0.26 and 1.05)
  brightness: { landing: 0.5, play: 1.3 },
};

// the hue first (so it doesn't shift the glow's colour), then the glow, then the brightness (dimming the glow too)
const flameFilter = (sceneBrightness: number) => {
  const brightness = sceneBrightness > rootGameStore.LOW_BRIGHTNESS ? FLAME_FX.brightness.play : FLAME_FX.brightness.landing;
  const glow = FLAME_FX.isGreen ? 'green' : '#ffb340';
  const hue = FLAME_FX.isGreen ? 90 : FLAME_FX.yellowShiftDeg;
  return `hue-rotate(${hue}deg) drop-shadow(0px 0px 1px ${glow}) brightness(${brightness})`;
};

const flameHueCycle = keyframes`
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
`;

// uneven steps, so it doesn't read as a steady pulse
const flameFlicker = keyframes`
  0% { transform: scaleY(1) skewX(0deg); opacity: 1; }
  11% { transform: scaleY(1.05) skewX(0.6deg); opacity: 0.93; }
  19% { transform: scaleY(0.97) skewX(-0.4deg); opacity: 1; }
  34% { transform: scaleY(1.03) skewX(0.3deg); opacity: 0.88; }
  42% { transform: scaleY(0.95) skewX(-0.7deg); opacity: 0.97; }
  58% { transform: scaleY(1.06) skewX(0.2deg); opacity: 0.9; }
  71% { transform: scaleY(0.98) skewX(0.5deg); opacity: 1; }
  83% { transform: scaleY(1.02) skewX(-0.3deg); opacity: 0.85; }
  100% { transform: scaleY(1) skewX(0deg); opacity: 1; }
`;

const flameAnimations = (delay: string) => {
  const parts = [
    FLAME_FX.isHueCycling && css`${flameHueCycle} ${FLAME_FX.hueCycleSeconds}s linear ${delay} infinite`,
    FLAME_FX.isFlickering && css`${flameFlicker} ${FLAME_FX.flickerSeconds}s ease-in-out ${delay} infinite`,
  ].filter(Boolean);
  if (!parts.length) return '';
  return css`
    transform-origin: bottom center;
    animation: ${parts.length === 2 ? css`${parts[0]}, ${parts[1]}` : parts[0]};
  `;
};

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
      filter: ${props => props.$animType === 'flames' ? flameFilter(props.$backgroundSceneBrightness) : `brightness(${props.$backgroundSceneBrightness * 1.75}) hue-rotate(90deg)`};
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

  ${props => props.$animType === 'flames' && flameAnimations(props.$animDelay || '0s')}

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
          $imgUrl={'background-scene/Chandelier/Chandelier-candle-flames.png'}
          $animType={'flames'}
          $animDelay={animDelay}
          $backgroundSceneBrightness={backgroundSceneBrightness}
        />
      </ChandelierImg>
    </ChandelierImg>
  );
}
