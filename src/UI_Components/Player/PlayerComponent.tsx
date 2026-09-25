
import React, { useState, useEffect, useRef, RefObject } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { IK_ArmComponent } from './IK_ArmComponent';
import { AvatarRobe, AvatarHead, AvatarRightArm, Damageable, FloorShadow } from './CharacterParts';
import { ModifierTextComponent } from '../UI_Elements/ModifierTextComponent'
import { Spotlight } from '../UI_Elements/SceneElements/Spotlight'
import styled, { keyframes } from 'styled-components'

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
  margin-bottom: 7cqw;
`;

const BarBorder = styled.div<{ $direction: 1 | -1 }>`
  position: relative; width: 150%; align-self: ${props => props.$direction == -1 ? 'flex-end' : 'flex-start'}; height: 2.5cqw; margin-bottom: .5cqw; border: 0.15cqw solid #666; background: #222; border-radius: 0.3cqw; overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number, $direction: 1 | -1 }>`
  width: ${props => props.$pct}%; height: 100%; background: #570a0a; ${props => props.$direction == 1 ? 'float: right;' : 'float: left;'} transition: width 0.2s ease; overflow: visible;
`;

const BarTextContainer = styled.div<{ $direction: 1 | -1, $pct: number }>`
    display: flex;
    position: absolute;
    z-index: 1;
    
    /* Pin to the top-left and take full area */
    top: 0;
    ${props => props.$direction == -1 ? `left: ${props.$pct > 12 ? `${props.$pct - 9}%` : '.9dvw'};` : `right: ${props.$pct > 12 ? `${props.$pct - 9}%` : '.9dvw'};`}
    
    transition: left 1s, right 1s;
    // width: 100%;
    // width: ${props => props.$pct}%;
    height: 100%;
    // ${props => props.$pct <= 5 ? 'min-width: 1dvw;' : ''}

    
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
    // padding: 0cqw .2cqw;
    // color: #e2afaf;
    color: #ffcaca;

    filter: drop-shadow(0px 0px 5px #ffcaca);



    transition: width 0.2s ease;
    // background-color: green;
    // width: 2cqw;
`;

const FocusContainer = styled.div<{ $direction: 1 | -1 }>`
    display: flex;
    align-self: ${props => props.$direction == -1 ? 'flex-end' : 'flex-start'};
    padding: 1cqw 0cqw;// 3cqw .2cqw 2cqw;
    justify-content: space-around;
    gap: 0.4cqw;
    align-items: center;
    min-height: 1.1cqw; 
    position: relative;
    width: 100%;
    // background-color: red;
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

interface UseHealthbarProps {
  healthAmt: number;
  setCachedHealth: Dispatch<SetStateAction<number>>;
  healthRefTimeout: RefObject<number | null | undefined>;
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

      if (healthRefTimeout?.current)
        clearTimeout(healthRefTimeout.current);

      const diff = healthAmt - oldCachedAmt;
      setHealthDiff(diff);

      healthRefTimeout.current = setTimeout(() => {
        setHealthDiff(0);
      }, ANIM_TIME * 1000);
      return healthAmt;
    });
  }, [healthAmt]);
}
interface UseFocusDotsProps {
  focusAmt: number;
  setCachedFocus: Dispatch<SetStateAction<number>>;
  /* Clears linter rules for browser setTimeout trackers */
  focusRefTimeout: RefObject<number | null | undefined>;
  setFocusDiff: Dispatch<SetStateAction<number>>;
  ANIM_TIME: number;
}

const useFocusDots = ({
  focusAmt,
  setCachedFocus,
  focusRefTimeout,
  setFocusDiff,
  ANIM_TIME
}: UseFocusDotsProps) => {
  useEffect(() => {
    setCachedFocus(oldCachedAmt => {

      if (focusRefTimeout?.current)
        clearTimeout(focusRefTimeout.current);

      const diff = focusAmt - oldCachedAmt;
      setFocusDiff(diff);

      focusRefTimeout.current = setTimeout(() => {
        setFocusDiff(0);
      }, ANIM_TIME * 1000);

      return focusAmt;
    });
  }, [focusAmt]);
}

type PlayerComponentProps = {
  playerSnap: Player;
  mousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
  isPlayerOutOfFocus: boolean;
}

