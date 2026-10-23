import { useMemo } from 'react';
import { GameClock } from '../../DataClasses/GameClock/GameClock';
import { getDawnLight } from '../../DataClasses/GameRules/gameRules';
import { rootGameStore } from '../../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';

const twinkle = keyframes`
  0%, 100% {
    transform: scale(0.2) rotate(0deg);
    opacity: 0.15;
  }
  50% {
    transform: scale(1.1) rotate(15deg);
    opacity: 1;
  }
`;

const breathe = keyframes`
  0%, 100% { 
    transform: scale(0.7); 
    opacity: 0.3; 
  }
  50% { 
    transform: scale(1.3); 
    opacity: 0.85; 
  }
`;

/**
 * The windows' dawn: its light follows the chance of a teacher's catch (getDawnLight), easing in over
 * `seconds` each turn; the stars fade out as it grows, from `starsFadeFrom` to `starsGoneAt` (its light).
 */
export const DAWN = { seconds: 4, starsFadeFrom: 0.12, starsGoneAt: 0.7 };

const SkyContainer = styled.div<{ $interpAmt: number; $index: number }>`
  position: absolute;
  left: ${props => props.$index * 26.5 + 5.5}cqw;
  top: 1cqw;
  width: 9cqw;
  height: 12cqw;
  
  /* 
    Interpolate towards a vibrant dawn/sunrise.
    As $interpAmt approaches 1, the night colors blend seamlessly into 
    soft, glowing morning tones (soft warm cream horizon shifting up into deep sky blues).
  */
  /* The night sky: midnight blue, darker toward the top */
  background: radial-gradient(circle at 50% 100%, #2b1f4d 0%, #110d26 60%, #05040a 100%);
  overflow: hidden;
  z-index: -2;

  /* The dawn over it (a warm cream horizon rising into blue), its own layer so each turn's brightening
     eases in (a gradient's colors can't) */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #fff4d4 0%, #6ba4ff 50%, #3a62be 100%);
    opacity: ${props => props.$interpAmt};
    transition: opacity ${DAWN.seconds}s ease-in-out;
    pointer-events: none;
  }
`;

/** A star's opacity as the dawn grows (DAWN). */
const getStarOpacity = (dawnLight: number): number =>
  Math.max(0, Math.min(1, 1 - (dawnLight - DAWN.starsFadeFrom) / (DAWN.starsGoneAt - DAWN.starsFadeFrom)));

type StarProps = {
    $top: string;
    $left: string;
    $size: string;
    $delay: string;
    $duration: string;
    $skyBrightness: number; // Added to handle star visibility fading
};

const StyledFlareStar = styled.svg.attrs<StarProps>(props => ({
    style: {
        top: props.$top,
        left: props.$left,
        width: props.$size,
        height: props.$size,
        animationDelay: props.$delay,
        animationDuration: props.$duration,
        // Fading out as the dawn grows (DAWN.starsFadeFrom to starsGoneAt)
        opacity: getStarOpacity(props.$skyBrightness),
    },
})) <StarProps>`
  position: absolute;
  fill: #fffef0; /* Warm ivory cel-paint tone */
  filter: drop-shadow(0 0 .5cqw rgba(255, 254, 240, 0.85));
  animation: ${twinkle} ease-in-out infinite;
  pointer-events: none;
  transition: opacity 0.3s ease;
`;

const StyledGlowStar = styled.div.attrs<StarProps>(props => ({
    style: {
        top: props.$top,
        left: props.$left,
        width: props.$size,
        height: props.$size,
        animationDelay: props.$delay,
        animationDuration: props.$duration,
        // Mirrors the flare star atmospheric fade properties
        opacity: getStarOpacity(props.$skyBrightness),
    },
})) <StarProps>`
  position: absolute;
  background: #fffdf0;
  border-radius: 50%;
  box-shadow: 0 0 .8cqw .2cqw rgba(255, 235, 170, 0.5);
  animation: ${breathe} ease-in-out infinite;
  pointer-events: none;
  transition: opacity 0.3s ease;
`;


const StarrySkyComponent = ({ index }: { index: number }) => {
    const snap = useSnapshot(rootGameStore);
    const minuteAngleAcc = snap.getMinuteAngleAcc();
    const interpAmt = getDawnLight(Math.round(minuteAngleAcc / GameClock.MINUTE_INCREMENT_ANGLE));

    const starList = useMemo(() => {
        return Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            type: i % 3 === 0 ? 'flare' : 'glow',
            top: `${Math.random() * 85}%`,
            left: `${Math.random() * 100}%`,
            size: i % 3 === 0 ? `${Math.random() * 1 + .5}cqw` : `${Math.random() * .2 + .1}cqw`,
            delay: `${Math.random() * -5}s`,
            duration: `${Math.random() * 10 + 2.5}s`,
        }));
    }, []);

    return (
        <SkyContainer $interpAmt={interpAmt} $index={index}>
            {starList.map((star) =>
                star.type === 'flare' ? (
                    <StyledFlareStar
                        key={star.id}
                        viewBox="0 0 24 24"
                        $top={star.top} $left={star.left}
                        $size={star.size} $delay={star.delay}
                        $duration={star.duration} $skyBrightness={interpAmt}
                    >
                        <path d="M12,0 C12,8 16,12 24,12 C16,12 12,16 12,24 C12,16 8,12 0,12 C8,12 12,8 12,0 Z" />
                    </StyledFlareStar>
                ) : (
                    <StyledGlowStar
                        key={star.id}
                        $top={star.top} $left={star.left}
                        $size={star.size} $delay={star.delay}
                        $duration={star.duration} $skyBrightness={interpAmt}
                    />
                )
            )}
        </SkyContainer>
    );
};

export default StarrySkyComponent;