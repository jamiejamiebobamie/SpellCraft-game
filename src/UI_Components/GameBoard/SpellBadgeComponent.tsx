
import React from 'react';
import styled, { keyframes } from 'styled-components';

const popIn = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.4); /* Scales up by 40% to grab attention */
  }
  100% {
    transform: scale(1); /* Returns to normal size */
  }
`;

const SpellBadge = styled.div<{
    $left?: string;
    $right?: string;
    $bottom?: string;
    $top?: string;
    $content?: string;
    $contentColor?: string;
    $opacity: number;
    $backgroundColor: string;
    $color: string;
}>`
    position: absolute;
    font-size: 1cqw;
    display: flex;
    flex-direction: column;
    align-self: center;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 1.5cqw;
    height: 1.5cqw; 
    border-radius: 50%;

    transform-style: preserve-3d;

    animation: ${popIn} 0.4s ease-out forwards;
    transition: opacity 2s, transform 0.2s; 

    ${props => props.$left && `left: ${props.$left};`}
    ${props => props.$right && `right: ${props.$right};`}
    ${props => props.$top && `top: ${props.$top};`}
    ${props => props.$bottom && `bottom: ${props.$bottom};`}
    background-color: ${props => props.$backgroundColor};
    color: ${props => props.$color};
    opacity: ${props => props.$opacity};
    
  &::before {
    content: ${props => props.$content};
    color: ${props => props.$contentColor};
    z-index: -1;
    position: absolute;
  }
`;

interface BadgeComponentProps {
    propertyName: string;
    propertyValue: number;
    isDisplayBadgeCondition: (propertyValue: number) => boolean;
    isAnim?: boolean;
    $left?: string;
    $right?: string;
    $bottom?: string;
    $top?: string;
    $content?: string;
    $contentColor?: string;
    $opacityCondition: (propertyValue: number) => number;
    $backgroundColor: string;
    $color: string;
}

/*
  TO-DO:
    Consider "Consumed!" and "Deflected!" modifer text spawned when
      a spell is consumed or if the consumer is "deflected" from consuming
      a spell due to too-low 'dmgHealth' stat.
      
*/
export const SpellBadgeComponent = ({
    propertyName,
    propertyValue,
    isAnim = true,
    isDisplayBadgeCondition,
    $left,
    $right,
    $bottom,
    $top,
    $content,
    $contentColor,
    $opacityCondition,
    $backgroundColor,
    $color,
}: BadgeComponentProps) => {

    return !!propertyValue && isDisplayBadgeCondition(propertyValue) && (
        <>
            <SpellBadge
                $opacity={$opacityCondition(propertyValue)}
                $top={$top}
                $left={$left}
                $right={$right}
                $bottom={$bottom}
                $backgroundColor={$backgroundColor}
                $content={$content}
                $contentColor={$contentColor}
                $color={$color}>
                {Math.abs(propertyValue)}
            </SpellBadge>
        </>
    )
}
