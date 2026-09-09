
import React, { useState } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { IK_ArmComponent } from './IK_ArmComponent';
import { AvatarRobe, AvatarHead, AvatarRightArm } from './CharacterParts';
import styled from 'styled-components';

const DuelistSideColumn = styled.div`
  flex: 1;
  background: transparent;// #161616;
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

type PlayerComponentProps = {
  playerSnap: Player;
}

const PlayerComponent = ({ playerSnap }: PlayerComponentProps) => {
  // TO-DO: (1) (dmg:) add avatar "shake", (2) red dmg flash, and (3) floating modifier text on negative health loss
  // TO-DO: (1) (heal:) green white or blue flash, and (2) floating modifier text on positive health gain
  const [isDamaged, setIsDamaged] = useState(false);
  return (<DuelistSideColumn onClick={() => setIsDamaged(isDmg => !isDmg)}>
    <AvatarFrame $src={playerSnap.avatarUrl} $direction={playerSnap.getDirection()}>
      <AvatarRobe $src={playerSnap.avatarRobeUrl}>
        <AvatarHead $src={playerSnap.avatarHeadUrl} />
        <AvatarRightArm $src={playerSnap.avatarRightArmUrl} />
        <IK_ArmComponent playerSnap={playerSnap} direction={playerSnap.getDirection()} />
      </AvatarRobe>
    </AvatarFrame>
    <BarBorder>
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
    </BarBorder>
    <FocusContainer>
      {/* STORED FOCUS */}
      {Array.from({ length: playerSnap.getMaxFocus() }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus()} />)}
    </FocusContainer>
    <FocusContainer>
      {/* EXCESS STORED FOCUS */}
      {Array.from({ length: playerSnap.getMaxExcessFocus() }).map((_, i) => <ExcessFocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus() - playerSnap.getMaxFocus()} />)}
    </FocusContainer>
  </DuelistSideColumn>);
}

export default PlayerComponent;
