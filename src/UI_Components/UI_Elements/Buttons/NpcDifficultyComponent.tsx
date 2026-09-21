import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from '../UseLocalStorage';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';
import { NpcDifficulty } from '../../../DataClasses/types';

const darkRed = '#cf2b2b';
// const darkerRed = '#883535';
// const darkGreen = '#2e5e18';

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 1cqw;   
  right: 4cqw; 
  z-index: 35;
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
  color: ${darkRed};
  transition: filter 1s, transform .5s;
  ${MenuAnchor}:hover & {
    transform: scale(1.1);
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }
`;

const smolderKeyframes = keyframes`
  0%, 100% {
    text-shadow: 
      0 1px 3px rgba(255, 68, 0, 0.6), 
      0 2px 10px rgba(255, 102, 0, 0.4);
  }
  50% {
    text-shadow: 
      0 1px 4px rgba(255, 102, 0, 0.8), 
      0 3px 15px rgba(255, 204, 0, 0.5);
  }
`;

const DifficultyText = styled.div<{ $isHovered: boolean, $zIndex: number, $isAnim: boolean, $fontSize?: string, $color?: string, $textStroke?: number }>`
  position: absolute;
  top: 10cqw;
  text-align: center;
  align-self: center;
  padding-top: .5cqw;
  transition: color 1s, opacity 1s, filter .5s;
  ${props => props.$fontSize && `font-size: ${props.$fontSize};`}
  z-index: ${props => props.$zIndex};
   ${props => props.$color && `color: ${props.$color};`}
   ${props => `opacity: ${props.$isHovered ? 1 : 0};`}
   animation: ${props => props.$isHovered && props.$isAnim && smolderKeyframes} 4s ease-in-out infinite;
  ${props => props.$textStroke && `-webkit-text-stroke: ${props.$textStroke}cqw rgb(7 55 7);`}
  ${props => props.$isHovered && (props.$textStroke ? 'filter: drop-shadow(0px 0px 9px #00000064) drop-shadow(0px 0px 5px #000000)  drop-shadow(0px 0px 3px #65a333);' : 'filter: drop-shadow(0px 0px 9px #00000064) drop-shadow(0px 0px 5px #000000);')}
`;

const MaskIcon = styled.div<{ $zIndex: number, $isShow: boolean, $difficulty: NpcDifficulty }>`
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: ${props => props.$zIndex};
  opacity: ${props => props.$isShow ? 1 : 0};
  transition: opacity .5s;
  background-image: url(${props => `mask-icons/${Math.abs(props.$zIndex)}mask-icon-${props.$difficulty}.png`});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  ${props => props.$difficulty == 'Normal' ? 'filter: drop-shadow(2px 2px 4px black) brightness(.95);' : `filter: drop-shadow(0px 0px 10px ${darkRed}) brightness(.9);`}
  transition: filter 1s, opacity .5s;
  ${MenuAnchor}:hover & {
    filter: drop-shadow(0px 0px 10px ${darkRed}) brightness(1.1);
  }
`;

export default function NpcDifficultyComponent() {
  const localStorageKey = 'quickCast-npcDifficulty';
  const timeoutRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isClickedOnce, setIsClickedOnce] = useState<boolean>(false);
  const snap = useSnapshot(rootGameStore);
  const difficulty: NpcDifficulty = snap.getNpcDifficulty();

  useEffect(() => {
    const item = window.localStorage.getItem(localStorageKey);
    let val = undefined;
    try {
      if (item) {
        val = JSON.parse(item);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key :`, error);
    }
    if (val) {
      setIsClickedOnce(true);
      rootGameStore.setNpcDifficulty(val);
      rootGameStore.forceUpdate();
    }
  }, [])

  useEffect(() => {
    if (isClickedOnce && !isClicked && !isHovered) { // use changed difficulty with keyboard key. show change on UI.
      setIsHovered(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsHovered(false), 2000);
    }
  }, [difficulty, isClickedOnce]);
  return (
    <MenuAnchor
      onMouseEnter={() => { setIsHovered(true); clearTimeout(timeoutRef.current); }}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
      onClick={() => {
        rootGameStore.cycleThroughDifficulties();
        const difficulty = rootGameStore.getNpcDifficulty();
        window.localStorage.setItem('quickCast-npcDifficulty', JSON.stringify(difficulty));
        setIsClickedOnce(true);
      }}
      data-click-type="ui-buttons"
    >
      <TriggerBox $isClicked={isClicked}>
        <DifficultyText
          $isHovered={!isHovered && !isClickedOnce}
          $zIndex={5}
          $fontSize={'2.4cqw'}
          $isAnim={false}
          $color={'#65a333'}
          $textStroke={.01}
        >
          Difficulty
        </DifficultyText>
        <DifficultyText
          $isHovered={isHovered}
          $zIndex={4}
          $fontSize={'2.2cqw'}
          $isAnim={isHovered}
        >
          {difficulty}
        </DifficultyText>
        <MaskIcon $zIndex={1} $isShow={true} $difficulty={'Normal'} />
        <MaskIcon $zIndex={2} $isShow={difficulty == 'Hard'} $difficulty={'Hard'} />
        <MaskIcon $zIndex={3} $isShow={difficulty == 'Brutal'} $difficulty={'Brutal'} />
      </TriggerBox>
    </MenuAnchor >
  );
}