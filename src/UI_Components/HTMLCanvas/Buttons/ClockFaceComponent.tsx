import React, { useEffect, useState, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Game } from '../../../DataClasses/Game';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';
import { INTRO_WALK_ANIM_TIME } from '../../Player/CharacterParts';

const flashClockFace = keyframes`
  0%, 100% { filter: drop-shadow(0 0 .5cqw white) brightness(var(--lowBrightness)); }
  50% { filter: drop-shadow(0 0 .5cqw white) brightness(var(--highBrightness)); }
`;

const etherealPulse = keyframes`
  0%, 100% {
    opacity: .45;
    filter: drop-shadow(0 0 0.4cqw rgba(220, 240, 255, 0.6)) drop-shadow(0 0 1cqw rgba(255, 255, 255, 0.4));
  }
  50% {
    opacity: .75;
    filter: drop-shadow(0 0 0.8cqw rgba(220, 240, 255, 0.9)) drop-shadow(0 0 1.8cqw rgba(255, 255, 255, 0.7));
  }
`;

const caretBouncePulse = keyframes`
  0%, 100% {
    opacity: 0.85;
    filter: drop-shadow(0 0 0.4cqw rgba(220, 240, 255, 0.6)) drop-shadow(0 0 1cqw rgba(255, 255, 255, 0.4));
    transform: translateX(0);
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 0.8cqw rgba(220, 240, 255, 0.9)) drop-shadow(0 0 1.8cqw rgba(255, 255, 255, 0.7));
    /* Pushes slightly to the left toward the clock face at the peak of the bounce cycle */
    transform: translateX(-0.5cqw); 
  }
`;

// --- Layout Structures ---
const MenuAnchor = styled.div<{
  $lowBrightness: number,
  $highBrightness: number,
  $isDoneWithIntro: boolean, $backgroundSceneBrightness: number, $isDisabled: boolean, $isFlashClock: boolean
}>`
  position: absolute;
  top: 4.8cqw;   
  left: 45cqw; 
  z-index: 31;
  pointer-events: ${props => props.$isDisabled || !props.$isDoneWithIntro ? 'none' : 'unset'};
  cursor: pointer;
  padding: 0.5cqw;
  border-radius: 50%;
  transition: filter 1s;

  --lowBrightness: ${props => props.$lowBrightness};
  --highBrightness: ${props => props.$highBrightness};

  ${props => !props.$isDoneWithIntro && `filter: drop-shadow(0 0 .5cqw white) brightness(${props.$backgroundSceneBrightness});`}

  ${props => props.$isDisabled && `filter: drop-shadow(0 0 .5cqw white) brightness(${props.$highBrightness});`}
  ${props => !props.$isDisabled && props.$isFlashClock && props.$isDoneWithIntro && css`animation: ${flashClockFace} 2.5s ease-in-out infinite;`}
  &:hover{
    filter: drop-shadow(0 0 .5cqw white) brightness(${props => props.$highBrightness});
  }
`;

// Floating Message Components Setup
const FloatingMessageContainer = styled.div<{ $isShow: boolean }>`
  position: absolute;
  top: 4.8cqw;
  left: 55.5cqw; /* Positioned dynamically adjacent to the clock structure boundaries */
  height: 9cqw;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.8cqw;
  pointer-events: none;
  z-index: 35;
  user-select: none;

  /* 🛠️ Smooth transitions for opacity and visibility states */
  transition: opacity 1s ease-in;
  
  /* Manage active vs inactive layout appearance */
  opacity: ${props => props.$isShow ? 1 : 0};
`;

// 🛠️ This component safely isolates your infinite looping pulse logic
const EtherealGlowWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.8cqw;
  animation: ${etherealPulse} 3s ease-in-out infinite;
`;

const EtherealCaret = styled.div`
  width: 0;
  height: 0;
  border-top: 0.7cqw solid transparent;
  border-bottom: 0.7cqw solid transparent;
  border-right: 1.1cqw solid rgba(240, 248, 255, 0.95);
  
  animation: ${caretBouncePulse} 2s ease-in-out infinite;
`;


const EtherealText = styled.div`
  font-family: EnchantedLand, sans-serif;
  // color: rgba(245, 250, 255, 0.95);
  // color: #F1E9D2;
  text-align: center;
  padding-left: 0.7cqw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 0.95;

  /* 🛠️ CENTRAL VARIABLES: Change these values to tweak your outline layout */
  // --stroke-color: #777777; 
  // --stroke-color: #F1E9D2;
  --stroke-width-large: 0.05cqw;
  --stroke-width-small: 0.05cqw;

  color: rgba(253, 253, 212, 0.95);
  --stroke-color: #a6a69d; 
`;

const LargeEtherealWord = styled.span`
  font-size: 4.2cqw;
  
  /* Modern Engine Vector Outlines */
  -webkit-text-stroke: var(--stroke-width-large) var(--stroke-color);
  text-stroke: var(--stroke-width-large) var(--stroke-color);

  /* Universal Cross-Browser Fallbacks */
  text-shadow: 
    calc(-1 * var(--stroke-width-large)) calc(-1 * var(--stroke-width-large)) 0px var(--stroke-color),  
    var(--stroke-width-large) calc(-1 * var(--stroke-width-large)) 0px var(--stroke-color),
    calc(-1 * var(--stroke-width-large)) var(--stroke-width-large) 0px var(--stroke-color),
    var(--stroke-width-large) var(--stroke-width-large) 0px var(--stroke-color);
