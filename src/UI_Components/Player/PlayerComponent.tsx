
import { useState, useEffect, useRef, RefObject } from 'react';
import { rootGameStore } from '../../DataClasses/store';
import { IK_ArmComponent } from './IK_ArmComponent';
import { AvatarRobe, AvatarHead, AvatarRightArm, Damageable, FloorShadow } from './CharacterParts';
import { Spotlight } from '../SceneElements/Spotlight'
import { UIFadeIn } from '../UIFadeIn';
import { NpcPassCard, RivalSpinner } from '../TurnCard';
import styled, { css, keyframes } from 'styled-components'

const DuelistSideColumn = styled.div`
  flex: 1;
  background: transparent;
  padding: 1.5cqw;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1cqw;
  z-index: 12;
  pointer-events: none;
  width: 100%;
`;

/** A 2-player match's rival fleeing: turning away, then running off the side of the hall (Game.RIVAL_FLEE_SECONDS). */
const flee = keyframes`
  0% { transform: translateX(0) scaleX(1); opacity: 1; }
  12% { transform: translateX(0) scaleX(-1) translateY(0); opacity: 1; }
  30% { transform: translateX(6cqw) scaleX(-1) translateY(-0.8cqw); }
  45% { transform: translateX(11cqw) scaleX(-1) translateY(0); }
  60% { transform: translateX(17cqw) scaleX(-1) translateY(-0.8cqw); }
  75% { transform: translateX(23cqw) scaleX(-1) translateY(0); }
  100% { transform: translateX(34cqw) scaleX(-1) translateY(-0.6cqw); opacity: 0; }
`;

const AvatarPlacementWrapper = styled.div<{ $isFleeing?: boolean }>`
  position: absolute;
  left: 1.5cqw;
  right: 1.5cqw;
  bottom: 10cqw;
  pointer-events: none;
  ${props => props.$isFleeing && css`animation: ${flee} 1.8s ease-in forwards;`}
`;

const AvatarFrame = styled.div<{ $direction: number, $src: string }>`
  transform: scale(${props => props.$direction}, 1);
  width: 100%; aspect-ratio: 1/1; object-fit: cover; 

  /* Leave in for testing CharacterParts placement: */
  // background-image: url(${props => props.$src});
  /* - - - */

  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: 1;
  position: relative;
  margin-bottom: 6.3cqw;
`;

const BarBorder = styled(UIFadeIn)<{ $direction: number }>`
  position: relative; width: 150%; align-self: ${props => props.$direction == -1 ? 'flex-end' : 'flex-start'}; height: 2.5cqw; margin-bottom: .5cqw; border: 0.15cqw solid #666; background: #222; border-radius: 0.3cqw; overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number, $direction: number }>`
  width: ${props => props.$pct}%; height: 100%; background: #570a0a; ${props => props.$direction == 1 ? 'float: right;' : 'float: left;'} transition: width 0.2s ease; overflow: visible;
`;

const BarTextContainer = styled.div<{ $direction: number, $pct: number }>`
    display: flex;
    position: absolute;
    z-index: 1;
    
    /* Pin to the top-left and take full area */
    top: 0;
    ${props => props.$direction == -1 ? `left: ${props.$pct > 12 ? `${props.$pct - 9}%` : '.9dvw'};` : `right: ${props.$pct > 12 ? `${props.$pct - 9}%` : '.9dvw'};`}
    
    transition: left 1s, right 1s;
    height: 100%;
    
    /* Perfectly center child text horizontally and vertically */
    justify-content: ${props => props.$direction == -1 ? 'flex-end' : 'flex-start'};

    align-items: center;
    
    /* Font sizing */
    font-size: 2.2cqw;
    font-family: 'EnchantedLand', sans-serif; 
    
    /* Use line-height: 1 to prevent font metrics from pushing text down */
    line-height: 1; 
    
    transition: width 0.2s ease;
