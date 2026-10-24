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
  isWalkingRef: RefObject<boolean>;
}

/**
 * How often the shoulder's place on the page is measured (milliseconds). Measuring it every frame made the
 * browser bring every animation's styles up to date mid-frame; the wizards only drift a little as they bob.
 * While a wizard walks in it's measured every frame: measured less often, the arm jumped as the shoulder moved.
 */
const SHOULDER_MEASURE_MILLI = 250;

const useIK = ({ direction, handRef, bicepRef, mousePosRef, setTheta, isWalkingRef }: usIKProps) => {
  useEffect(() => {
    let animationFrameId: number;
    let bicepRect: DOMRect | null = null, measuredAt = -Infinity;
    let lastTheta = [NaN, NaN, NaN];

    const updateArmIK = (now: number) => {
      const npcMousePos = rootGameStore.getNpcMousePos();
      if (!bicepRef.current || !handRef.current) return;

      const mouseLocation = direction == 1 ? mousePosRef?.current : npcMousePos;
      if (!mouseLocation) return;

      if (!bicepRect || isWalkingRef.current || now - measuredAt >= SHOULDER_MEASURE_MILLI) { bicepRect = bicepRef.current.getBoundingClientRect(); measuredAt = now; }
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

        // (redrawn only when it has turned: a re-render every frame otherwise)
        if (Number.isNaN(lastTheta[0]) || Math.abs(thetaSixth - lastTheta[0]) > 0.05) {
          lastTheta = [thetaSixth, thetaThird, thetaHalf];
          setTheta(lastTheta);
        }
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
  isDead: boolean;
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ isDead, playerSnap, direction, healthDiff, mousePosRef }) => {
  
  const avatarBicepSrc = playerSnap?.avatarBicepUrl || '';
  const avatarForearmSrc = playerSnap?.avatarForearmUrl || '';
  const avatarWandHandSrc = playerSnap?.avatarWandHandUrl || '';
  const gameSymbol: GameSymbol | null | undefined = playerSnap?.getGameSymbol();

  const bicepRef = useRef<HTMLImageElement | null>(null);
  const handRef = useRef<HTMLImageElement | null>(null);
  const [theta, setTheta] = useState<Array<number>>([]);
  // (walking in: the shoulder measured every frame, useIK)
  const isWalkingRef = useRef(false);
  isWalkingRef.current = !!playerSnap?.getIsBeginIntroWalk() && !playerSnap?.getIsDoneWithIntroWalk();

  useIK({ direction, handRef, bicepRef, mousePosRef, setTheta, isWalkingRef });

  return (
    <ArmOverlayContainer $direction={direction}>
      <AvatarBicep $isDead={isDead} $healthDiff={healthDiff} ref={bicepRef} $src={avatarBicepSrc} $angle={theta[0] * direction}>
        <AvatarForearm $healthDiff={healthDiff} $src={avatarForearmSrc} $angle={theta[1] * direction}>
          <AvatarWandHand $speed={'2s'} $gameSymbol={gameSymbol?.symbolName} $healthDiff={healthDiff} ref={handRef} $src={avatarWandHandSrc} $angle={theta[2] * direction} />
        </AvatarForearm>
      </AvatarBicep>
    </ArmOverlayContainer>
  );
};