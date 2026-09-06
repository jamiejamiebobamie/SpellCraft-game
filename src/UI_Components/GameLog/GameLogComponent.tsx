
import React, { useRef, useEffect, useCallback } from 'react';
import { GameLog, GameLogEntry } from '../../DataClasses/GameLog';
import SpellInfoComponent from './SpellInfoComponent'
import { Game } from '../../DataClasses/Game';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';

const SlidingLogContainer = styled.div<{ $isPlacedSpellInfo: boolean }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  
  height: 12cqw; 
  background: #F1E9D2;
  border-top: 0.2cqw solid #c3b091;
  opacity: .9;
  border-radius: 0.5cqw;
  display: flex;
  flex-direction: column;
  
  /* Smooth transitions */
  transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.5s;
  z-index: 31;

  &:hover {
    height: 17cqw; /* Grows cleanly upward without squeezing the board grid */
    transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0s;
  }

  ${props => props.$isPlacedSpellInfo && `
    height: 12cqw; /* Grows cleanly upward without squeezing the board grid */
    transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0s;
    `}
`;

const LogScrollArea = styled.div`
flex-grow: 1;
display: flex;
flex-direction: column;
gap: 0.4cqw;
overflow-y: hidden;
overflow-x: hidden;
scrollbar-gutter: stable; 

&:hover {
  overflow-y: auto;
}
`;

const LogEntry = styled.div`
  display: flex;
  border-bottom: 1px solid #c3b091;
  padding: 0.1cqw 0 0.1cqw 3cqw;
  justify-content: flex-start;
  width: 100%;
`;

const GameText = styled.span<{ $color?: string; $size?: string; $weight?: string }>`
color: ${props => props.$color || '#cccccc'};
font-size: ${props => props.$size || '1.3cqw'};
font-family: monospace;
font-weight: ${props => props.$weight || 'bold'};
`;

interface GameBoardComponentProps {
  readonly snap: Game;
  rootGameStore: Game;
}

/* COMPACT INTERACTIVE FLYOUT LOGGER */
const GameLogComponent = ({ snap, rootGameStore }: GameBoardComponentProps) => {
  // const snap = useSnapshot(rootGameStore);
  const hoveredSpell = snap?.getHoveredSpell();
  const logEndRef = useRef<HTMLDivElement>(null);
  const scrollToLatestLogEntry = () => logEndRef?.current?.scrollIntoView();
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Only trigger if the height property finished animating
    if (e.propertyName === 'height') {
      scrollToLatestLogEntry();
    }
  };
  const numEntries = rootGameStore.gameLog?.getNumLogs();
  useEffect(() => {
    // Only scroll if we are showing the logs, not the spell info
    if (!hoveredSpell) scrollToLatestLogEntry();
  }, [numEntries, hoveredSpell]);

  // Convert boolean flag directly based on presence of hovered spell data
  const isPlacedSpellInfo = !!hoveredSpell;

  return (
    <SlidingLogContainer
      $isPlacedSpellInfo={isPlacedSpellInfo}
      onTransitionEnd={handleTransitionEnd}
    >
      {hoveredSpell ? (<SpellInfoComponent
        updateOrder={hoveredSpell.getPropertyValue('updateOrder')}
        rowShift={hoveredSpell.getPropertyValue('rowShift')}
        damage={hoveredSpell.getPropertyValue('dmgHealth')}
        speed={Math.abs(hoveredSpell.getPropertyValue('speedDirection'))}
        iconUrl={hoveredSpell.getSpellIcon()}
      />) :
        <LogScrollArea>
          {snap.getLogEntries().map((entry: GameLogEntry, i: number) => (
            <LogEntry key={i}>
              <GameText $color={entry.color} $size="1.1cqw">{entry.text}</GameText>
            </LogEntry>
          ))}
          <div ref={logEndRef} />
        </LogScrollArea>}
    </SlidingLogContainer>);
}

export default GameLogComponent;