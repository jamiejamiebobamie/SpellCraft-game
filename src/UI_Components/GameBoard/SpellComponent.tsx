import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Spell } from '../../DataClasses/PlacedSpells/Spell'
import { useSnapshot } from 'valtio';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';

// Pass highly dynamic props (x, y, direction) into .attrs() so they become inline styles
const SpellIcon = styled.div.attrs<{ $x: number; $y: number; $direction: number }>(props => ({
  style: {
    left: `${props.$x}px`,
    top: `${props.$y}px`,
    transform: `translate(-50%, -50%) scaleX(${props.$direction})`,
  },
})) <{ $url: string; $isRemove: boolean; $color: string }>`
  position: absolute;

  /* Static dimensions and styles */
  width: 4.2cqw;
  height: 4.2cqw;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;

  background-image: url(${props => props.$url});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;

  /* Your transitions will now work flawlessly because the properties above change smoothly */
  transition: 
    transform 2s ease-in-out, 
    // filter 1s ease-in-out, 
    top .5s ease-in-out, 
    left .5s ease-in-out, 
    opacity 4s ease-in-out;

  filter: drop-shadow(0px 0px 5px ${props => props.$color});

  /* Keep this only if you want the fade-loop to override the opacity transition upon removal */
  ${props => props.$isRemove && `animation: fade-loop 1s ease-in-out forwards;`}

  @keyframes fade-loop {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

type CoordsXY = {
  x: number;
  y: number;
}

interface SpellComponentProps {
  spell: Spell;
  gridOverlayRef: HTMLDivElement | null;
}
export const SpellComponent = ({ gridOverlayRef, spell }: SpellComponentProps) => {
  const spellSnap = useSnapshot(spell);
  const spellName = spellSnap?.getSpellName();
  const cellIndex = spellSnap?.getCellIndex();
  const color = spellSnap?.getCaster()?.getColor() || '';
  const getCoordsXY = useCallback((): CoordsXY => {
    const coords = { x: 0, y: 0 }
    if (!!gridOverlayRef && !!gridOverlayRef.current && !!gridOverlayRef.current.getBoundingClientRect) {
      const { width, height } = gridOverlayRef.current.getBoundingClientRect();
      const x = ((cellIndex.j + 1) * 2 - 1) / (GameBoard.NUM_COLS * 2) * width;
      const y = ((cellIndex.i + 1) * 2 - 1) / (GameBoard.NUM_ROWS * 2) * height;
      coords.x = x;
      coords.y = y;
    }
    return coords
  }, [cellIndex]);

  const coords: CoordsXY = getCoordsXY();
  return (
    <SpellIcon
      $x={coords.x}
      $y={coords.y}
      $isRemove={spellSnap?.getIsRemove()}
      $color={color}
      $direction={Math.sign(spellSnap.getPropertyValue('speedDirection'))}
      $url={`spell-icons/${spellName}Icon_mockup.png`}
    />
  );
};