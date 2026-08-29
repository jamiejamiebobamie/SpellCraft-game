import React from 'react';
import styled from 'styled-components';
import { PlacedSpells } from '../DataClasses/PlacedSpells/PlacedSpells'
import { useSnapshot } from 'valtio';

// This container perfectly clones your board's grid structure
const GridOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through to cells below */
  
  /* Mirroring your exact grid configuration */
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
`;

// Individual piece styled component
const SpellIcon = styled.div<{ $gridRow: number; $gridCol: number, $url: string }>`
  /* Position the piece inside the specific grid cell */
  grid-row: ${props => props.$gridRow};
  grid-column: ${props => props.$gridCol};

  /* Center the piece asset inside its designated grid cell */
  justify-self: center;
  align-self: center;

  /* Your custom piece styling */
//   width: 3.2cqw;
//   height: 3.2cqw;
  width: 4.2cqw;
  height: 4.2cqw;
//   background-color: #ff4757;
  border-radius: 50%;
  pointer-events: auto; /* Re-enable pointer events for the piece itself */

  /* Animates smooth transitions across grid tracks */
  transition: all 0.25s ease-in-out; 

  background-image: url(${props => props.$url});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: 1;
`;

export const PlacedSpellsComponent = (placedSpells: PlacedSpells) => {
  const snap = useSnapshot(placedSpells);
  // TO-DO: test PlacedSpells movement on board, when they change cellIndices...
    return (
        <GridOverlay>
            {snap.spells.map((s, i) => {
                const spellName = s.getSpellName();
                const cellIndex = s.getCellIndex();

                // console.log({ cellIndex, spellName })

                if(!cellIndex) return '';

                // CSS Grid tracks are 1-indexed, so we add 1 to your 0-indexed indices
                const gridRow = cellIndex.i + 1;
                const gridCol = cellIndex.j + 1;

                return (
                    <SpellIcon
                        // TO-DO: add keys to all data objects that change and need to be collectively rendered.
                        // remove key={i} and add key={s.key}
                        key={i}
                        $gridRow={gridRow}
                        $gridCol={gridCol}
                        $url={`spell-icons/${spellName}Icon_mockup.png`}
                    />
                );
            })}
        </GridOverlay>
    );
};
