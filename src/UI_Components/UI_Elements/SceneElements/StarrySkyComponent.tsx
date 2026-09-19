import React, { useMemo } from 'react';
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

const SkyContainer = styled.div<{ $index: number }>`
  position: absolute;
  left: ${props => props.$index * 26.5 + 5.5}cqw;
  top: 1cqw;
  width: 9cqw;
  height: 12cqw;
  background: radial-gradient(circle at 50% 100%, #2b1f4d 0%, #110d26 60%, #05040a 100%);
  overflow: hidden;
  z-index: -2;
`;

type StarProps = {
    $top: string;
    $left: string;
    $size: string;
    $delay: string;
    $duration: string;
};

const StyledFlareStar = styled.svg.attrs<StarProps>(props => ({
    style: {
        top: props.$top,
        left: props.$left,
        width: props.$size,
        height: props.$size,
        animationDelay: props.$delay,
        animationDuration: props.$duration,
    },
})) <{ $top: string, $left: string, $size: string, $delay: string, $duration: string, }>`
  position: absolute;
  fill: #fffef0; /* Warm ivory cel-paint tone */
  filter: drop-shadow(0 0 .5cqw rgba(255, 254, 240, 0.85));
  animation: ${twinkle} ease-in-out infinite;
  pointer-events: none;
`;

const StyledGlowStar = styled.div.attrs<StarProps>(props => ({
    style: {
        top: props.$top,
        left: props.$left,
        width: props.$size,
        height: props.$size,
        animationDelay: props.$delay,
        animationDuration: props.$duration,
    },
})) <{ $top: string, $left: string, $size: string, $delay: string, $duration: string }>`
  position: absolute;
  background: #fffdf0;
  border-radius: 50%;
  box-shadow: 0 0 .8cqw .2cqw rgba(255, 235, 170, 0.5);
  animation: ${breathe} ease-in-out infinite;
  pointer-events: none;
`;

export const StarrySkyComponent = ({ index }: { index: number }) => {
    // Generate random coordinates and timings once to avoid re-renders popping stars around
    const starList = useMemo(() => {
        return Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            type: i % 3 === 0 ? 'flare' : 'glow', // Mix up the types of stars
            top: `${Math.random() * 85}%`,       // Keep stars mostly in the upper sky
            left: `${Math.random() * 100}%`,
            size: i % 3 === 0 ? `${Math.random() * 1 + .5}cqw` : `${Math.random() * .2 + .1}cqw`,
            delay: `${Math.random() * -5}s`,     // Negative delay prevents all stars starting at 0% opacity together
            duration: `${Math.random() * 10 + 2.5}s`,
        }));
    }, []);

    return (
        <SkyContainer $index={index}>
            {starList.map((star) =>
                star.type === 'flare' ? (
                    <StyledFlareStar
                        key={star.id}
                        viewBox="0 0 24 24"
                        $top={star.top}
                        $left={star.left}
                        $size={star.size}
                        $delay={star.delay}
                        $duration={star.duration}
                    >
                        {/* Hand-drawn curve path for optimal optical lens flare look */}
                        <path d="M12,0 C12,8 16,12 24,12 C16,12 12,16 12,24 C12,16 8,12 0,12 C8,12 12,8 12,0 Z" />
                    </StyledFlareStar>
                ) : (
                    <StyledGlowStar
                        key={star.id}
                        $top={star.top}
                        $left={star.left}
                        $size={star.size}
                        $delay={star.delay}
                        $duration={star.duration}
                    />
                )
            )}
        </SkyContainer>
    );
};
