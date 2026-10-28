
import { useState, useEffect, useRef, RefObject } from 'react';
import { rootGameStore } from '../../DataClasses/store';
import { IK_ArmComponent } from './IK_ArmComponent';
import { AvatarRobe, AvatarHead, AvatarRightArm, Damageable, FloorShadow, HemOpening, isFallingBackward, DEATH_POSE, DizzyStars, DIZZY_STARS } from './CharacterParts';
import { Spotlight } from '../SceneElements/Spotlight'
import { UIFadeIn } from '../UIFadeIn';
import { NpcPassCard, RivalSpinner, StatusEmoji } from '../TurnCard';
import { CATCH_DIM, CATCH_LAYERS, CATCH_SCENE, CATCH_TIMES } from '../SceneElements/teacherCatchConfig';
import { DEATH_DIM, useIsAnyWizardDead } from '../SceneElements/DeathDarkness';
import { CARD_FADE_IN } from '../GameOverModalComponent';
import { CastFlurry } from '../SceneElements/TeacherCatch';
import styled, { css, keyframes } from 'styled-components'

/**
 * The game over card: the wizards and their spotlights shown over it (isOn), their health, focus and status
 * hidden as it comes in (it covers them otherwise), and each spotlight's top fading out (topFade: transparent
 * down to `from`, fully shown from `to`, as fractions of the side's height) so it stays clear of the card's
 * masks. (The card is at z-index 10000: overCard is above it.)
 */
const OVER_GAME_OVER_CARD = { isOn: true, overCard: 10001, topFade: { from: 0, to: 0.6 } };

// (a caught wizard's, or both at a death, over the darkness that falls on the scene: CATCH_LAYERS; over the game over card: OVER_GAME_OVER_CARD)
const DuelistSideColumn = styled.div<{ $isRaised?: boolean; $isOverCard?: boolean }>`
  flex: 1;
  background: transparent;
  padding: 1.5cqw;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1cqw;
  z-index: ${props => props.$isOverCard ? OVER_GAME_OVER_CARD.overCard : props.$isRaised ? CATCH_LAYERS.caught : 12};
  pointer-events: none;
  width: 100%;
`;

// The spotlight's top fading out as the game over card comes in (OVER_GAME_OVER_CARD.topFade): a mask twice the
// side's height, its lower half solid, slid up so its fading top half covers the side
const { from: fadeFrom, to: fadeTo } = OVER_GAME_OVER_CARD.topFade;
const topFadeIn = keyframes`
  from { -webkit-mask-position: 0 100%; mask-position: 0 100%; }
  to { -webkit-mask-position: 0 0; mask-position: 0 0; }
`;

// The caught wizard's spotlight, darkening with the scene (in a layer of its own: the spotlight has its own filter)
const SpotlightDarkening = styled.div<{ $isTopFaded?: boolean }>`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  ${props => props.$isTopFaded && css`
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, transparent ${fadeFrom * 50}%, #000 ${fadeTo * 50}%, #000 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, transparent ${fadeFrom * 50}%, #000 ${fadeTo * 50}%, #000 100%);
    -webkit-mask-size: 100% 200%;
    mask-size: 100% 200%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    animation: ${topFadeIn} ${CARD_FADE_IN.seconds}s ease ${CARD_FADE_IN.delaySeconds}s both;
  `}
`;

/**
 * Running off the side of the hall (--exit: 1, to the right; -1, to the left), turned away: a 2-player
 * match's rival fleeing (Game.RIVAL_FLEE_SECONDS), or the wizard who got away from a teacher.
 */
const flee = keyframes`
  0% { transform: translateX(0) scaleX(1); opacity: 1; }
  12% { transform: translateX(0) scaleX(-1) translateY(0); opacity: 1; }
  30% { transform: translateX(calc(var(--exit) * 6cqw)) scaleX(-1) translateY(-0.8cqw); }
  45% { transform: translateX(calc(var(--exit) * 11cqw)) scaleX(-1) translateY(0); }
  60% { transform: translateX(calc(var(--exit) * 17cqw)) scaleX(-1) translateY(-0.8cqw); }
  75% { transform: translateX(calc(var(--exit) * 23cqw)) scaleX(-1) translateY(0); }
  100% { transform: translateX(calc(var(--exit) * 34cqw)) scaleX(-1) translateY(-0.6cqw); opacity: 0; }
`;

