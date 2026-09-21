
import React from 'react';
import styled from 'styled-components';

const BoardBorder = styled.div<{ $isLocked: boolean }>`
  position: absolute;
  z-index: 10;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: .1cqw solid #fff;
  opacity: ${props => props.$isLocked ? .25 : 0};
  transition: opacity 1s ease-in-out;
`;

const LockSymbol = styled.div<{ $style: string; $isLocked: boolean }>`
  position: absolute;
  top:  0;
  ${props => props.$style}
  opacity: ${props => props.$isLocked ? .4 : 0};
  transition: opacity 1s ease-in-out;
  pointer-events: none;
  color: white;
`;

interface LockSymbolComponenttProps {
    isLocked: boolean;
}
export const LockSymbolComponent = ({ isLocked }: LockSymbolComponenttProps) => (
    <>
        <BoardBorder $isLocked={isLocked} />
        <LockSymbol $style={'left: .25cqw;'} $isLocked={isLocked}>{isLocked ? '🔒︎' : '🔓︎'}</LockSymbol>
        <LockSymbol $style={'right: .25cqw;'} $isLocked={isLocked}>{isLocked ? '🔒︎' : '🔓︎'}</LockSymbol>
    </>
)
