import React, { useEffect } from 'react';
import styled from 'styled-components';
import { Spell } from '../../DataClasses/PlacedSpells/Spell'
import { useSnapshot } from 'valtio';


// Individual piece styled component
const SpellIcon = styled.div<{ $gridRow: number; $gridCol: number, $url: string, $isRemove: boolean, $color: string }>`
  /* Position the piece inside the specific grid cell */
  grid-row: ${props => props.$gridRow};
  grid-column: ${props => props.$gridCol};

  /* Center the piece asset inside its designated grid cell */
  justify-self: center;
  align-self: center;

  /* Your custom piece styling */
  width: 4.2cqw;
  height: 4.2cqw;
  border-radius: 50%;
  pointer-events: auto; /* Re-enable pointer events for the piece itself */

  /* Animates smooth transitions across grid tracks */
  transition: all 0.25s ease-in-out; 

  background-image: url(${props => props.$url});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: 1;

  ${props => `filter: drop-shadow(0px 0px 5px ${props.$color});`}

  ${props => props.$isRemove && `animation: fade-loop 1s ease-in-out forwards;`}

  @keyframes fade-loop {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

`;
interface SpellComponentProps {
  spell: Spell;
}

export const SpellComponent = ({ spell }: SpellComponentProps) => {
  const spellSnap = useSnapshot(spell);
  const spellName = spellSnap?.getSpellName();
  const cellIndex = spellSnap?.getCellIndex();
  // CSS Grid tracks are 1-indexed, so add 1 to 0-indexed indices
  const gridRow = cellIndex?.i + 1;
  const gridCol = cellIndex?.j + 1;
  const color = spellSnap?.getCaster()?.getColor() || '';
  return (
    <SpellIcon
      key={spellSnap?.key}
      $gridRow={gridRow}
      $gridCol={gridCol}
      $isRemove={spellSnap?.getIsRemove()}
      $color={color}
      $url={`spell-icons/${spellName == 'Gyre' ? spellSnap?.rowShift > 0 ? `${spellName}Up` : `${spellName}Down` : spellName}Icon_mockup.png`}
    />
  );
};
