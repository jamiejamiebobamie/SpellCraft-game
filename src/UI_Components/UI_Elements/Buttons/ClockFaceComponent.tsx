import React, { useEffect, useState, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Game } from '../../../DataClasses/Game';
import { useSnapshot } from 'valtio';

// The Main Absolute Anchor
const MenuAnchor = styled.div<{ $isDisabled: boolean }>`
  position: absolute;
  top: 4.8cqw;   
  left: 45cqw; 
  z-index: 31;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'unset'};
  cursor: pointer;
  padding: 0.5cqw;
  border-radius: 50%;
  filter: drop-shadow(0 0 0cqw white) brightness(.7);
  transition: filter 1s;
  &:hover{
  filter: drop-shadow(0 0 .5cqw white) brightness(1);
    // ${props => !props.$isDisabled && 'filter: drop-shadow(0 0 .5cqw white) brightness(1);'}
  }

  ${props => props.$isDisabled && 'filter: drop-shadow(0 0 .5cqw white) brightness(1);'}

`;

const ClockImgWrapper = styled.div<{ $isHovered: boolean, $isDisabled: boolean }>`
  position: absolute;
  top: 4.8cqw;   
  left: 45cqw; 
  z-index: 0;
  transition: filter 1s;
  ${props => !props.$isDisabled && props.$isHovered && 'filter: drop-shadow(0 0 .2cqw white);'}
`;

const bellStrike = keyframes`
  0%, 100% { 
    transform: translateY(0); 
  }
  15% { 
    /* Sudden mechanical pull downward */
    transform: translateY(18px); 
  }
  25% { 
    /* Brief hold at the strike point */
    transform: translateY(18px); 
  }
  85% { 
    /* Slow recoil back up */
    transform: translateY(-2px); 
  }
  92% { 
    /* Micro-settling bounce */
    transform: translateY(1px); 
  }
`;

type ClockImgProps = {
  $imgUrl: string;
  $zIndex: number;
  $width: string;
  $aspectRatio: string;
  $top: string;
  $left?: string;
  $right?: string;
  $transformOrigin?: string;
  $isAnim?: boolean;
  $animDelay?: string
  $animPlayCount?: number;
  $isResetChime?: boolean;
}

const ClockImg = styled.div<ClockImgProps>`
  position: absolute;
  transform-origin: ${props => props.$transformOrigin};
  top: ${props => props.$top};
  ${props => props.$left && `left: ${props.$left};`}
  ${props => props.$right && `right: ${props.$right};`}
  width: ${props => props.$width};
  aspect-ratio: ${props => props.$aspectRatio};
  z-index: ${props => props.$zIndex};
  background-image: url(${props => props.$imgUrl});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  transition: transform 1s;
  ${props => props.$isAnim && !props.$isResetChime && css`
    animation: ${bellStrike} 4s 1 forwards cubic-bezier(0.25, 1, 0.5, 1);
    animation-delay: ${props.$animDelay};
  `}
`;

// Simple styled wrapper to orient the rotation center perfectly
const ClockWrapper = styled.div`
  position: absolute;
  z-index: 31;
  width: 9cqw;
  height: 9cqw;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ClockHands = styled.line<{ $brightness?: number, $transitionTime?: number }>`
  ${props => props.$transitionTime ? `transition: transform ${props.$transitionTime}s;` : 'transition: transform 1s;'}
  ${props => props.$brightness && `filter: brightness(${props.$brightness}) drop-shadow(0 0 .3cqw #fffb00) !important;`}
