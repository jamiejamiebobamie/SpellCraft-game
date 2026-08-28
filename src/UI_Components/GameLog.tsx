
import React, { useRef } from 'react';
import { GameLogEntry } from './GameTypes';
import styled from 'styled-components';

const SlidingLogContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 7%;
  background: #F1E9D2;// rgba(12, 12, 12, 0.96);
  border-top: 0.2cqw solid #c3b091;//#333;

  // border: 0.05cqw solid;
  border-radius: 0.5cqw;
  display: flex;
  flex-direction: column;
  transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: 0.5s; /* Delays the slide-up for half a second */
  z-index: 20;
  //   padding: 1cqw;

  &:hover {
    height: 50%;
  }
`;

const LogScrollArea = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.4cqw;
  overflow-y: hidden;
  overflow-x: hidden;

  &:hover {
    overflow-y: auto;
  }
`;

const LogEntry = styled.div<{ key: string }>`
      display: flex;
     border-bottom: 1px solid #c3b091;// #141414;
     padding: 0.1cqw 0 .1cqw 3cqw;
     justify-content: flex-start;
     width: 100%;
`;

const GameText = styled.span<{ $color?: string; $size?: string; $weight?: string }>`
  color: ${props => props.$color || '#cccccc'};
  font-size: ${props => props.$size || '1.3cqw'};
  font-family: monospace;
  font-weight: ${props => props.$weight || 'bold'};
`;

interface GameLogProps { logEntries: Array<GameLogEntry>; };

{/* COMPACT INTERACTIVE FLYOUT LOGGER */ }
const GameLog = ({ logEntries }: GameLogProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  return (
    <SlidingLogContainer
      onMouseLeave={() => logEndRef?.current?.scrollTo(0, 0)}
    >
      <LogScrollArea>
        <div ref={logEndRef} />
        {logEntries.map(entry => (
          <LogEntry key={entry.id}>
            <GameText $color={entry.color} $size="1.1cqw">{entry.text}</GameText>
          </LogEntry>
        ))}
      </LogScrollArea>
    </SlidingLogContainer>);
}

export default GameLog;