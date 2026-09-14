import React, { useState, useEffect, useRef } from 'react';
import { rootGameStore } from '../../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';

const darkRed = '#cf2b2b';
const darkGreen = '#2e5e18';

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 3cqw;   
  right: 4cqw; 
  z-index: 35;
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean }>`
  width: 6cqw;
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
  background-image: url("mask-icon.png");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  filter: drop-shadow(2px 2px 4px black);
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  color: ${darkRed};
  transition: filter 1s, transform .5s;
  ${MenuAnchor}:hover & {
    transform: scale(1.1);
    filter: drop-shadow(0px 0px 10px ${darkRed});
    ${props => props.$isClicked && 'transform: scale(.9);'}

  }
`;

const DifficultyText = styled.div<{ $isHovered: boolean, $zIndex: number, $fontSize?: string, $color?: string }>`
  position: absolute;
  top: .15cqw;
  text-align: center;
  align-self: center;
  padding-top: .5cqw;
  transition: color .5s, opacity .5s;
  ${props => props.$fontSize && `font-size: ${props.$fontSize};`}
  z-index: ${props => props.$zIndex};
  opacity: ${props => props.$isHovered ? 1 : 0};
   ${props => props.$color && `color: ${props.$color};`}
`;

export default function NpcDifficultyComponent() {
  const timeoutRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isClicked, setIsClicked] = useState<boolean>(false);

  const snap = useSnapshot(rootGameStore);
  const difficulty = snap.getNpcDifficulty();

  useEffect(() => {
    if (!isClicked && !isHovered) { // use changed difficulty with keyboard key. show change on UI.
      setIsHovered(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsHovered(false), 2000);
    }
  }, [difficulty]);
  return (
    <MenuAnchor
      title='Click to change...'
      onMouseEnter={() => { setIsHovered(true); clearTimeout(timeoutRef.current); }}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
      onClick={() => rootGameStore.cycleThroughDifficulties()}
      data-click-type="ui-buttons"
    >
      <TriggerBox $isClicked={isClicked}>
        <DifficultyText
          $isHovered={!isHovered}
          $zIndex={2}
          $fontSize={'1.7cqw'}
          $color={isHovered ? darkRed : darkGreen}
        >
          Difficulty
        </DifficultyText>
        <DifficultyText
          $isHovered={isHovered}
          $zIndex={1}
          $fontSize={'2.2cqw'}
        >
          {difficulty}
        </DifficultyText>
      </TriggerBox>
    </MenuAnchor >
  );
}

/*

        <div
          style={{
            paddingTop: '.5cqw',
            paddingBottom: '0cqw',
            textAlign: 'center',
            fontSize: '1.5cqw',
            zIndex: 2
          }}>
          Difficulty
        </div>
        <div
          style={{
            // marginTop: '-0.5cqw',
            textAlign: 'center',
            zIndex: 1
          }}
        >{difficulty}
        </div>
*/