const PlayerComponent = ({ playerSnap, mousePosRef, isPlayerOutOfFocus }: PlayerComponentProps) => {
  const ANIM_TIME = 6;
  const textModifierWidth = '15cqw';
  const textModifierHeight = '10cqw';
  const textModifierFontSize = '4cqw';

  const healthAmt = playerSnap.getHealth();
  const focusAmt = playerSnap.getFocus();
  const direction = playerSnap.getDirection();

  const healthRefTimeout = useRef<number | null | undefined>(0);
  const focusRefTimeout = useRef<number | null | undefined>(0);

  const [_, setCachedHealth] = useState(playerSnap.getHealth());
  const [__, setCachedFocus] = useState(playerSnap.getFocus());

  const [healthDiff, setHealthDiff] = useState(0);
  const [focusDiff, setFocusDiff] = useState(0);

  useHealthbar({ healthAmt, setCachedHealth, healthRefTimeout, setHealthDiff, ANIM_TIME });
  useFocusDots({ focusAmt, setCachedFocus, focusRefTimeout, setFocusDiff, ANIM_TIME });

  const avatar = (<AvatarFrame $src={playerSnap.avatarUrl} $direction={direction}>
    {<ModifierTextComponent
      propertyName={'Health'}
      propertyValue={healthDiff}
      animTimeSecs={ANIM_TIME}
      $opacityCondition={(v: number) => !!v ? .85 : 0}
      $width={textModifierWidth}
      $height={textModifierHeight}
      $fontSize={textModifierFontSize}
      $extraTransform={`scaleX(${direction})`}
      $top={'50%'}
      $left={'45%'}
      $backgroundColor={healthDiff < 0 ? '#ee3737' : '#3bed8e'}
      $color={'white'}
    />}
    {/* {<ModifierTextComponent
      propertyName={'Focus'}
      propertyValue={focusDiff}
      animTimeSecs={ANIM_TIME}
      $opacityCondition={(v: number) => !!v ? .9 : 0}
      $width={textModifierWidth}
      $height={textModifierHeight}
      $fontSize={textModifierFontSize}
      $extraTransform={`scaleX(${direction})`}
      $top={'50%'}
      $left={'45%'}
      $backgroundColor={'#47d4ff9f'}
      $color={'white'}
    />} */}
    <Damageable $healthDiff={healthDiff}>
      <AvatarRobe $healthDiff={healthDiff} $src={playerSnap.avatarRobeUrl}>
        <AvatarHead $healthDiff={healthDiff} $src={playerSnap.avatarHeadUrl} />
        <AvatarRightArm $healthDiff={healthDiff} $src={playerSnap.avatarRightArmUrl} />
        <IK_ArmComponent mousePosRef={mousePosRef} healthDiff={healthDiff} playerSnap={playerSnap} direction={direction} />
      </AvatarRobe>
      <FloorShadow />
    </Damageable>
  </AvatarFrame>);

  const testHealth = 13;
  const healthbar = (<BarBorder $direction={direction}>

    {/* <BarText>
        {` / `}
      </BarText>
      <BarText>
        {playerSnap.getMaxHealth()}
      </BarText> */}
    {/* </BarTextContainer> */}
    <BarFill $pct={playerSnap.getHealthPrct()} $direction={direction}>
      {/* playerSnap.getHealthPrct()}> */}
      <BarTextContainer $pct={playerSnap.getHealthPrct()} $direction={direction}>
        <BarText>
          {/* {testHealth} */}
          {playerSnap.getHealth() != 0 ? playerSnap.getHealth() : ''}
        </BarText>
      </BarTextContainer>

    </BarFill>
  </BarBorder >);

  const focusDots = (
      <FocusContainer $direction={direction}>
        {/* STORED FOCUS */}
        {direction == -1 ? Array.from({ length: playerSnap.getMaxExcessFocus() }).map((_, i) => <ExcessFocusBadge key={i} $i={playerSnap.getMaxFocus() - i - 1} $focusAmt={playerSnap.getFocus() - playerSnap.getMaxFocus()} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: playerSnap.getMaxFocus() }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus()} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
        {/* EXCESS STORED FOCUS */}
        {direction == 1 ? Array.from({ length: playerSnap.getMaxExcessFocus() }).map((_, i) => <ExcessFocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus() - playerSnap.getMaxFocus()} $isPlayerOutOfFocus={isPlayerOutOfFocus} />) : Array.from({ length: playerSnap.getMaxFocus() }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus()} $isPlayerOutOfFocus={isPlayerOutOfFocus} />)}
      </FocusContainer>
  );

  /*
   
    TO-DO: have modifier text spawn from object pool...
    ISSUE: if player casts a spell then another, faster than ANIM_TIME, the second spell does not show modifier text.
    NEED: (1) ModifierTextComponent and (2) timeoutRef per recently cast (<2.5s) spell
  
  */
  return (<DuelistSideColumn>
    <Spotlight />
    {avatar}
    {focusDots}
    {healthbar}
  </DuelistSideColumn>);
}

export default PlayerComponent;
