import { useEffect, useState, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Game } from '../../../DataClasses/Game';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';
import { INTRO_WALK_ANIM_TIME } from '../../Player/CharacterParts';
import ClockHalo, { CLOCK_HALO } from './ClockHalo';
import { LOGO_CONFIG } from '../../Logo/logoConfig';
import { GameClock } from '../../../DataClasses/GameClock/GameClock';

/** How much brighter the clock face gets while hovered (1 = no change; it multiplies the flashing's level). */
const CLOCK_FACE_HOVER_BRIGHTNESS = 1.1; // (was 1.25)

const flashClockFace = keyframes`
  0%, 100% { filter: drop-shadow(0 0 .5cqw white) brightness(var(--lowBrightness)); }
  50% { filter: drop-shadow(0 0 .5cqw white) brightness(var(--highBrightness)); }
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
  /* How much brighter hovering makes the face (on the inner ClockWrapper, see below) */
  --hoverBoost: ${CLOCK_FACE_HOVER_BRIGHTNESS};

  ${props => !props.$isDoneWithIntro && `filter: drop-shadow(0 0 .5cqw white) brightness(${props.$backgroundSceneBrightness});`}

  ${props => props.$isDisabled && `filter: drop-shadow(0 0 .5cqw white) brightness(${props.$highBrightness});`}
  ${props => !props.$isDisabled && props.$isFlashClock && props.$isDoneWithIntro && css`animation: ${flashClockFace} 2.5s ease-in-out infinite;`}
  /*
   * Hovering pauses the flashing (where it is: no jump) and eases the inner face brighter. They're on
   * separate elements so they never fight over one filter (an animation always overrides a rule).
   */
  &:hover {
    animation-play-state: paused;
  }
  &:hover > * {
    filter: brightness(var(--hoverBoost));
  }
`;

