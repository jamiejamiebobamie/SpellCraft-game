import React, { useState } from 'react';
import styled from 'styled-components';

// The Main Absolute Anchor
const MenuAnchor = styled.div<{ $isShowingModal: boolean }>`
  display:${props => props.$isShowingModal ? 'none' : 'initial'};
  position: absolute;
  bottom: 1cqw;   
  left: 45cqw; 
  z-index: 35;
  filter: brightness(${props => props.$isShowingModal ? .55 : 1});
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean }>`
  width: 8.5cqw;
  aspect-ratio: 58/73;
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
    
  background-color: red;

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