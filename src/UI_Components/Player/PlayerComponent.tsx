
import React, { useState, useEffect, useRef, RefObject } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { IK_ArmComponent } from './IK_ArmComponent';
import { AvatarRobe, AvatarHead, AvatarRightArm, Damageable } from './CharacterParts';
import { ModifierTextComponent } from '../UI_Elements/ModifierTextComponent'
import styled from 'styled-components'

const DuelistSideColumn = styled.div`
  flex: 1;
  background: transparent;
  padding: 1.5cqw;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1cqw;
  z-index: 10;
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
  margin-bottom: 1.5cqw;
`;

const BarBorder = styled.div`
  position: relative; width: 80%; align-self: center; height: 1.6cqw; border: 0.15cqw solid #666; background: #222; border-radius: 0.3cqw; overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number }>`
  width: ${props => props.$pct}%; height: 100%; background: #aa2222; float: right; transition: width 0.2s ease;
`;

const BarTextContainer = styled.div`
    display: flex;
    position: absolute;
    z-index: 1;
    
    /* Pin to the top-left and take full area */
    top: 0;
    left: 0;
    width: 100%;
    height: 100%; 
    
    /* Perfectly center child text horizontally and vertically */
    justify-content: center;
    align-items: center;
    
    /* Font sizing */
    font-size: 1.3cqw; 
    
    /* Use line-height: 1 to prevent font metrics from pushing text down */
    line-height: 1; 
    
    transition: width 0.2s ease;
`;

const BarText = styled.div`
    padding: 0cqw .2cqw;
    color: #e2afaf;
    transition: width 0.2s ease;
`;

const FocusContainer = styled.div`
    display: flex;
    padding: .5cqw 5.75cqw;
    justify-content: space-around;
    gap: 0.4cqw;
    align-items: center;
    min-height: 1.1cqw; 
    position: relative;
`;

const FocusBadge = styled.div<{ key: number, $i: number, $focusAmt: number }>`
    width: .75cqw;
    height: .75cqw;
    border-radius: 50%;
    border: 0.12cqw solid #777;
    background: ${props => props.$i < props.$focusAmt ? '#6aadd9' : 'transparent'};
    transition: 'background 0.2s'
`;

const ExcessFocusBadge = styled(FocusBadge)`
    ${props => props.$i < props.$focusAmt ? 'border: 0.12cqw solid #777;' : `border: 0; width: .87cqw; height: .87cqw;`}
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
}

const PlayerComponent = ({ playerSnap }: PlayerComponentProps) => {
  const ANIM_TIME = 5;
  const textModifierWidth = '10cqw';
  const textModifierHeight = '10cqw';
  const textModifierFontSize = '3cqw';

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

  const avatar = (<AvatarFrame $src={playerSnap.avatarUrl} $direction={playerSnap.getDirection()}>
    {<ModifierTextComponent
      propertyName={'Health'}
      propertyValue={healthDiff}
      animTimeSecs={ANIM_TIME}
      $opacityCondition={(v: number) => !!v ? .85 : 0}
      $width={textModifierHeight}
      $height={textModifierWidth}
      $fontSize={textModifierFontSize}
      $extraTransform={`scaleX(${direction})`}
      $top={'50%'}
      $left={'45%'}
      $backgroundColor={healthDiff < 0 ? '#ee3737' : '#3bed8e'}
      $color={'white'}
    />}
    {<ModifierTextComponent
      propertyName={'Focus'}
      propertyValue={focusDiff}
      animTimeSecs={ANIM_TIME}
      $opacityCondition={(v: number) => !!v ? .85 : 0}
      $width={textModifierHeight}
      $height={textModifierWidth}
      $fontSize={textModifierFontSize}
      $extraTransform={`scaleX(${direction})`}
      $top={'50%'}
      $left={'45%'}
      // $backgroundColor={focusDiff < 0 ? '#8e25f7' : '#6bdcff'}
      $backgroundColor={'#44aac9'}
      $color={'white'}
    />}
    <Damageable $healthDiff={healthDiff}>
      <AvatarRobe $healthDiff={healthDiff} $src={playerSnap.avatarRobeUrl}>
        <AvatarHead $healthDiff={healthDiff} $src={playerSnap.avatarHeadUrl} />
        <AvatarRightArm $healthDiff={healthDiff} $src={playerSnap.avatarRightArmUrl} />
        <IK_ArmComponent healthDiff={healthDiff} playerSnap={playerSnap} direction={direction} />
      </AvatarRobe>
    </Damageable>
  </AvatarFrame>);

  const healthbar = (<BarBorder>
    <BarTextContainer>
      <BarText>
        {playerSnap.getHealth()}
      </BarText>
      <BarText>
        {` / `}
      </BarText>
      <BarText>
        {playerSnap.getMaxHealth()}
      </BarText>
    </BarTextContainer>
    <BarFill $pct={playerSnap.getHealthPrct()} />
  </BarBorder>);

  const focusDots = (
    <>
      <FocusContainer>
        {/* STORED FOCUS */}
        {Array.from({ length: playerSnap.getMaxFocus() }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus()} />)}
      </FocusContainer>
      <FocusContainer>
        {/* EXCESS STORED FOCUS */}
        {Array.from({ length: playerSnap.getMaxExcessFocus() }).map((_, i) => <ExcessFocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus() - playerSnap.getMaxFocus()} />)}
      </FocusContainer>
    </>
  );

  /*
  
    TO-DO: have modifier text spawn from object pool...
    ISSUE: if player casts a spell then another, faster than ANIM_TIME, the second spell does not show modifier text.
    NEED: (1) ModifierTextComponent and (2) timeoutRef per recently cast (<2.5s) spell

    TO-DO: consider rise/fall anim based on +/-

  */ 
  return (<DuelistSideColumn>
    {avatar}
    {healthbar}
    {focusDots}
  </DuelistSideColumn>);
}

export default PlayerComponent;