`;

const SmallEtherealWord = styled.span`
  font-size: 2.6cqw;
  padding-left: 0.2cqw;
  
  /* Modern Engine Vector Outlines */
  -webkit-text-stroke: var(--stroke-width-small) var(--stroke-color);
  text-stroke: var(--stroke-width-small) var(--stroke-color);

  /* Universal Cross-Browser Fallbacks */
  text-shadow: 
    calc(-1 * var(--stroke-width-small)) calc(-1 * var(--stroke-width-small)) 0px var(--stroke-color),  
    var(--stroke-width-small) calc(-1 * var(--stroke-width-small)) 0px var(--stroke-color),
    calc(-1 * var(--stroke-width-small)) var(--stroke-width-small) 0px var(--stroke-color),
    var(--stroke-width-small) var(--stroke-width-small) 0px var(--stroke-color);
`;




const ClockImgWrapper = styled.div<{ $backgroundSceneBrightness: number, $isHovered: boolean, $isDisabled: boolean }>`
  position: absolute;
  top: 4.8cqw;   
  left: 45cqw; 
  z-index: 0;
  transition: filter .5s;
  will-change: filter;
  filter: brightness(${props => props.$backgroundSceneBrightness * 2});
  transition: filter ${INTRO_WALK_ANIM_TIME / 2}s;
`;

const bellStrike = keyframes`
  0%, 100% { transform: translateY(0); }
  15% { transform: translateY(18px); }
  25% { transform: translateY(18px); }
  85% { transform: translateY(-2px); }
  92% { transform: translateY(1px); }
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
  transition: filter 1s, transform 1s;
  ${props => props.$isAnim && !props.$isResetChime && css`
    animation: ${bellStrike} 4s 1 forwards cubic-bezier(0.25, 1, 0.5, 1);
    animation-delay: ${props.$animDelay};
  `}
`;

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
  ${props => props.$transitionTime ? `transition: transform ${props.$transitionTime}s;` : 'transition: transform 2s;'}
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
  setAngles: (newClockHandAngles: { minute: number, hour: number }) => void;
}

const useMinuteAngleAcc = ({ rootGameStore, setAngles }: UseMinuteAngleAccProps): void => {
  const snap = useSnapshot(rootGameStore);
  const minuteAngleAcc = snap.getMinuteAngleAcc();
  useEffect(() => {
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

type ClockFaceComponentProps = { isShowingModal: boolean; }

export default function ClockFaceComponent({ isShowingModal }: ClockFaceComponentProps) {
  const snap = useSnapshot(rootGameStore);
  const isGameBoardDisabled = snap.getIsGameBoardDisabled();
  const isComputerPlayerDoingTurn = !snap.getIsComputerPlayerDoneWithTurn();
  const backgroundSceneBrightness = snap.getBackgroundSceneBrightness();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Rotation angles (minute, hour)
  const [angles, setAngles] = useState<minuteHourAngles>({ minute: 0, hour: 0 });
  useMinuteAngleAcc({ rootGameStore, setAngles });

  // Plays the anim once and resets it for next play.    
  const [isResetChime, setIsResetChime] = useState<boolean>(true);
  useClockChimesAnim({ rootGameStore, setIsResetChime });

  // Show Helper Message
  const displayFloatingPrompt = snap.getIsClickClock();

  return (<>
    {/* .png clock elements. */}
    <ClockImgWrapper
      $backgroundSceneBrightness={backgroundSceneBrightness}
      $isDisabled={isGameBoardDisabled}
      $isHovered={isHovered && !isComputerPlayerDoingTurn}>
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
      $lowBrightness={backgroundSceneBrightness * 2}
      $highBrightness={backgroundSceneBrightness * 2.5}
      $backgroundSceneBrightness={backgroundSceneBrightness}
      $isDisabled={isGameBoardDisabled || isComputerPlayerDoingTurn}
      $isFlashClock={!isHovered && !isComputerPlayerDoingTurn}
      $isDoneWithIntro={isDoneWithIntro}
      onClick={rootGameStore.endTurn}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-click-type="ui-buttons"
      title='End turn'>
      <ClockWrapper>
        {/* data-scene-clock-face: the loading screen's logo lines its own clock face up with this one */}
        <svg data-scene-clock-face viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          {/* Clock Outer Rim */}
          <circle cx="50" cy="50" r="48" fill="#F1E9D2" stroke="#917d41" strokeWidth="4" />
          <circle cx="50" cy="50" r="46" fill="#F1E9D2" stroke="#e5c667" strokeWidth="4" />
          {/* Hour Tick Markers */}
          {[...Array(12)].map((_, i) => (
            <line
              key={i}
              x1="50" y1="8" x2="50" y2="14"
              stroke="#c0a657" strokeWidth="3" strokeLinecap="round"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
          {/* Hour Hand (Thicker, Shorter) */}
          <ClockHands
            x1="50" y1="50" x2="50" y2="28"
            stroke="#917d41" strokeWidth="5" strokeLinecap="round"
            transform={`rotate(${angles.hour} 50 50)`}
          />
          {/* Minute Hand (Thinner, Longer) */}
          <ClockHands
            x1="50" y1="50" x2="50" y2="16"
            stroke="#917d41" strokeWidth="3.5" strokeLinecap="round"
            transform={`rotate(${angles.minute} 50 50)`}
          />
          {/* Center Pin */}
          <circle cx="50" cy="50" r="4" fill="#917d41" />
        </svg>
      </ClockWrapper>
    </MenuAnchor >
    {!isShowingModal && <FloatingMessageContainer $isShow={displayFloatingPrompt}>
      <EtherealGlowWrapper>
        <EtherealCaret />
        <EtherealText>
          <LargeEtherealWord>Click</LargeEtherealWord>
          <SmallEtherealWord>the</SmallEtherealWord>
          <LargeEtherealWord>Clock</LargeEtherealWord>
        </EtherealText>
      </EtherealGlowWrapper>
    </FloatingMessageContainer>}
  </>
  );
}
