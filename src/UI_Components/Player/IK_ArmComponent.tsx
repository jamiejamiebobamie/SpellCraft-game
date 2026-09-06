import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { AvatarBicep, AvatarForearm, AvatarWandHand } from './CharacterParts';
import styled from 'styled-components';

// 4. Styled Components with transform pivots
const ArmOverlayContainer = styled.div<{ $direction: number }>`
position: absolute; /* Changed from fixed */
  top: 0;
  left: 0;
  width: 100%;       /* Fills the column width instead of viewport */
  height: 100%;      /* Fills the column height instead of viewport */
  pointer-events: none; 
  overflow: visible;
`;

// 5. Component Props
interface IKArmComponentProps {
  direction: number;
  playerSnap: Player;
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ playerSnap, direction }) => {
  const bicepRef = useRef<HTMLImageElement | null>(null);
  const handRef = useRef<HTMLImageElement | null>(null);
  const [theta, setTheta] = useState<Array<number>>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!bicepRef.current || !handRef.current) return;

      // 1. Find your avatar bounding rect bounds dynamically

      const bicepRect = bicepRef.current.getBoundingClientRect();
      const handRect = handRef.current.getBoundingClientRect();

      const armOrigin = { x: bicepRect.x, y: bicepRect.y + bicepRect.height / 2 };
      const armEnd = { x: handRect.left, y: bicepRect.y + bicepRect.height / 2 };
      const mouseLocation = { x: e.clientX, y: e.clientY };

      const armVector = { x: armEnd.x - armOrigin.x, y: armEnd.y - armOrigin.y };
      const targetVector = { x: mouseLocation.x - armOrigin.x, y: mouseLocation.y - armOrigin.y };

      // 1. Calculate absolute angles for both vectors relative to the X axis
      const angleArm = Math.atan2(armVector.y, armVector.x);
      const angleTarget = Math.atan2(targetVector.y, targetVector.x);

      // 2. Find the relative difference
      let diffAngle = angleTarget - angleArm;

      // 3. Normalize to keep the angle strictly between -PI and PI (-180° and 180°)
      if (diffAngle > Math.PI) diffAngle -= 2 * Math.PI;
      if (diffAngle < -Math.PI) diffAngle += 2 * Math.PI;

      // 4. Convert to degrees
      const theta = diffAngle * 180 / Math.PI;

      if (Math.abs(theta) < 120) {
        const thetaSixth = theta / 6; // shoulder
        const thetaThird = theta / 3; // elbow
        const thetaHalf = theta / 2; // wrist

        setTheta([thetaSixth, thetaThird, thetaHalf]);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <ArmOverlayContainer $direction={direction}>
      <AvatarBicep ref={bicepRef} $src={playerSnap.avatarBicepUrl} $angle={theta[0] * direction}>
        <AvatarForearm $src={playerSnap.avatarForearmUrl} $angle={theta[1] * direction}>
          <AvatarWandHand ref={handRef} $src={playerSnap.avatarWandHandUrl} $angle={theta[2] * direction} />
        </AvatarForearm>
      </AvatarBicep>
    </ArmOverlayContainer>
  );
};