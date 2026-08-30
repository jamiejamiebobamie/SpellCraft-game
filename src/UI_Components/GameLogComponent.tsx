
import React, { useRef, useEffect, useCallback } from 'react';
import { GameLog, GameLogEntry } from '../DataClasses/GameLog';
import styled from 'styled-components';

// /*
//   position: absolute;
//   bottom: 0;
//   left: 0;
//   right: 0;
//   height: 7%;
//   background: #F1E9D2;
//   border-top: 0.2cqw solid #c3b091;
//   opacity: .9;
//   border-radius: 0.5cqw;
//   display: flex;
//   flex-direction: column;
//   z-index: 20;

//   /* 🚀 FIX 1: Split transitions so opening delays, but closing shrinks instantly */
//   transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.5s; 

//   &:hover {
//     height: 50%;
//     /* Instantly collapse back down without the 0.5s delay when leaving */
//     transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0s; 
//   }

// */


const SlidingLogContainer = styled.div`

    position: absolute;
  
  /* 🚀 FIX 1: Set a hardwired bottom coordinate anchor.
     This isolates it completely from the parent's 'justify-content' layout rules. */
  bottom: 0;
  left: 0;
  right: 0;
  
  /* 🚀 FIX 2: Swap layout percentages to absolute cqw context 
     so height tracking maps cleanly alongside your grid boundaries */
  height: 4cqw; 
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
    height: 25cqw; /* Grows cleanly upward without squeezing the board grid */
    transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0s;
  }
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
color: ${ props => props.$color || '#cccccc' };
font-size: ${ props => props.$size || '1.3cqw' };
font-family: monospace;
font-weight: ${ props => props.$weight || 'bold' };
`;

interface GameBoardComponentProps {
  gameLogSnap: GameLog;
}

/* COMPACT INTERACTIVE FLYOUT LOGGER */
const GameLogComponent = ({ gameLogSnap }: GameBoardComponentProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  const scrollToLatestLogEntry = () => logEndRef?.current?.scrollIntoView();

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Only trigger if the height property finished animating
    if (e.propertyName === 'height') {
      scrollToLatestLogEntry();
    }
  };

  const numEntries = gameLogSnap?.getNumLogs();
  useEffect(() => { scrollToLatestLogEntry() }, [numEntries]);

  return (
    <SlidingLogContainer
      // onMouseLeave={scrollToLatestLogEntry}
      onTransitionEnd={handleTransitionEnd}
    >
      <LogScrollArea>
        {gameLogSnap.logEntries.map((entry: GameLogEntry, i: number) => (
          <LogEntry key={i}>
            <GameText $color={entry.color} $size="1.1cqw">{entry.text}</GameText>
          </LogEntry>
        ))}
        <div ref={logEndRef} />
      </LogScrollArea>
    </SlidingLogContainer>);
}

export default GameLogComponent;