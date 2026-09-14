import React, { useState } from 'react';
import AutomaticSpellCanvasComponent from '../SpellCanvas/AutomaticSpellCanvasComponent';
import { GameSymbol } from '../../DataClasses/PlacedSpells/GameSymbol';
import { HARDCODED_SYMBOLS } from '../../DataClasses/PlacedSpells/HardCodedSymbols';
import styled from 'styled-components';
import { rootGameStore } from '../../DataClasses/store';

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 3cqw;   
  left: 4cqw; 
  z-index: 35;
`;

// The Visual Trigger Element
const TriggerBox = styled.div`
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
  background-image: url("spell-icons/spellbook-icon.png");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  filter: drop-shadow(2px 2px 4px black);
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  color: #ff8d80;
  transition: filter, transform 1s;
  ${MenuAnchor}:hover & {
    transform: skewX(5deg) skewY(-15deg) rotateX(45deg) scaleY(1.5) translateY(1cqw);
    filter: drop-shadow(0px 0px 10px white);
  }
`;

// The Tray holding the columns
const SlidingTray = styled.div`
  display: flex;
  flex-direction: row;
  gap: 1.5cqw;
  
  /* 
    By setting this to absolute, it is completely removed from the 
    MenuAnchor's dimensional size calculations.
  */
  position: absolute;
  top: 0;
  left: 100%; /* Positions the right edge of the tray against the left edge of the anchor */
  padding-left: 1.5cqw; /* Creates the spacing gap from the TriggerBox */
  
  z-index: 2; 
  
  /* Start completely hidden behind the TriggerBox */
  transform: translateX(-100%); 
  opacity: 0;
  transition: transform 1s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
  pointer-events: none; 

  /* Trigger slide-out when the user hovers over the MenuAnchor */
  ${MenuAnchor}:hover & {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto; 
  }
`;

// The Square Images inside the columns
const SquareImage = styled.img`
  width: 4cqw;
  height: 4cqw;
  object-fit: cover;
  border-radius: 4px;
  background-color: transparent;// #444; /* Fallback placeholder color */
  border: 0;// 1px solid #666;
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding: .5cqw;
  pointer-events: none;
`;

const CanvasContainer = styled.div`
  display: flex;
  position: relative;
  width: 4cqw;
  height: 4cqw;
  border-radius: 4px;
  background-color: transparent;
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding: .5cqw;
  pointer-events: none;
`;

// Each Individual Slide-Out Column Group
const ColumnGroup = styled.div<{ $isClicked: boolean }>`
  display: flex;
  position: relative;
  flex-direction: column;
  gap: .1cqw;
  &:hover ${SquareImage},
  &:hover  ${CanvasContainer} {
    transform: scale(1.25);
    transition: transform .5s;
    cursor: pointer;
    pointer-events: auto;
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }
`;

export default function SpellBookComponent() {
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  const spells = Array.from(GameSymbol.SPELL_LOOKUP.entries()).map(([inferenceString, spellClass]) => (
    <ColumnGroup
      $isClicked={isClicked}
      key={spellClass.name}
      onClick={() => {
        rootGameStore.instantiateGameSymbolFromInferenceString(inferenceString);
      }}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
    >
      <SquareImage src={`spell-icons/${spellClass.name}Icon_mockup.png`} draggable="false" alt="SpellImg" />
      <CanvasContainer>
        <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get(inferenceString)} size={'4cqw'} drawSpeed={.6} loopDelay={1000} isLooped={isHovered} />
      </CanvasContainer>
    </ColumnGroup>))
  return (
    <MenuAnchor
      data-click-type="ui-buttons"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TriggerBox>
        <div style={{ paddingTop: '.5cqw' }}>
          Spell
        </div>
        <div>
          Book
        </div>
      </TriggerBox>
      <SlidingTray>
        {spells}
      </SlidingTray>
    </MenuAnchor >
  );
}