`;

interface UseClockChimesAnimProps {
  rootGameStore: Game;
  setIsResetChime: (isReset: boolean) => void;
}

const useClockChimesAnim = ({ rootGameStore, setIsResetChime }: UseClockChimesAnimProps) => {
  const chimeNumRef = useRef<number | undefined>(0);
  const snap = useSnapshot(rootGameStore);
  useEffect(() => {
    // trigger clock chimes animation
    if (rootGameStore.getIsGameBoardDisabled()) {
      clearTimeout(chimeNumRef.current);
      const chimesInSeconds = rootGameStore.getClockChimeSeconds();
      setIsResetChime(false);
      chimeNumRef.current = setTimeout(() => setIsResetChime(true), chimesInSeconds * 1000)
    }
  }, [snap.getIsGameBoardDisabled()]);
}

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

type minuteHourAngles = {
  minute: number;
  hour: number;
}

interface ClockFaceComponentProps {
  rootGameStore: Game;
  onMinuteHandLap?: () => void;
}
export default function ClockFaceComponent({
  rootGameStore,
  onMinuteHandLap
}: ClockFaceComponentProps) {
  // Use references to bypass React state delays within the animation loop
  const callbackRef = useRef(onMinuteHandLap);
  const intervalRef = useRef<number | null>(null);
  const gameBoardDisabledRef = useRef<boolean>(false);
  const firstIntervalDelayRef = useRef<boolean>(false);
  const snap = useSnapshot(rootGameStore);


  /*
  
  getSecondsHandAngle
  resetSecondsHandAngle
  incrementSecondsHandAngle
  pauseSecondsHandAngle
  unpauseSecondsHandAngle
  
  */


  const isGameBoardDisabled = snap.getIsGameBoardDisabled()
  const [isHovered, setIsHovered] = useState<boolean>(false);
  // 'Seconds' rotation angle
  const [secondsAngle, setSecondsAngle] = useState<number>(0);
  // Rotation angles (minute, hour)
  const [angles, setAngles] = useState<minuteHourAngles>({ minute: 0, hour: 0 });
  useMinuteAngleAcc({ rootGameStore, setAngles });
  // Plays the anim once and resets it for next play.    
  const [isResetChime, setIsResetChime] = useState<boolean>(true);
  useClockChimesAnim({ rootGameStore, setIsResetChime });
  // Keep callback reference updated with latest parental closures
  useEffect(() => {
    callbackRef.current = onMinuteHandLap;
  }, [onMinuteHandLap]);

  // TO-DO: Test this.
  const gameOverType = snap.getGameOver();
  useEffect(() => {
    if (gameOverType && isGameBoardDisabled) {
      firstIntervalDelayRef.current = false;
      setSecondsAngle(0);
      intervalRef.current && clearInterval(intervalRef.current);
    }
  }, [gameOverType, isGameBoardDisabled]);

  // update ref for above useEffect
  useEffect(() => {
    gameBoardDisabledRef.current = isGameBoardDisabled;
    if (isGameBoardDisabled) {
      firstIntervalDelayRef.current = false;
      intervalRef.current && clearInterval(intervalRef.current);
    } else {
      intervalRef.current = setInterval(() => {
        if (gameBoardDisabledRef.current) {
          firstIntervalDelayRef.current = false;
          setSecondsAngle(0);
          intervalRef.current && clearInterval(intervalRef.current);
        } else if (!firstIntervalDelayRef.current) {
          // give player (and second hand of clock) 1 second grace period before timer begins.
          firstIntervalDelayRef.current = true;
        } else {
          setSecondsAngle(secondsAngle => {
            const increment = 360 / 120;
            const newAngle = secondsAngle + increment;
            if (newAngle >= 360 && callbackRef.current) {
              callbackRef.current();
              intervalRef.current && clearInterval(intervalRef.current);
              return 0;
            }
            return newAngle;
          });
        }
      }, 500);
    }
  }, [isGameBoardDisabled]);

  /*
    TO-DO: Pause seconds hand / game clock when:
      (1) once game over is reached
      (2) when spell book is open
      (3) when user is hovering/inspecting the gameboard (?)

    TO-DO: Make Game Clock class
    
    TO-DO: Make reset clock method
  */
  return (<>
    <ClockImgWrapper
      $isDisabled={isGameBoardDisabled}
      $isHovered={isHovered}>
      <ClockImg
        $transformOrigin={'top center'}
        $top={'-4.1cqw'}
        $left={'-5.9cqw'}
        $width={'21.8cqw'}
        $aspectRatio={'260/390'}
        $zIndex={3}
        $imgUrl={'background-scene/Clock/Clock-body.png'}
      />
      <ClockImg
        $transformOrigin={'top center'}
        $top={'5cqw'}
        $left={'-1.5cqw'}
        $width={'13cqw'}
        $aspectRatio={'120/171'}
        $zIndex={1}
        $imgUrl={'background-scene/Clock/Clock-inside-back.png'}
      />
      <ClockImg
        $transformOrigin={'top center'}
        $top={'6.9cqw'}
        $left={'1cqw'}
        $width={'3cqw'}
        $aspectRatio={'33/119'}
        $zIndex={2}
        $imgUrl={'background-scene/Clock/Clock-left-chime.png'}
        $isAnim={true}
        $isResetChime={isResetChime}
      />
      <ClockImg
        $transformOrigin={'top center'}
        $top={'4.9cqw'}
        $left={'5.5cqw'}
        $width={'3.3cqw'}
        $aspectRatio={'38/161'}
        $zIndex={2}
        $imgUrl={'background-scene/Clock/Clock-right-chime.png'}
        $isAnim={true}
        $animDelay={'1s'}
        $isResetChime={isResetChime}
      />
    </ClockImgWrapper>
    <MenuAnchor
      $isDisabled={isGameBoardDisabled}
      onClick={() => {
        if (onMinuteHandLap) {
          onMinuteHandLap();
          firstIntervalDelayRef.current = false;
          setSecondsAngle(0);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          {/* Seconds Hand (Thinner-er, Longer-er) */}
          <ClockHands
            x1="50" y1="50" x2="50" y2="9"
            /*stroke="#ddc958"*/ stroke="#787600" strokeWidth="1.5" strokeLinecap="round"
            transform={`rotate(${secondsAngle} 50 50)`}
            $brightness={1.5}
            $transitionTime={.75}
          />

          {/* Center Pin */}
          <circle cx="50" cy="50" r="4" fill="#1a1a1a" />
        </svg>
      </ClockWrapper>
    </MenuAnchor >
  </>
  );
}
