import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// 2. The Main Absolute Anchor in the Top-Right Corner
const MenuAnchor = styled.div`
  position: absolute;
  top: 2cqw;   
  right: 45cqw; 
  z-index: 31;
  background-color: black;
  pointer-events: none;
  padding: 0.5cqw;
  border-radius: 50%;
  box-shadow: 0 0 1cqw rgba(0,0,0,0.5);
`;

// Simple styled wrapper to orient the rotation center perfectly
const ClockWrapper = styled.div`
  width: 6cqw;
  height: 6cqw;
  display: flex;
  align-items: center;
  justify-content: center;
`;

interface ClockFaceComponentProps {
  clockSpeed?: number;      // Higher numbers = faster rotation (e.g., 1 to 5)
  onMinuteHandLap?: () => void; // Triggered every time the minute hand passes 12
}

export default function ClockFaceComponent({ 
  clockSpeed = 1, 
  onMinuteHandLap 
}: ClockFaceComponentProps) {
  
  // Track continuous rotation angles to avoid snapping animations at 360
  const [angles, setAngles] = useState({ minute: 0, hour: 0 });
  
  // Use references to bypass React state delays within the animation loop
  const requestRef = useRef<number | null>(null);
  const minuteAngleRef = useRef<number>(0);
  const callbackRef = useRef(onMinuteHandLap);

  const callBackTriggerAngle = 30; // 360 for callback to trigger every hour.

  // Keep callback reference updated with latest parental closures
  useEffect(() => {
    callbackRef.current = onMinuteHandLap;
  }, [onMinuteHandLap]);

  useEffect(() => {
    const updateClockPhysics = () => {
      // Calculate previous full laps before changing the angle
      const previousLaps = Math.floor(minuteAngleRef.current / callBackTriggerAngle);
      
      // Advance minute hand based on speed multiplier
      minuteAngleRef.current += clockSpeed;
      
      // Calculate current full laps
      const currentLaps = Math.floor(minuteAngleRef.current / callBackTriggerAngle);

      // Trigger custom callback if a full turn boundary was crossed
      if (currentLaps > previousLaps && callbackRef.current) {
        callbackRef.current();
      }

      // Calculate relative hour position matching exactly 1/12th ratio
      const hourAngle = minuteAngleRef.current / 12;

      setAngles({
        minute: minuteAngleRef.current,
        hour: hourAngle
      });

      // Continue frame rendering loop
      requestRef.current = requestAnimationFrame(updateClockPhysics);
    };

    // Initialize animation loop
    requestRef.current = requestAnimationFrame(updateClockPhysics);

    // Clean up animation processes on unmount to prevent memory leaks
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [clockSpeed]);

  return (
    <MenuAnchor data-click-type="ui-buttons">
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
          <line 
            x1="50" y1="50" x2="50" y2="28" 
            stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"
            transform={`rotate(${angles.hour} 50 50)`} 
          />
          
          {/* Minute Hand (Thinner, Longer) */}
          <line 
            x1="50" y1="50" x2="50" y2="16" 
            stroke="#5c4d37" strokeWidth="3.5" strokeLinecap="round"
            transform={`rotate(${angles.minute} 50 50)`} 
          />

          {/* Center Pin */}
          <circle cx="50" cy="50" r="4" fill="#1a1a1a" />
        </svg>
      </ClockWrapper>
    </MenuAnchor>
  );
}
