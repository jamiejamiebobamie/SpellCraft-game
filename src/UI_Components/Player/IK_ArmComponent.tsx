import React, { useEffect, useRef, useState, RefObject, Dispatch, SetStateAction } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { AvatarBicep, AvatarForearm, AvatarWandHand } from './CharacterParts';
import styled from 'styled-components';
import { GameSymbol } from '../../DataClasses/PlacedSpells/GameSymbol';
import { rootGameStore } from '../../DataClasses/store';

const ArmOverlayContainer = styled.div<{ $direction: number }>`
position: absolute; /* Changed from fixed */
  top: 0;
  left: 0;
  width: 100%;       /* Fills the column width instead of viewport */
  height: 100%;      /* Fills the column height instead of viewport */
  pointer-events: none; 
  overflow: visible;
`;

type usIKProps = {
  direction: number;
  handRef: RefObject<HTMLDivElement | null>;
  bicepRef: RefObject<HTMLDivElement | null>;
  mousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
  setTheta: Dispatch<SetStateAction<Array<number>>>;
}

const useIK = ({ direction, handRef, bicepRef, mousePosRef, setTheta }: usIKProps) => {
  useEffect(() => {
    let animationFrameId: number;

    const updateArmIK = () => {
      const npcMousePos = rootGameStore.getNpcMousePos();
      if (!bicepRef.current || !handRef.current) return;

      const mouseLocation = direction == 1 ? mousePosRef?.current : npcMousePos;
      if (!mouseLocation) return;

      const bicepRect = bicepRef.current.getBoundingClientRect();
      const shoulderOrigin = {
        x: bicepRect.x + (direction == -1 ? bicepRect.width : -bicepRect.width),
        y: bicepRect.y + bicepRect.height / 2
      };
      const targetVector = {
        x: mouseLocation.x - shoulderOrigin.x,
        y: mouseLocation.y - shoulderOrigin.y
      };

      const distanceToMouse = Math.hypot(targetVector.x, targetVector.y);
      if (distanceToMouse < bicepRect.width / 2) {
        animationFrameId = requestAnimationFrame(updateArmIK);
        return;
      }
      const normalizedTargetX = targetVector.x * direction;

      let thetaRad = Math.atan2(targetVector.y, normalizedTargetX);

      let theta = (thetaRad * 180) / Math.PI * direction;
      if (theta > 180) theta -= 360;
      if (theta < -180) theta += 360;

      if (Math.abs(theta) <= 120) {
        const thetaSixth = theta * 1 / 6; // shoulder
        const thetaThird = theta * 1 / 3; // elbow
        const thetaHalf = theta * 1 / 2;  // wrist

        setTheta([thetaSixth, thetaThird, thetaHalf]);
      }

      animationFrameId = requestAnimationFrame(updateArmIK);
    };

    animationFrameId = requestAnimationFrame(updateArmIK);
    return () => cancelAnimationFrame(animationFrameId);
  }, [direction]);

}

interface IKArmComponentProps {
  direction: number;
  playerSnap: Player | undefined;
  healthDiff: number;
  mousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ playerSnap, direction, healthDiff, mousePosRef }) => {
  
  const avatarBicepSrc = playerSnap?.avatarBicepUrl || '';
  const avatarForearmSrc = playerSnap?.avatarForearmUrl || '';
  const avatarWandHandSrc = playerSnap?.avatarWandHandUrl || '';
  const gameSymbol: GameSymbol | null | undefined = playerSnap?.getGameSymbol();

  const bicepRef = useRef<HTMLImageElement | null>(null);
  const handRef = useRef<HTMLImageElement | null>(null);
  const [theta, setTheta] = useState<Array<number>>([]);

  useIK({ direction, handRef, bicepRef, mousePosRef, setTheta });

  return (
    <ArmOverlayContainer $direction={direction}>
      <AvatarBicep $healthDiff={healthDiff} ref={bicepRef} $src={avatarBicepSrc} $angle={theta[0] * direction}>
        <AvatarForearm $healthDiff={healthDiff} $src={avatarForearmSrc} $angle={theta[1] * direction}>
          <AvatarWandHand $speed={'2s'} $gameSymbol={gameSymbol?.symbolName} $healthDiff={healthDiff} ref={handRef} $src={avatarWandHandSrc} $angle={theta[2] * direction} />
        </AvatarForearm>
      </AvatarBicep>
    </ArmOverlayContainer>
  );
};