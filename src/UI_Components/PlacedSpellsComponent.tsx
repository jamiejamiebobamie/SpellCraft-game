import React, { useEffect } from 'react';
import styled from 'styled-components';
import { PlacedSpells } from '../DataClasses/PlacedSpells/PlacedSpells'
import { Spell } from '../DataClasses/PlacedSpells/Spell'
import { SpellComponent } from './SpellComponent';
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

export const PlacedSpellsComponent = (placedSpellsSnap: PlacedSpells) => {
  // const spellsSnap = useSnapshot(placedSpells);
  // useEffect(() => {console.log({ placedSpellsSnap })},[placedSpellsSnap])
  // console.log({ placedSpellsSnap })
  return (
    <GridOverlay>
      {placedSpellsSnap.spells.map(s => 
        SpellComponent(s)
        // const spellName = s.getSpellName();
        // const cellIndex = s.getCellIndex();
        // if (!cellIndex) return <></>;
        // // CSS Grid tracks are 1-indexed, so add 1 to 0-indexed indices
        // const gridRow = cellIndex.i + 1;
        // const gridCol = cellIndex.j + 1;
        // return (
        //   <SpellIcon
        //     key={s.key}
        //     $gridRow={gridRow}
        //     $gridCol={gridCol}
        //     $url={`spell-icons/${spellName}Icon_mockup.png`}
        //   />
        // );
      )}
    </GridOverlay>
  );
};