/**
 * Caught by a teacher (CATCH_SCENE): lifted into the air, struggling there (jerking side to side, twisting),
 * then yanked and dragged backwards out through the doorway, still aloft, leaning back.
 */
const CAUGHT_AWAY_SECONDS = CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds + CATCH_SCENE.dragSeconds;
const caughtAt = (seconds: number) => `${(seconds / CAUGHT_AWAY_SECONDS * 100).toFixed(2)}%`;
const lifted = (x: number, y: number, turn: number) => `transform: translate(calc(var(--exit) * ${x}cqw), ${y - CATCH_SCENE.liftHeight}cqw) rotate(calc(var(--exit) * ${turn}deg));`;
const STRUGGLE_STEPS = [[0.7, 0.3, -5], [-0.6, -0.4, 4], [0.9, 0.5, -7], [-0.5, -0.2, 3], [0.6, 0.6, -4], [-0.8, -0.3, 6], [0.4, 0.2, -3], [-0.3, 0, 2]];
const dragged = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  ${caughtAt(CATCH_SCENE.liftSeconds * 0.6)} { ${lifted(0, -0.6, 2)} }
  ${caughtAt(CATCH_SCENE.liftSeconds)} { ${lifted(0, 0, 0)} }
  ${STRUGGLE_STEPS.map(([x, y, turn], k) => `${caughtAt(CATCH_SCENE.liftSeconds + (k + 1) / (STRUGGLE_STEPS.length + 1) * CATCH_SCENE.struggleSeconds)} { ${lifted(x, y, turn)} }`).join('\n  ')}
  ${caughtAt(CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds)} { ${lifted(0, 0, 0)} }
  ${caughtAt(CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds + CATCH_SCENE.dragSeconds * 0.12)} { ${lifted(1.8, -0.4, -12)} }
  ${caughtAt(CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds + CATCH_SCENE.dragSeconds * 0.25)} { ${lifted(1.2, 0, -8)} opacity: 1; }
  100% { ${lifted(30, 1.5, -16)} opacity: 0; }
`;

const AvatarPlacementWrapper = styled.div<{ $exit: number; $isFleeing?: boolean; $isDragged?: boolean; $isSlipping?: boolean }>`
  position: absolute;
  left: 1.5cqw;
  right: 1.5cqw;
  bottom: 10cqw;
  pointer-events: none;
  --exit: ${props => props.$exit};
  transform-origin: bottom center;
  ${props => props.$isFleeing && css`animation: ${flee} 1.8s ease-in forwards;`}
  ${props => props.$isDragged && css`animation: ${dragged} ${CAUGHT_AWAY_SECONDS}s ease-in-out ${CATCH_TIMES.lift}s forwards;`}
  ${props => props.$isSlipping && css`animation: ${flee} ${CATCH_SCENE.dragSeconds}s ease-in ${CATCH_SCENE.floodSeconds + CATCH_SCENE.slipDelaySeconds}s forwards;`}
`;

/** At dawn, the weaker wizard (whom a teacher would catch): a shiver, every few seconds. */
/**
 * The shiver of a wizard a teacher would catch: now and then a fine tremble, gentler than being hit
 * (amount: its sway, cqw; seconds: how often).
 */
const SHIVER = { amount: 0.08, seconds: 2.6 };
const shiver = keyframes`
  0%, 78%, 100% { transform: translateX(0); }
  80%, 84%, 88%, 92% { transform: translateX(-${SHIVER.amount}cqw); }
  82%, 86%, 90%, 94% { transform: translateX(${SHIVER.amount}cqw); }
  96% { transform: translateX(-${SHIVER.amount / 2}cqw); }
`;

const ShiverWrap = styled.div<{ $isShivering: boolean }>`
  ${props => props.$isShivering && css`animation: ${shiver} ${SHIVER.seconds}s linear infinite;`}
