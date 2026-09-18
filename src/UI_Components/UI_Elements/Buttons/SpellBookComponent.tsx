import React, { useState } from 'react';
import AutomaticSpellCanvasComponent from '../../SpellCanvas/AutomaticSpellCanvasComponent';
import { GameSymbol } from '../../../DataClasses/PlacedSpells/GameSymbol';
import { HARDCODED_SYMBOLS } from '../../../DataClasses/PlacedSpells/HardCodedSymbols';
import styled from 'styled-components';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 3cqw;   
  left: 4cqw; 
  z-index: 35;
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean, $isOpen: boolean }>`
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
    transform: scale(1.1);
    filter: drop-shadow(0px 0px 10px white);
    ${props => props.$isClicked && 'transform: scale(.9);'}
    ${props => props.$isOpen && 'filter: drop-shadow(0px 0px 20px black);'}
  }
  ${props => props.$isOpen && 'filter: drop-shadow(0px 0px 20px black);'}
`;

// The Tray holding the columns
const SlidingTray = styled.div<{ $isOpen: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 0.5cqw;

  background-color: #0000007f;
  padding: .25cqw .25cqw;
  corner-shape: squircle;
  border-radius: 1cqw;

  /* 
    By setting this to absolute, it is completely removed from the 
    MenuAnchor's dimensional size calculations.
  */
  position: absolute;
  top: 0;
  left: 120%; /* Positions the right edge of the tray against the left edge of the anchor */
  
  z-index: 2; 
  
  /* Start completely hidden behind the TriggerBox */
  transform: translateX(-100%); 
  opacity: 0;
  transition: transform 1s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
  pointer-events: none; 
  ${props => props.$isOpen && 'transform: translateX(0); opacity: 1; pointer-events: auto;'}
`;

// The Square Images inside the columns
const SquareImage = styled.img`
  width: 4cqw;
  height: 4cqw;
  object-fit: cover;
  border-radius: 4px;
  background-color: transparent;
  border: 0;
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
  const snap = useSnapshot(rootGameStore);
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [hoveredSpell, setHoveredSpell] = useState<string | null>(null);
  const spells = Array.from(GameSymbol.SPELL_LOOKUP.entries()).map(([inferenceString, spellClass]) => (
    <ColumnGroup
      $isClicked={isClicked}
      // isClicked}
      key={spellClass.name}
      onClick={() => {
        rootGameStore.instantiateGameSymbolFromInferenceString(inferenceString);
      }}
      onMouseEnter={() => snap.setHoveredSpellBookSpell(spellClass)}
      onMouseLeave={() => snap.setHoveredSpellBookSpell(null)}
    >
      <SquareImage src={`spell-icons/${spellClass.name}Icon_mockup.png`} draggable="false" alt="SpellImg" />
      <CanvasContainer>
        <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get(inferenceString)} size={'4cqw'} drawSpeed={.1} loopDelay={4000} isLooped={isOpen}/>
      </CanvasContainer>
    </ColumnGroup>))
  return (
    <MenuAnchor
      data-click-type="ui-buttons"
    // onMouseEnter={() => setIsHovered(true)}
    // onMouseLeave={() => setIsHovered(false)}
    >
      <TriggerBox
        onClick={() => setIsOpen(isOpen => {
          rootGameStore.setIsSpellBookOpen(!isOpen);
          if(!isOpen) rootGameStore.pauseClock();
          else rootGameStore.unpauseClock();
          return !isOpen;
        })}
        onMouseDown={() => setIsClicked(true)}
        onMouseUp={() => setIsClicked(false)}
        $isClicked={isClicked}
        $isOpen={isOpen}
      >
        <div style={{ paddingTop: '.5cqw' }}>
          Spell
        </div>
        <div>
          Book
        </div>
      </TriggerBox>
      <SlidingTray $isOpen={isOpen}>
        {spells}
      </SlidingTray>
    </MenuAnchor >
  );
}