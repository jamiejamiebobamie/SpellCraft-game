import React, { useState } from 'react';
import styled from 'styled-components';

// The Main Absolute Anchor
const MenuAnchor = styled.div<{ $isShowingModal: boolean }>`
  display:${props => props.$isShowingModal ? 'none' : 'initial'};
  position: absolute;
  bottom: 1cqw;   
  left: 47.5cqw; 
  z-index: 35;
  filter: brightness(${props => props.$isShowingModal ? .55 : 1});
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean }>`
  width: 5.5cqw;
  height: 5.5cqw;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  color: white;
  font-weight: bold;
  font-size: 2cqw;
  z-index: 3; /* Sits higher than the tray */
  position: relative; /* Gives it local z-index priority */
  cursor: pointer;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  transition: filter 1s, transform .5s;
  ${MenuAnchor}:hover & {
    transform: scale(1.1);
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }

  &::before{
    position: absolute;
    bottom: 0;
    left: 50%;
    color: grey;
    content: '\u2699\uFE0F';
    transform: translate(-50%,-50%);
    filter: brightness(.5) drop-shadow(.2cqw .2cqw .3cqw black);
    font-size: 5cqw;
  }
`;

type KeyBindingComponentProps = {
  isShowingModal: boolean;
  setIsGearHovered: Function;
}

export default function KeyBindingComponent({ isShowingModal, setIsGearHovered }: KeyBindingComponentProps) {
  const [isClicked, setIsClicked] = useState<boolean>(false);
  return (
    <MenuAnchor $isShowingModal={isShowingModal} data-click-type="ui-buttons">
      <TriggerBox
        onMouseEnter={() => setIsGearHovered(true)}
        onMouseLeave={() => setIsGearHovered(false)}
        onMouseDown={() => setIsClicked(true)}
        onMouseUp={() => setIsClicked(false)}
        $isClicked={isClicked} title={'Controls'} />
    </MenuAnchor >
  );
}