import React, { useEffect, useRef, useState, RefObject, Dispatch, SetStateAction } from 'react';
import { Player } from '../../DataClasses/Player/Player';
import { AvatarBicep, AvatarForearm, AvatarWandHand, DEATH_POSE } from './CharacterParts';
import styled from 'styled-components';
import { GameSymbol } from '../../DataClasses/PlacedSpells/GameSymbol';
import { rootGameStore } from '../../DataClasses/store';
import { FLAIL } from '../SceneElements/teacherCatchConfig';
import { getFlurryWandPoint } from '../SceneElements/TeacherCatch';

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
  catchRef: RefObject<{ sceneId: number; startedAt: number } | null>;
}

/**
 * How often the shoulder's place on the page is measured (milliseconds). Measuring it every frame made the
 * browser bring every animation's styles up to date mid-frame; the wizards only drift a little as they bob.
 * While a wizard walks in it's measured every frame: measured less often, the arm jumped as the shoulder moved.
 */
const SHOULDER_MEASURE_MILLI = 250;

const useIK = ({ direction, handRef, bicepRef, mousePosRef, setTheta, isWalkingRef, catchRef }: usIKProps) => {
  useEffect(() => {
    let animationFrameId: number;
    let bicepRect: DOMRect | null = null, measuredAt = -Infinity;
    let lastTheta = [NaN, NaN, NaN];

    const updateArmIK = (now: number) => {
      // (caught by a teacher, struggling: the wand tracing each spell as it's drawn, or flailing between,
      // each joint swinging at its own speed: FLAIL)
      const caught = catchRef.current;
      let wandPoint: { x: number; y: number } | null = null;
      if (caught) {
        const t = (now - caught.startedAt) / 1000;
        if (t >= FLAIL.fromSeconds && t <= FLAIL.fromSeconds + FLAIL.seconds) {
          wandPoint = getFlurryWandPoint(caught.sceneId, direction == 1 ? 'self' : 'rival', t);
          if (!wandPoint) {
            setTheta(FLAIL.swings.map(([rest, sway, speed], k) => rest + sway * FLAIL.wildness * Math.sin(t * speed * FLAIL.frantic + k * 1.7)));
            lastTheta = [NaN, NaN, NaN];
            animationFrameId = requestAnimationFrame(updateArmIK);
            return;
          }
          bicepRect = null; // (the wizard is moving: measured afresh)
        }
      }

      const npcMousePos = rootGameStore.getNpcMousePos();
      // (no arm yet, or nothing to point at yet: looked for again next frame)
      if (!bicepRef.current || !handRef.current) { animationFrameId = requestAnimationFrame(updateArmIK); return; }

      const mouseLocation = wandPoint ?? (direction == 1 ? mousePosRef?.current : npcMousePos);
      if (!mouseLocation) { animationFrameId = requestAnimationFrame(updateArmIK); return; }

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
  flailFor?: number | null; // (a catch scene's id: this wizard caught, the arm flailing in its struggle)
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ isDead, playerSnap, direction, healthDiff, mousePosRef, flailFor }) => {
  
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

  // (caught: the scene and when it began, for the struggle: tracing its spells, flailing)
  const catchRef = useRef<{ sceneId: number; startedAt: number } | null>(null);
  useEffect(() => { catchRef.current = flailFor ? { sceneId: flailFor, startedAt: performance.now() } : null; }, [flailFor]);

  useIK({ direction, handRef, bicepRef, mousePosRef, setTheta, isWalkingRef, catchRef });

  return (
    <ArmOverlayContainer $direction={direction}>
      <AvatarBicep $isDead={isDead} $healthDiff={healthDiff} ref={bicepRef} $src={avatarBicepSrc} $angle={theta[0] * direction}>
        {/* (dead: hanging limp, no longer following the aim: DEATH_POSE) */}
        <AvatarForearm $healthDiff={healthDiff} $src={avatarForearmSrc} $angle={isDead ? DEATH_POSE.forearmDeg : theta[1] * direction}>
          <AvatarWandHand $speed={'2s'} $gameSymbol={gameSymbol?.symbolName} $healthDiff={healthDiff} ref={handRef} $src={avatarWandHandSrc} $angle={isDead ? DEATH_POSE.handDeg : theta[2] * direction} />
        </AvatarForearm>
      </AvatarBicep>
    </ArmOverlayContainer>
  );
};