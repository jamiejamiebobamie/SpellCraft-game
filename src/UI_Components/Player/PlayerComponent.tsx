
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
  // background-image: url(${props => props.$src});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: 1;
  position: relative;
`;

const BarBorder = styled.div`
  width: 80%; align-self: center; height: 1.6cqw; border: 0.15cqw solid #666; background: #222; border-radius: 0.3cqw; overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number }>`
  width: ${props => props.$pct}%; height: 100%; background: #aa2222; float: right; transition: width 0.2s ease;
`;

const FocusContainer = styled.div`
    display: flex;
    padding: .5cqw 5.75cqw;
    justify-content: space-around;
    gap: 0.4cqw;
    align-items: center;
`;

const FocusBadge = styled.div<{ key: number, $i: number, $focusAmt: number }>`
    width: .75cqw;
    height: .75cqw;
    border-radius: 50%;
    border: 0.12cqw solid #777;
    background: ${props => props.$i < props.$focusAmt ? '#6aadd9' : 'transparent'};
    transition: 'background 0.2s'
`;

const FizzleContainer = styled.div`
    height: 2.1cqw;
    display: flex;
    padding-left: 3.75cqw;
    gap: 0.4cqw;
    align-items: center;
    min-height: 1.5cqw; 
`;

const FizzleBadge = styled.div`
    color: #9076c4;
    font-size: 2.1cqw;
    padding-left: 1.59cqw;

    &::before {
        content: "꩜";
        display: inline-block; /* Required for transforms to work */
        animation: spin-spiral 2s linear infinite; /* Adjust duration here */
        filter: blur(1.2px) drop-shadow(0px 0px 6px black);
      }

    @keyframes spin-spiral {
      from {
        transform: rotate(360deg);
      }
      to {
        transform: rotate(0deg);
      }
    }
`;

type PlayerComponentProps = {
  playerSnap: Player;
  playerAvatarRef: HTMLImageElement | null;
  isTurn: boolean;
}

const PlayerComponent = ({ playerSnap, playerAvatarRef }: PlayerComponentProps) => {
  // TO-DO: (1) add avatar "shake", (2) red dmg flash, and (3) floating modifier text on negative health loss
  // TO-DO: (1) green white or blue flash, and (2) floating modifier text on positive health gain
  const [isDamaged, setIsDamaged] = useState(false);
  // console.log({ isDamaged })
  return (<DuelistSideColumn onClick={() => setIsDamaged(isDmg => !isDmg)}>
    <AvatarFrame ref={playerAvatarRef} $src={playerSnap.avatarUrl} $direction={playerSnap.getDirection()}>
      <AvatarRobe $src={playerSnap.avatarRobeUrl}>
        <AvatarHead $src={playerSnap.avatarHeadUrl} />
        <AvatarRightArm $src={playerSnap.avatarRightArmUrl} />
        <IK_ArmComponent playerSnap={playerSnap} direction={playerSnap.getDirection()} />
      </AvatarRobe>
    </AvatarFrame>
    <BarBorder><BarFill $pct={playerSnap.getHealthPrct()} /></BarBorder>
    <FocusContainer>
      {Array.from({ length: playerSnap.getMaxFocus() }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={playerSnap.getFocus()} />)}
    </FocusContainer>
    <FizzleContainer>
      {playerSnap.getFizzles().map(f => (<FizzleBadge key={f.id} />))}
    </FizzleContainer>
  </DuelistSideColumn>);
}

export default PlayerComponent;
