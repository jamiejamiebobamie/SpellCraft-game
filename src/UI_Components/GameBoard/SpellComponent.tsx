import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Spell } from '../../DataClasses/PlacedSpells/Spell'
import { useSnapshot } from 'valtio';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { PlacedSpells } from '../../DataClasses/PlacedSpells/PlacedSpells';

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

  transition: 
    transform ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI/1000}s ease-in-out, 
    top ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI/1000}s ease-in-out, 
    left ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI/1000}s ease-in-out, 
    opacity ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI/1000}s ease-in-out;

  opacity: ${props => props.$isRemove ? 0 : 1};
  filter: drop-shadow(0px 0px 5px ${props => props.$color});
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