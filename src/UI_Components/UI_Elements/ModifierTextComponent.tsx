
import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

// 3. Shift: Subtle horizontal translation
const riseDriftFade = keyframes`
  0% { 
    transform: translate(0cqw, 0dvh) var(--extra-transform, );; 
    opacity: 0; 
  }
  20% { 
    transform: translate(1.75cqw, -5dvh) var(--extra-transform, );; 
    opacity: 1; 
  }
 50% { 
    opacity: .2; 
  }
  100% { 
    transform: translate(-1.75cqw, -50dvh) var(--extra-transform, );; 
    opacity: 0; 
  }
`;

const ModifierText = styled.div<{
    $width: string;
    $height: string;
    $fontSize: string;
    $extraTransform?: string;
    $left?: string;
    $right?: string;
    $bottom?: string;
    $top?: string;
    $content?: string;
    $contentColor?: string;
    $opacity: number;
    $backgroundColor: string;
    $color: string;
    $animDuration: number;
}>`
    position: absolute;
    width: ${props => props.$width};
    height: ${props => props.$height};
    font-size: ${props => props.$fontSize};
    z-index: 50;

    display: flex;
    align-self: center;
    align-items: center;
    justify-content: center;
    text-align: center;

    ${props => props.$left && `left: ${props.$left};`}
    ${props => props.$right && `right: ${props.$right};`}
    ${props => props.$top && `top: ${props.$top};`}
    ${props => props.$bottom && `bottom: ${props.$bottom};`}
    color: ${props => props.$backgroundColor};

    ${props => props.$extraTransform && `--extra-transform: ${props.$extraTransform};`}

    animation: ${riseDriftFade} ${props => props.$animDuration}s ease-out 1;
`;

const usePropertyValue = (propertyValue: number | undefined, animDurationSeconds: number): boolean => {
    // 1. Change this from a Ref to a State boolean
    const [isShowModifier, setIsShowModifier] = useState<boolean>(false);
    const timeoutRef = useRef<number | any>(0);
    const [cachedVal, setCachedVal] = useState<number>(0);

    useEffect(() => {
        if (propertyValue == undefined) {
            setCachedVal(0);
        } else if (cachedVal != propertyValue) {
            setCachedVal(propertyValue);

            if (!!propertyValue) {
            clearTimeout(timeoutRef.current);

            // 2. Set to true to mount the element and fire the animation
            setIsShowModifier(true);

            timeoutRef.current = setTimeout(() => {
                setIsShowModifier(false); // 3. Set to false to unmount it after the animation ends
            }, animDurationSeconds * 1000);
            }
        }
    }, [propertyValue, cachedVal, animDurationSeconds]);

    // Return the state value
    return isShowModifier;
};

interface ModifierTextComponentProps {
    propertyName: string;
    propertyValue: number;
    isResetValOnTimeout?: boolean;
    animTimeSecs?: number;
    $width: string;
    $height: string;
    $fontSize: string;
    $extraTransform?: string;
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

export const ModifierTextComponent = ({
    propertyName,
    propertyValue,
    animTimeSecs = 4,
    $width,
    $height,
    $fontSize,
    $extraTransform='',
    $left,
    $right,
    $bottom,
    $top,
    $content,
    $contentColor,
    $opacityCondition,
    $backgroundColor,
    $color,
}: ModifierTextComponentProps) => {
    const isShowModifier = usePropertyValue(propertyValue, animTimeSecs);

    return isShowModifier && <ModifierText
        $opacity={$opacityCondition(propertyValue)}
        $width={$width}
        $height={$height}
        $fontSize={$fontSize}
        $extraTransform={$extraTransform}
        $top={$top}
        $left={$left}
        $right={$right}
        $bottom={$bottom}
        $backgroundColor={$backgroundColor}
        $content={$content}
        $contentColor={$contentColor}
        $color={$color}
        $animDuration={animTimeSecs}>
        {propertyValue > 0 ? "+" : ""}{propertyValue}{' '}{propertyName}
    </ModifierText>
}
