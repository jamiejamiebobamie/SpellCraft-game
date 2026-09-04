import React, { useState } from 'react';
import AutomaticSpellCanvasComponent from '../SpellCanvas/AutomaticSpellCanvasComponent';
import { GameSymbol } from '../../DataClasses/PlacedSpells/GameSymbol';
import { HARDCODED_SYMBOLS } from '../../DataClasses/PlacedSpells/HardCodedSymbols';
import styled from 'styled-components';

// 2. The Main Absolute Anchor in the Top-Right Corner
const MenuAnchor = styled.div`
  position: absolute;
  top: 3cqw;   
  left: 4cqw; 
  z-index: 35;
`;

// 3. The Visual Trigger Element (The main box you hover over)
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

// 4. The Tray holding the columns (Now uses absolute positioning)
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
  padding: 1cqw;
`;

const CanvasContainer = styled.div`
  display: flex;
  position: relative;
  width: 4cqw;
  height: 4cqw;
  border-radius: 4px;
  background-color: transparent;// #444; /* Fallback placeholder color */
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding: 1cqw;
`;

// Each Individual Slide-Out Column Group
const ColumnGroup = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  gap: 1cqw;
  &:hover ${SquareImage},
  &:hover  ${CanvasContainer} {
  transform: scale(1.25);
  cursor: pointer;
}
`;

export default function SpellBookComponent() {
  const [isHovered, setIsHovered] = useState(false);
  const spells = Array.from(GameSymbol.SPELL_NAME_LOOKUP.entries()).slice(0,4).map(([inferenceString, spellName]) => <ColumnGroup>
    <SquareImage src={`spell-icons/${spellName}Icon_mockup.png`} alt="SpellImg" />
    <CanvasContainer>
      <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get(inferenceString)} size={'4cqw'} drawSpeed={.6} loopDelay={1000} isLooped={isHovered} />
    </CanvasContainer>
  </ColumnGroup>)

  return (
    <MenuAnchor
      data-click-type="ui-buttons"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      >
      <TriggerBox><div style={{ paddingTop: '.5cqw' }}>Spell</div><div>Book</div></TriggerBox>
      <SlidingTray>
        {spells}
      </SlidingTray>
    </MenuAnchor >
  );
}