`;

/** The wizard's status emoji (StatusEmoji): placed as the avatar is, but not moving with it. */
const StatusFrame = styled.div`
  position: absolute;
  left: 1.5cqw;
  right: 1.5cqw;
  bottom: calc(10cqw + 6.3cqw); /* (as the avatar: its placement, and the frame's margin below it) */
  aspect-ratio: 1 / 1;
  pointer-events: none;
  z-index: 41;
`;

/**
 * A fallen wizard's shadow: a drop-shadow of their own shape (it follows their outline), fading in as they land.
 * Its offset down (y, cqw), softness (blur, cqw) and darkness (opacity).
 */
const FALLEN_SHADOW = { isOn: true, y: 0.35, blur: 0.5, opacity: 0.75 };

const AvatarFrame = styled.div<{ $direction: number, $src: string, $isFallen?: boolean }>`
  transform: scale(${props => props.$direction}, 1);
  ${props => FALLEN_SHADOW.isOn && `
    filter: ${props.$isFallen ? `drop-shadow(0 ${FALLEN_SHADOW.y}cqw ${FALLEN_SHADOW.blur}cqw rgba(0, 0, 0, ${FALLEN_SHADOW.opacity}))` : 'none'};
    ${props.$isFallen ? `transition: filter 0.6s ease-out ${DEATH_POSE.seconds * DEATH_POSE.landAt * 0.8}s;` : ''}
  `}
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
  // The teacher at dawn: this wizard at risk (shivering), or caught (dragged out) or getting away (TeacherCatch.tsx)
  const side = direction === 1 ? 'self' : 'rival';
  const catchScene = snap.getCatchScene();
  const isCaught = !!catchScene?.caught.includes(side);
  // (all but their avatar and its flurry of spells darkening with the scene, once the other has got away: CATCH_DIM)
  const caughtDarkening = isCaught && CATCH_DIM.isOn
    ? { filter: `brightness(${1 - CATCH_DIM.opacity})`, transition: `filter ${CATCH_DIM.fadeSeconds}s ease-in ${CATCH_DIM.fromSeconds}s` }
    : undefined;
  // A death: both wizards and their spotlights over the darkness (DeathDarkness), their health, focus and status darkening
  const isDeathDark = useIsAnyWizardDead() && DEATH_DIM.isOn && !catchScene;
  const infoDarkening = caughtDarkening ?? (isDeathDark
    ? { filter: `brightness(${1 - DEATH_DIM.opacity})`, transition: `filter ${DEATH_DIM.fadeSeconds}s ease-in ${DEATH_DIM.fromSeconds}s` }
    : undefined);
  // The game over card up: this wizard and their spotlight over it, their health, focus and status hidden as it comes in
  // (not after a catch: both wizards have left, nothing to show over it; raised early, the one who got away
  // lit up over the darkness before the card came)
  const isOverCard = OVER_GAME_OVER_CARD.isOn && snap.getGameOver() !== null && !catchScene;
  const hideInfo = `visibility 0s linear ${CARD_FADE_IN.delaySeconds + CARD_FADE_IN.seconds}s`;
  const infoStyle = isOverCard
    ? { ...infoDarkening, visibility: 'hidden' as const, transition: infoDarkening ? `${infoDarkening.transition}, ${hideInfo}` : hideInfo }
    : infoDarkening;
  // A catch's card: both wizards gone from the hall, so their spotlights fade out with the card coming in (nobody to light)
  const spotlightStyle = snap.getGameOver() !== null && catchScene
    ? { ...caughtDarkening, opacity: 0, transition: `${caughtDarkening ? `${caughtDarkening.transition}, ` : ''}opacity ${CARD_FADE_IN.seconds}s ease ${CARD_FADE_IN.delaySeconds}s` }
    : caughtDarkening;


  const avatar = (
    <AvatarPlacementWrapper $exit={direction === 1 ? -1 : 1} $isFleeing={direction === -1 && snap.getIsRivalFleeing()} $isDragged={isCaught} $isSlipping={!!catchScene && !isCaught}>
      <ShiverWrap $isShivering={snap.getIsAtRisk(side)}>
      <AvatarFrame $src={src} $direction={direction} $isFallen={isDead}>
        <Damageable
          $isBeginIntroWalk={isBeginIntroWalk}
          $isDoneWithIntroWalk={isDoneWithIntroWalk}
          $direction={direction}
          $healthDiff={healthDiff}
          $isDead={isDead}>
          <AvatarRobe $isDead={isDead} $isBeginIntroWalk={isBeginIntroWalk} $isDoneWithIntroWalk={isDoneWithIntroWalk} $healthDiff={healthDiff} $src={playerSnap?.avatarRobeUrl}>
            <AvatarHead $isDead={isDead} $healthDiff={healthDiff} $src={playerSnap?.avatarHeadUrl} />
            <AvatarRightArm $isDead={isDead} $healthDiff={healthDiff} $src={playerSnap?.avatarRightArmUrl} />
            <IK_ArmComponent isDead={isDead} mousePosRef={mousePosRef} healthDiff={healthDiff} playerSnap={playerSnap ?? undefined} direction={direction} flailFor={isCaught ? catchScene?.id ?? null : null} />
          </AvatarRobe>
          {/* (left on the floor as they're lifted: fading as they rise) */}
          <FloorShadow $isHide={isDead || isCaught} style={isCaught ? { transitionDelay: `${CATCH_TIMES.lift}s`, transitionDuration: `${CATCH_SCENE.liftSeconds}s` } : undefined} />
        </Damageable>
        {/* (falling backward: the robe's hem opening toward us, their feet in it; in the robe's colour) */}
        {isDead && isFallingBackward && <HemOpening robe={direction === 1 ? '#4e2867' : '#272725'} />}
        {/* (knocked out: stars circling above their head) */}
        {isDead && DIZZY_STARS.isOn && <DizzyStars />}
      </AvatarFrame>
      </ShiverWrap>
      {direction === -1 && <NpcPassCard />}
      {direction === -1 && <RivalSpinner />}
    </AvatarPlacementWrapper>
  );

  const healthbar = (<BarBorder $isDoneWithIntro={isDoneWithIntroWalk} $direction={direction} style={infoStyle}>
    <BarFill $pct={pct} $direction={direction}>
      <BarTextContainer $pct={pct} $direction={direction}>
        <BarText>
          {healthAmt > 0 ? healthAmt : ''}
        </BarText>
      </BarTextContainer>
    </BarFill>
  </BarBorder >);

  const focusDots = (
    <FocusContainer $isDoneWithIntro={isDoneWithIntroWalk} $direction={direction} style={infoStyle}>
      {/* STORED FOCUS */}
      {direction == -1 ? Array.from({ length: maxExcessFocus }).map((_, i) => <ExcessFocusBadge key={i} $i={maxFocus - i - 1} $focusAmt={focusAmt - maxFocus} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: maxFocus }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={focusAmt} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
      {/* EXCESS STORED FOCUS */}
      {direction == 1 ? Array.from({ length: maxExcessFocus }).map((_, i) => <ExcessFocusBadge key={i} $i={i} $focusAmt={focusAmt - maxFocus} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: maxFocus }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={focusAmt} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
    </FocusContainer>
  );

  return (<DuelistSideColumn $isRaised={(isCaught && CATCH_DIM.isOn) || isDeathDark} $isOverCard={isOverCard}>
    <SpotlightDarkening style={spotlightStyle} $isTopFaded={isOverCard} data-spotlight={side}>
      <Spotlight $isBeginIntroWalk={isBeginIntroWalk} $isDoneWithIntroWalk={isDoneWithIntroWalk} $isDead={isDead}
        $turn={activeSide === null ? 'none' : activeSide === playerIndex ? 'active' : 'inactive'} />
    </SpotlightDarkening>
    {avatar}
    <StatusFrame style={infoStyle}><StatusEmoji side={side} /></StatusFrame>
    <StatusFrame data-cast-frame={side}><CastFlurry side={side} /></StatusFrame>
    {focusDots}
    {healthbar}
  </DuelistSideColumn>);
}

export default PlayerComponent;
