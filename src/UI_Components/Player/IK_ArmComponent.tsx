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

      // 1. Get the dynamic bounds
      const bicepRect = bicepRef.current.getBoundingClientRect();

      // Fix 1: Establish a fixed structural shoulder point on the screen.
      // Do NOT use handRect here because the hand moving changes the math every frame.
      const shoulderOrigin = {
        x: bicepRect.x + (direction == -1 ? bicepRect.width : -bicepRect.width),
        y: bicepRect.y + bicepRect.height / 2
      };

      // Fix 2: Calculate target vector relative to a standard, static forward-facing vector (0 degrees)
      // instead of comparing it to the currently moving arm vector.
      const targetVector = {
        x: mouseLocation.x - shoulderOrigin.x,
        y: mouseLocation.y - shoulderOrigin.y
      };

      // Fix 3: Implement a safety dead zone. If mouse is too close to the shoulder joint, ignore it.
      const distanceToMouse = Math.hypot(targetVector.x, targetVector.y);
      if (distanceToMouse < bicepRect.width / 2) { // Adjust '20' (in pixels) depending on your asset size
        animationFrameId = requestAnimationFrame(updateArmIK);
        return;
      }

      // 4. Invert the X axis if facing left, so 'forward' math remains unified
      const normalizedTargetX = targetVector.x * direction;

      // Fix 4: Directly get the absolute target angle relative to the horizon (X-axis)
      let thetaRad = Math.atan2(targetVector.y, normalizedTargetX);

      // Convert directly to degrees
      let theta = (thetaRad * 180) / Math.PI * direction;

      // If your avatar faces right, 0 degrees is directly forward. 
      // Normalize theta to keep it relative to the forward rest position.
      if (theta > 180) theta -= 360;
      if (theta < -180) theta += 360;

      // Apply your rotation safety clamps
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
  playerSnap: Player;
  healthDiff: number;
  mousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ playerSnap, direction, healthDiff, mousePosRef }) => {
  const gameSymbol: GameSymbol | null = playerSnap.getGameSymbol();
  const bicepRef = useRef<HTMLImageElement | null>(null);
  const handRef = useRef<HTMLImageElement | null>(null);
  const [theta, setTheta] = useState<Array<number>>([]);
  useIK({ direction, handRef, bicepRef, mousePosRef, setTheta });
  return (
    <ArmOverlayContainer $direction={direction}>
      <AvatarBicep $healthDiff={healthDiff} ref={bicepRef} $src={playerSnap.avatarBicepUrl} $angle={theta[0] * direction}>
        <AvatarForearm $healthDiff={healthDiff} $src={playerSnap.avatarForearmUrl} $angle={theta[1] * direction}>
          <AvatarWandHand $speed={'2s'} $gameSymbol={gameSymbol?.symbolName} $healthDiff={healthDiff} ref={handRef} $src={playerSnap.avatarWandHandUrl} $angle={theta[2] * direction} />
        </AvatarForearm>
      </AvatarBicep>
    </ArmOverlayContainer>
  );
};