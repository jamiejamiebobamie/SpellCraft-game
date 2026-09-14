import React, { useCallback } from 'react';
import { Spell } from '../../DataClasses/PlacedSpells/Spell'
import { useSnapshot } from 'valtio';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { PlacedSpells } from '../../DataClasses/PlacedSpells/PlacedSpells';
import { caughtInGyre } from "./SpellAnims"
import { noAnim } from '../Player/CharacterParts';
import styled from 'styled-components';

// Controls movement across the board, "facing" direction, and "opacity fade" removal. 
export const SpellIcon = styled.div.attrs<{ $x: number; $y: number; $direction: number }>(props => ({
  style: {
    left: `${props.$x}px`,
    top: `${props.$y}px`,
    transform: `translate(-50%, -50%) scaleX(${props.$direction})`,
  },
})) <{ $isRemove: boolean; $color: string }>`
  position: absolute;
  width: 4.2cqw;
  height: 4.2cqw;
  pointer-events: none;
  z-index: 1;

  /* Wrapper moves across board */
  transition: 
    transform ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000}s ease-in-out, 
    top ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000}s ease-in-out, 
    left ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000}s ease-in-out, 
    opacity ${PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI / 1000}s ease-in-out;

  opacity: ${props => props.$isRemove ? 0 : 1};
`;

// Inner visual element. Contains css animation(s).
const SpellVisual = styled.div<{ $url: string; $color: string, $verticalMovement: number }>`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  
  background-image: url(${props => props.$url});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  filter: drop-shadow(0px 0px 5px ${props => props.$color});

  /* TO-DO: BUG: caughtInGyre is not turning off... */
  animation: ${props => !!props.$verticalMovement ? caughtInGyre : noAnim} 1s linear infinite;
  transform-origin: center center;
  backface-visibility: hidden;
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

  const { x, y } = getCoordsXY();
  const direction = Math.sign(spellSnap.getPropertyValue('speedDirection'));
  const verticalMovement = Math.sign(spellSnap.getPropertyValue('upDown'));
  const url = spell.getSpellIcon();
  const isRemove = spellSnap?.getIsRemove();

  return (
    <SpellIcon key={spellSnap?.id} $color={color} $x={x} $y={y} $direction={direction} $isRemove={isRemove}>
      <SpellVisual $url={url} $color={color} $verticalMovement={verticalMovement} />
    </SpellIcon>
  );
};