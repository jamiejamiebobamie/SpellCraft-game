import React from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import styled, { keyframes, css } from 'styled-components';

// 1. Define types for our programmable props
interface ArcContainerProps {
    $width: string;
    $height: string;
    $top: string;
    $left: string;
    $isDisplay: boolean;
}

interface ArcSVGProps {
    $direction: 'left' | 'right';
    $animDelay: number;
}

// 2. Define the keyframe animation for the sliding highlight
// For a filled crescent, we use linear-gradient masks to slide a window of visibility
const slideHighlight = keyframes`
  0% {
    mask-position: -150% 0%;
  }
  100% {
    mask-position: 250% 0%;
  }
`;

// 3. Absolute positioned wrapper container
const ArcContainer = styled.div<ArcContainerProps>`
  display: ${props => props.$isDisplay ? 'block' : 'none'};
  position: absolute;
  z-index: 10;
//   width: ${props => props.$width};
//   height: ${props => props.$height};
    // width: 8cqw;
    // height: 10cqw;

        width: 7cqw;
    height: 10cqw;

  top: ${props => props.$top};
  left: ${props => props.$left};

  transform: translate(-50%, -110%);
  pointer-events: none; /* Prevents blocking clicks underneath */
`;

    // drop-shadow(0px 0px .4cqw #ffffff)       /* Core intensity glow */
    // drop-shadow(0px 0px .8cqw #ffffff)      /* Medium surrounding glow */
    // drop-shadow(0px 0px 1cqw rgba(255, 255, 255, 0.6)); /* Deep ambient radiance */

// 4. Styled SVG element that handles the glow and direction mirroring
const StyledArcSVG = styled.svg<ArcSVGProps>`
  width: 100%;
  height: 100%;
  /* CRITICAL: Allows the surrounding glow to radiate outside the SVG box boundaries */
  overflow: visible; 

  /* 
    SURROUNDING WHITE GLOW EFFECTS:
    Instead of box-shadow, we stack drop-shadow filters. 
    They wrap perfectly around the curved vector paths and sharp points.
  */
  filter: 
    // drop-shadow(0px 0px .4cqw ${props => props.$direction == 'right' ? 'blue' : 'red'})       /* Core intensity glow */
    // drop-shadow(0px 0px .8cqw ${props => props.$direction == 'right' ? 'blue' : 'red'})      /* Medium surrounding glow */
    drop-shadow(0px 0px 1cqw ${props => props.$direction == 'right' ? 'blue' : 'red'}); /* Deep ambient radiance */


  /* Programmatically flip the direction of the crescent if set to 'left' */
  ${props =>
        props.$direction === 'left' &&
        css`
      transform: scaleX(-1);
    `}

  /* The interior sliding highlight effect using a CSS mask */
  .highlight-layer {
    /* Transparent at edges, bright white in the center band */
    mask-image: linear-gradient(
      90deg, 
      rgba(0,0,0,0) 0%, 
      rgba(0,0,0,1) 30%, 
      rgba(0,0,0,1) 70%, 
      rgba(0,0,0,0) 100%
    );
    mask-size: 20% 100%; /* Controls the width of the sliding highlight window */
    mask-repeat: no-repeat;
    animation: ${slideHighlight} 1.75s ease-out infinite;
    animation-delay: ${props => -props.$animDelay / GameBoard.NUM_COLS}s;
  }
`;

// 5. Main Component Props
interface CrescentArcProps {
    width?: string;
    height?: string;
    top?: string;
    left?: string;
    direction: number;
    isDisplay: boolean;
    animDelay: number;
}

export const CrescentArc: React.FC<CrescentArcProps> = ({
    width = '10cqw',
    height = '5cqw',
    top = '0cqw',
    left = '0cqw',
    direction = 1,
    isDisplay = false,
    animDelay = 0
}) => {
    // SVG Path definition:
    // M 5,95        -> Start at left tip (bottom left area)
    // A 90,90 ...   -> Sweep up to the right tip creating the deep outer arc
    // A 100,75 ...  -> Sweep back down using a tighter arc to carve out a sharp crescent body
    // Z             -> Close the path precisely at the starting point to lock in sharp points
    const crescentPathD = "M 5,95 A 90,90 0 0,1 95,95 A 100,75 0 0,0 5,95 Z";

    return (
        <ArcContainer
            $isDisplay={isDisplay}
            $width={width}
            $height={height}
            $top={top}
            $left={left}
        >
            <StyledArcSVG viewBox="0 0 100 100" preserveAspectRatio="none" $direction={direction > 0 ? 'right' : 'left'} $animDelay={animDelay}>

                {/* Base Crescent Body (Low opacity background layer) */}
                <path
                    d={crescentPathD}
                    // fill="rgba(255, 255, 255, 0.15)"
                    // stroke='rgba(255, 255, 255, 0.16)'
                    fill="rgba(255, 255, 255, 0.05)"
                    stroke='rgba(255, 255, 255, 0.05)'

                />

                {/* Interior Sliding Highlight Crescent Layer */}
                <path
                    className="highlight-layer"
                    d={crescentPathD}
                    fill="#ffffff"
                />

            </StyledArcSVG>
        </ArcContainer>
    );
};
