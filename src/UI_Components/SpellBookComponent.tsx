import React from 'react';
import AutomaticSpellCanvasComponent from './SpellCanvas/AutomaticSpellCanvasComponent';
import styled from 'styled-components';
import { GameSymbol } from '../DataClasses/PlacedSpells/GameSymbol';
import { HARDCODED_SYMBOLS } from '../DataClasses/PlacedSpells/HardCodedSymbols';

// 2. The Main Absolute Anchor in the Top-Right Corner
const MenuAnchor = styled.div`
  position: absolute;
  top: 2cqw;   
  right: 4cqw; 
  z-index: 31;
  
  /* 
    Crucial change: No flexbox layout here. 
    The container will now naturally shrink wrap to match the size 
    of its only non-absolute child: the TriggerBox.
  */
`;

// 3. The Visual Trigger Element (The main box you hover over)
const TriggerBox = styled.div`
  width: 8cqw;
  height: 8cqw;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 2cqw;
  z-index: 3; /* Sits higher than the tray */
  position: relative; /* Gives it local z-index priority */
  cursor: pointer;
  background-image: url("spell-icons/EtherIcon_mockup.png");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  filter: drop-shadow(2px 2px 4px black);
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
  right: 100%; /* Positions the right edge of the tray against the left edge of the anchor */
  padding-right: 1.5cqw; /* Creates the spacing gap from the TriggerBox */
  
  z-index: 2; 
  
  /* Start completely hidden behind the TriggerBox */
  transform: translateX(100%); 
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
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
  width: 6cqw;
  height: 6cqw;
  object-fit: cover;
  border-radius: 4px;
  background-color: transparent;// #444; /* Fallback placeholder color */
  border: 0;// 1px solid #666;
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding-top: 1cqw;
`;

const CanvasContainer = styled.div`
  display: flex;
  position: relative;
  width: 6cqw;
  height: 6cqw;
  // object-fit: cover;
  border-radius: 4px;
  background-color: transparent;// #444; /* Fallback placeholder color */
  transition: transform 0.2s ease, border-color 0.2s ease;
  // padding-top: 1cqw;
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
  const spells = Array.from(GameSymbol.SPELL_NAME_LOOKUP.entries()).map(([inferenceString, spellName]) => <ColumnGroup>
    <SquareImage src={`spell-icons/${spellName}Icon_mockup.png`} alt="SpellImg" />
    <CanvasContainer>
      <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get(inferenceString)} size={'4cqw'} drawSpeed={.6} loopDelay={1000} />
    </CanvasContainer>
  </ColumnGroup>)

  return (
    <MenuAnchor>
      {/* TO-DO: add spell book icon */}
      <TriggerBox><div>Spell</div><div>Book</div></TriggerBox>
      <SlidingTray>
        {spells}
      </SlidingTray>
    </MenuAnchor >
  );
}