const ClockImgWrapper = styled.div<{ $brightness: number, $isHidden: boolean, $isHovered: boolean, $isDisabled: boolean }>`
  position: absolute;
  top: 4.8cqw;   
  left: 45cqw; 
  z-index: 0;
  will-change: filter;
  filter: brightness(${props => props.$brightness});
  opacity: ${props => props.$isHidden ? 0 : 1};
  transition: filter ${INTRO_WALK_ANIM_TIME / 2}s, opacity ${INTRO_WALK_ANIM_TIME / 4}s;
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
  filter: brightness(1);
  transition: filter 0.4s ease-out; /* the hover brightening (MenuAnchor:hover) eases in and out */
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

type HandAngles = { second: number; minute: number; hour: number };

/** How often the hands are checked (milliseconds): quicker than the quickest tick. */
const HAND_CHECK_MILLI = 50;

/**
 * The hands' angles (degrees from 12), kept up to date:
 *   on the landing page, a real clock from LOGO_CONFIG.clock.startTime, ticking once a second;
 *   in play, the night's time (5 minutes a turn) with the seconds hand counting down the player's
 *   turn (GameClock's turn clock), the minute and hour hands creeping on with it.
 */
const useHandAngles = (isLanding: boolean): HandAngles => {
  const [angles, setAngles] = useState<HandAngles>({ second: 0, minute: 0, hour: 0 });
  useEffect(() => {
    const start = performance.now();
    const read = (): HandAngles => {
      if (isLanding) {
        const { hours, minutes, seconds } = LOGO_CONFIG.clock.startTime;
        const total = hours * 3600 + minutes * 60 + seconds + Math.floor((performance.now() - start) / 1000);
        return { second: (total % 60) * 6, minute: (total % 3600) / 10, hour: (total % 43200) / 120 };
      }
      // the minute hand: the turns so far, plus a minute's worth across this turn's time
      const fraction = rootGameStore.getTurnTimeFraction();
      const minute = rootGameStore.getMinuteAngleAcc() + fraction * (GameClock.MINUTE_INCREMENT_ANGLE / 5);
      return { second: fraction * 360, minute, hour: minute / 12 };
    };
    setAngles(read());
    const interval = window.setInterval(() => {
      const next = read();
      setAngles(current => current.second === next.second && current.minute === next.minute ? current : next);
    }, HAND_CHECK_MILLI);
    return () => window.clearInterval(interval);
  }, [isLanding]);
  return angles;
};


export default function ClockFaceComponent() {
  const snap = useSnapshot(rootGameStore);
  const isGameBoardDisabled = snap.getIsGameBoardDisabled();
  const isComputerPlayerDoingTurn = !snap.getIsComputerPlayerDoneWithTurn();
  const backgroundSceneBrightness = snap.getBackgroundSceneBrightness();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  // Once either player is dead, the clock can't end the turn (and its halo hides)
  // Before Play, the landing page's clock settings (LOGO_CONFIG.landingClock) instead of the scene's lighting
  const isLanding = !snap.getIsPlaying();
  const isAnyPlayerDead = !!snap.getHumanPlayer()?.getIsDead() || !!snap.getNpcPlayer()?.getIsDead();
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // The hands (second, minute, hour)
  const angles = useHandAngles(isLanding);
  // The seconds hand only ever goes forward: each tick a quick snap to its next place, and when it's
  // reset to 12 (a turn ends, or a landing minute is up) it carries on round to 12 rather than back
  const secondHand = useRef({ raw: angles.second, laps: 0, shown: angles.second, transition: 0.12 });
  const hand = secondHand.current;
  if (angles.second !== hand.raw) {
    if (angles.second < hand.raw) hand.laps++; // round past 12 again
    const shown = hand.laps * 360 + angles.second;
    hand.transition = shown - hand.shown > 12 ? 0.6 : 0.12; // (the run on to 12 at a turn's end takes a moment)
    hand.shown = shown;
    hand.raw = angles.second;
  }

  // Plays the anim once and resets it for next play.    
  const [isResetChime, setIsResetChime] = useState<boolean>(true);
  useClockChimesAnim({ rootGameStore, setIsResetChime });


  return (<>
    {/* .png clock elements. */}
    <ClockImgWrapper
      $brightness={isLanding ? LOGO_CONFIG.landingClock.bodyBrightness : backgroundSceneBrightness * 2}
      $isHidden={isLanding && !LOGO_CONFIG.landingClock.showBody}
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
    {/* The halo: always on the loading screen; in play, while the clock can end the turn (not once a player is dead) */}
    <ClockHalo brightness={isLanding ? LOGO_CONFIG.landingClock.haloBrightness : backgroundSceneBrightness * CLOCK_HALO.sceneBrightness}
      isShown={!snap.getIsPlaying() || (isDoneWithIntro && !isGameBoardDisabled && !isComputerPlayerDoingTurn && !isAnyPlayerDead)} />
    <MenuAnchor
      // Before Play, every brightness the face uses (normal, disabled, flashing, hovered) is the landing one
      $lowBrightness={isLanding ? LOGO_CONFIG.landingClock.faceBrightness : backgroundSceneBrightness * 2}
      $highBrightness={isLanding ? LOGO_CONFIG.landingClock.faceBrightness : backgroundSceneBrightness * 2.5}
      $backgroundSceneBrightness={isLanding ? LOGO_CONFIG.landingClock.faceBrightness : backgroundSceneBrightness}
      $isDisabled={isGameBoardDisabled || isComputerPlayerDoingTurn || isAnyPlayerDead}
      $isFlashClock={!isComputerPlayerDoingTurn} // (hovering pauses it in CSS, rather than removing it)
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
          {/* Seconds Hand (thin, red: on the landing page a real clock's; in play, counting down the turn) */}
          <ClockHands
            x1="50" y1="58" x2="50" y2="12"
            stroke="#a33a2a" strokeWidth="1.5" strokeLinecap="round"
            $transitionTime={hand.transition}
            style={{ transform: `rotate(${hand.shown}deg)`, transformOrigin: '50px 50px' }}
          />
          {/* Center Pin */}
          <circle cx="50" cy="50" r="4" fill="#917d41" />
        </svg>
      </ClockWrapper>
    </MenuAnchor >
  </>
  );
}
