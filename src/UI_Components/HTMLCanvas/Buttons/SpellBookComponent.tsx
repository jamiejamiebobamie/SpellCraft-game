import React, { useState } from 'react';
import { rootGameStore } from '../../../DataClasses/store';
import styled, { css, keyframes } from 'styled-components';

const repeatingGlow = keyframes`
  0% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  50% { filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  100% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
`;

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 2cqw;
  left: 3cqw; 
  z-index: 35;
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean, $isOpen: boolean, $isClickedOnce: boolean }>`
  width: 6cqw;
  display: flex;
  flex-direction: column;

  justify-content: center;
  text-align: center;
  align-items: center;

  font-weight: bold;
  font-size: 100%;
  z-index: 3; /* Sits higher than the tray */
  position: relative; /* Gives it local z-index priority */
  cursor: pointer;
    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 150%;
      aspect-ratio: 332/ 307;
      background-image: url(spell-icons/spellbook-icon.png);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
      filter: brightness(.7);
      z-index: -1;
      transition: filter 1s, width 1s;
      ${props => props.$isOpen && 'filter: brightness(.9);'}
  }

  filter: drop-shadow(2px 2px 4px black);
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  color: #2d101099;
  transition: width 1s, filter 1s, transform 1s;

  ${MenuAnchor}:hover & {
    transform: scale(1.2);
    filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3));
    ${props => props.$isOpen && `transform: scale(1.2); filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)) brightness(1.1);`}
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }

  ${MenuAnchor}:hover &::before {
      filter: brightness(.9);
  }

  ${props => props.$isOpen && 'transform: scale(1.1); filter: drop-shadow(2px 2px 4px black) brightness(1.1);'}
  ${props => !props.$isClickedOnce && css`animation: ${repeatingGlow} 7s ease-in-out infinite;`}
`;

const CoverText = styled.div<{ $style?: string; $isClickedOnce: boolean }>`
  width: 100%;
  height: 2cqw;
  display: flex;
  justify-content: flex-end;

  /* 1. DEFAULT FOR REGULAR/LARGE SCREENS */
  transform: translate(0.3cqw, 1.75cqw);

  /* 2. FOR SMALL SCREENS (e.g., Mobile devices under 576px wide) */
  @media (max-width: 576px) {
    transform: translate(0.3dvw, 0.1dvh);
  }

  /* Filter and Dynamic Styles */
  filter: drop-shadow(0 0 0.1cqw rgba(248, 255, 54, 0.3)) 
          drop-shadow(0 0 0.3cqw rgba(250, 245, 144, 0.14));

  ${props => !!props.$style && props.$style}
`;

export default function SpellBookComponent() {
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isClickedOnce, setIsClickedOnce] = useState<boolean>(false);
  return (
    <MenuAnchor data-click-type="ui-buttons">
      <TriggerBox
        onClick={() => setIsOpen(isOpen => {
          setIsClickedOnce(true);
          rootGameStore.setIsSpellBookOpen(!isOpen);
          return !isOpen;
        })}
        onMouseDown={() => setIsClicked(true)}
        onMouseUp={() => setIsClicked(false)}
        $isClicked={isClicked}
        $isOpen={isOpen}
        $isClickedOnce={isClickedOnce}
        title={`${isOpen ? 'Close' : 'Open'} book`}
      >
        <CoverText $isClickedOnce={isClickedOnce}>
          Spell
        </CoverText>
        <CoverText $isClickedOnce={isClickedOnce}>
          Book
        </CoverText>
      </TriggerBox>
    </MenuAnchor >
  );
}