`;

const BarText = styled.div`
    color: #ffcaca;
    filter: drop-shadow(0px 0px 5px #ffcaca);
    transition: width 0.2s ease;
`;

const FocusContainer = styled(UIFadeIn)<{ $direction: number }>`
    display: flex;
    align-self: ${props => props.$direction == -1 ? 'flex-end' : 'flex-start'};
    padding: 1cqw 0cqw;// 3cqw .2cqw 2cqw;
    justify-content: space-around;
    gap: 0.4cqw;
    align-items: center;
    min-height: 1.1cqw; 
    position: relative;
    width: 150%;
`;

export const noFocusFlash = keyframes`
  /* Start: Dead grey, normal size */
  0%, 100% { 
    background: transparent; 
    border-color: #444;
    box-shadow: none;
    transform: scale(1) translateX(0);
  }
  /* Frantic Shake + Faint gasp of blue + Slight size pop */
  20%, 60% { 
    background: rgba(106, 173, 217, 0.15);
    border-color: #6aadd9; 
    box-shadow: 0 0 4px rgba(106, 173, 217, 0.4);
    transform: scale(1.1) translateX(-1px); 
  }
  40%, 80% { 
    background: rgba(106, 173, 217, 0.15);
    border-color: #6aadd9; 
    box-shadow: 0 0 4px rgba(106, 173, 217, 0.4);
    transform: scale(1.1) translateX(1px); 
  }
`;
const FocusBadge = styled.div<{ key: number, $i: number, $focusAmt: number, $isPlayerOutOfFocus: boolean }>`
    width: 1cqw;
    height: 1cqw;
    border-radius: 50%;
    border: 0.12cqw solid #777;
    background: ${props => props.$i < props.$focusAmt ? '#6aadd9' : 'transparent'};
    transition: filter .5s, background 0.2s;
    animation: ${props => !!props.$isPlayerOutOfFocus && noFocusFlash} 1.5s linear infinite;
    ${props => props.$i < props.$focusAmt && 'filter: drop-shadow(0px 0px 5px #6aadd9);'}
`;

const ExcessFocusBadge = styled(FocusBadge)`
    ${props => props.$i < props.$focusAmt ? 'filter: drop-shadow(0px 0px 5px #6aadd9);' : `border: 0; width: .87cqw; height: .87cqw;`}
    animation: none;
`;
import { Dispatch, SetStateAction } from 'react';
import { useSnapshot } from 'valtio';

interface UseHealthbarProps {
  healthAmt: number;
  setCachedHealth: Dispatch<SetStateAction<number>>;
  healthRefTimeout: RefObject<any>;
  setHealthDiff: Dispatch<SetStateAction<number>>;
  ANIM_TIME: number;
}

const useHealthbar = ({
  healthAmt,
  setCachedHealth,
  healthRefTimeout,
  setHealthDiff,
  ANIM_TIME
}: UseHealthbarProps) => {
  useEffect(() => {
    setCachedHealth(oldCachedAmt => {
      // Safely clear any active flash timeout so consecutive updates stack cleanly
      if (healthRefTimeout?.current) {
        clearTimeout(healthRefTimeout.current);
      }

      const diff = healthAmt - oldCachedAmt;

      // If there's an actual state change, apply it immediately
      if (diff !== 0) {
        setHealthDiff(diff);

        healthRefTimeout.current = setTimeout(() => {
          setHealthDiff(0);
        }, ANIM_TIME * 100); // Shorter window so resets occur fast enough for rapid multi-hits
      }

      return healthAmt;
    });
  }, [healthAmt, setCachedHealth, setHealthDiff, ANIM_TIME, healthRefTimeout]);
};

type PlayerComponentProps = {
  mousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
  isPlayerOutOfFocus: boolean;
  playerIndex: number;
}

const PlayerComponent = ({ playerIndex, mousePosRef, isPlayerOutOfFocus }: PlayerComponentProps) => {
  const snap = useSnapshot(rootGameStore);
  const playerSnap = playerIndex == 0 ? snap.getHumanPlayer() : snap.getNpcPlayer();
  const activeSide = snap.getActiveSide(); // (whose move it is: their spotlight brightens)
  const ANIM_TIME = 6;
  const healthAmt = playerSnap?.getHealth() || 0;
  const pct = playerSnap?.getHealthPrct() || 0;
  const focusAmt = playerSnap?.getFocus() || 0;
  const maxFocus = playerSnap?.getMaxFocus() || 0;
  const maxExcessFocus = playerSnap?.getMaxExcessFocus() || 0;
  const src = playerSnap?.avatarUrl || '';
  const direction = playerSnap?.getDirection() || 1;
  const healthRefTimeout = useRef<number | null | undefined>(0);
  const [_, setCachedHealth] = useState(healthAmt);
  const [healthDiff, setHealthDiff] = useState(0);
  useHealthbar({ healthAmt, setCachedHealth, healthRefTimeout, setHealthDiff, ANIM_TIME });
  const isDead = playerSnap?.getIsDead() || false;
  const isDoneWithIntroWalk = playerSnap?.getIsDoneWithIntroWalk() || false;

  // The player casting (their focus drops) drives the tutorial's Focus tip (Game.notePlayerCast)
  const previousFocus = useRef(focusAmt);
  useEffect(() => {
    const hasSpentFocus = focusAmt < previousFocus.current;
    previousFocus.current = focusAmt;
    if (direction === 1 && hasSpentFocus) rootGameStore.notePlayerCast();
  }, [focusAmt]);
  const isBeginIntroWalk = playerSnap?.getIsBeginIntroWalk() || false;

  const avatar = (
    <AvatarPlacementWrapper $isFleeing={direction === -1 && snap.getIsRivalFleeing()}>
      <AvatarFrame $src={src} $direction={direction}>
        <Damageable
          $isBeginIntroWalk={isBeginIntroWalk}
          $isDoneWithIntroWalk={isDoneWithIntroWalk}
          $direction={direction}
          $healthDiff={healthDiff}
          $isDead={isDead}>
          <AvatarRobe $isBeginIntroWalk={isBeginIntroWalk} $isDoneWithIntroWalk={isDoneWithIntroWalk} $healthDiff={healthDiff} $src={playerSnap?.avatarRobeUrl}>
            <AvatarHead $healthDiff={healthDiff} $src={playerSnap?.avatarHeadUrl} />
            <AvatarRightArm $healthDiff={healthDiff} $src={playerSnap?.avatarRightArmUrl} />
            <IK_ArmComponent isDead={isDead} mousePosRef={mousePosRef} healthDiff={healthDiff} playerSnap={playerSnap ?? undefined} direction={direction} />
          </AvatarRobe>
          <FloorShadow $isHide={isDead} />
        </Damageable>
      </AvatarFrame>
      {direction === -1 && <NpcPassCard />}
      {direction === -1 && <RivalSpinner />}
    </AvatarPlacementWrapper>
  );

  const healthbar = (<BarBorder $isDoneWithIntro={isDoneWithIntroWalk} $direction={direction}>
    <BarFill $pct={pct} $direction={direction}>
      <BarTextContainer $pct={pct} $direction={direction}>
        <BarText>
          {healthAmt > 0 ? healthAmt : ''}
        </BarText>
      </BarTextContainer>
    </BarFill>
  </BarBorder >);

  const focusDots = (
    <FocusContainer $isDoneWithIntro={isDoneWithIntroWalk} $direction={direction}>
      {/* STORED FOCUS */}
      {direction == -1 ? Array.from({ length: maxExcessFocus }).map((_, i) => <ExcessFocusBadge key={i} $i={maxFocus - i - 1} $focusAmt={focusAmt - maxFocus} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: maxFocus }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={focusAmt} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
      {/* EXCESS STORED FOCUS */}
      {direction == 1 ? Array.from({ length: maxExcessFocus }).map((_, i) => <ExcessFocusBadge key={i} $i={i} $focusAmt={focusAmt - maxFocus} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: maxFocus }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={focusAmt} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
    </FocusContainer>
  );

  return (<DuelistSideColumn>
    <Spotlight $isBeginIntroWalk={isBeginIntroWalk} $isDoneWithIntroWalk={isDoneWithIntroWalk} $isDead={isDead}
      $turn={activeSide === null ? 'none' : activeSide === playerIndex ? 'active' : 'inactive'} />
    {avatar}
    {focusDots}
    {healthbar}
  </DuelistSideColumn>);
}

export default PlayerComponent;
