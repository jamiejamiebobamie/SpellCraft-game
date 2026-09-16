import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Game } from '../../DataClasses/Game';
import { useSnapshot } from 'valtio';

// The Main Absolute Anchor
const MenuAnchor = styled.div<{ $isDisabled: boolean }>`
  position: absolute;
  top: 5cqw;   
  left: 45cqw; 
  z-index: 31;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'unset'};
  cursor: pointer;
  padding: 0.5cqw;
  border-radius: 50%;
  filter: drop-shadow(0 0 0cqw yellow);
  transition: filter 1s;
  &:hover{
    ${props => !props.$isDisabled && 'filter: drop-shadow(0 0 1cqw yellow);'}
  }
`;

// Simple styled wrapper to orient the rotation center perfectly
const ClockWrapper = styled.div`
  width: 9cqw;
  height: 9cqw;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ClockHands = styled.line`
  transition: transform 1s;
`;

interface UseMinuteAngleAccProps {
  rootGameStore: Game;
  setAngles: (newClockHandAngles: { minute: number, hour: number }) => void; // Triggered onClick clock
}

const useMinuteAngleAcc = ({ rootGameStore, setAngles }: UseMinuteAngleAccProps): void => {
  const snap = useSnapshot(rootGameStore);
  const minuteAngleAcc = snap.getMinuteAngleAcc();
  useEffect(() => {
    // Calculate relative hour position matching exactly 1/12th ratio
    const hourAngle = minuteAngleAcc / 12;
    setAngles({
      minute: minuteAngleAcc,
      hour: hourAngle
    });
  }, [minuteAngleAcc]);
}

interface ClockFaceComponentProps {
  rootGameStore: Game;
  onMinuteHandLap?: () => void;
}
export default function ClockFaceComponent({
  rootGameStore,
  onMinuteHandLap
}: ClockFaceComponentProps) {
  // Rotation angles (minute, hour)
  const [angles, setAngles] = useState({ minute: 0, hour: 0 });
  useMinuteAngleAcc({ rootGameStore, setAngles });
  return (
    <MenuAnchor
      $isDisabled={rootGameStore.getIsGameBoardDisabled()}
      onClick={() => {
        if (onMinuteHandLap) onMinuteHandLap();
      }}
      data-click-type="ui-buttons">
      <ClockWrapper>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          {/* Clock Outer Rim */}
          <circle cx="50" cy="50" r="46" fill="#F1E9D2" stroke="#c3b091" strokeWidth="4" />
          {/* Hour Tick Markers */}
          {[...Array(12)].map((_, i) => (
            <line
              key={i}
              x1="50" y1="8" x2="50" y2="14"
              stroke="#5c4d37" strokeWidth="3" strokeLinecap="round"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
          {/* Hour Hand (Thicker, Shorter) */}
          <ClockHands
            x1="50" y1="50" x2="50" y2="28"
            stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"
            transform={`rotate(${angles.hour} 50 50)`}
          />
          {/* Minute Hand (Thinner, Longer) */}
          <ClockHands
            x1="50" y1="50" x2="50" y2="16"
            stroke="#5c4d37" strokeWidth="3.5" strokeLinecap="round"
            transform={`rotate(${angles.minute} 50 50)`}
          />
          {/* 
          
              TO-DO: consider adding in "SECONDS" hand to clock that acts as a turn timer...
              larger / more natural size of turn area (full clock face) might make it work.
              also: correct turn time for players can be found arbitrarily, "best fit." 

          */}
          {/* Center Pin */}
          <circle cx="50" cy="50" r="4" fill="#1a1a1a" />
        </svg>
      </ClockWrapper>
    </MenuAnchor>
  );
}
