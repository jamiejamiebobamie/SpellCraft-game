import React, { useEffect } from 'react';
import styled from 'styled-components';
import { proxy, useSnapshot } from 'valtio';

// 1. Types
interface Point { x: number; y: number; }

interface ArmState {
  shoulder: Point;
  target: Point;
  lengths: [number, number, number];
  rotations: [number, number, number];
}

// 2. Valtio Proxy State
const armState = proxy<ArmState>({
  shoulder: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  lengths: [45, 35, 15], // Adjusted in pixels to match smaller cqw layout scales
  rotations: [0, 0, 0],
});

// 3. FABRIK Solver Function
function solveIK(direction: number) {
  const { shoulder, target, lengths } = armState;

  // Initialize joint arrays
  let p = [
    { ...shoulder },
    { x: shoulder.x + lengths[0] * direction, y: shoulder.y },
    { x: shoulder.x + (lengths[0] + lengths[1]) * direction, y: shoulder.y },
    { x: shoulder.x + (lengths[0] + lengths[1] + lengths[2]) * direction, y: shoulder.y }
  ];

  const totalLength = lengths[0] + lengths[1] + lengths[2];
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);

  // Case 1: Out of reach - extend straight toward target
  if (distToTarget >= totalLength) {
    const angle = Math.atan2(dy, dx);
    armState.rotations = [angle * (180 / Math.PI), 0, 0];
    return;
  }

  // Case 2: FABRIK iteration loop
  for (let iteration = 0; iteration < 2; iteration++) {
    // Backward Pass
    p[3] = { ...target };
    for (let i = 2; i >= 0; i--) {
      const dX = p[i].x - p[i + 1].x;
      const dY = p[i].y - p[i + 1].y;
      const dist = Math.sqrt(dX * dX + dY * dY) || 1;
      p[i] = {
        x: p[i + 1].x + (dX * lengths[i]) / dist,
        y: p[i + 1].y + (dY * lengths[i]) / dist,
      };
    }

    // Forward Pass
    p[0] = { ...shoulder };
    for (let i = 0; i < 3; i++) {
      const dX = p[i + 1].x - p[i].x;
      const dY = p[i + 1].y - p[i].y;
      const dist = Math.sqrt(dX * dX + dY * dY) || 1;
      p[i + 1] = {
        x: p[i].x + (dX * lengths[i]) / dist,
        y: p[i].y + (dY * lengths[i]) / dist,
      };
    }
  }

  // Calculate local CSS transforms
  const globalAngles = [
    Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x),
    Math.atan2(p[2].y - p[1].y, p[2].x - p[1].x),
    Math.atan2(p[3].y - p[2].y, p[3].x - p[2].x),
  ];

  const radToDeg = 180 / Math.PI;

  // If character faces left ($direction = -1), flip math alignment base
  const baseFlip = direction === -1 ? 180 : 0;

  armState.rotations = [
    globalAngles[0] * radToDeg - baseFlip,
    (globalAngles[1] - globalAngles[0]) * radToDeg,
    (globalAngles[2] - globalAngles[1]) * radToDeg,
  ];
}

// 4. Styled Components with transform pivots
const ArmOverlayContainer = styled.div`
position: absolute; /* Changed from fixed */
  top: 0;
  left: 0;
  width: 100%;       /* Fills the column width instead of viewport */
  height: 100%;      /* Fills the column height instead of viewport */
  pointer-events: none; 
  z-index: 15;
  overflow: visible;
  // background-color: red;
`;

interface BoneProps {
  $length: number;
  $angle: number;
}

const Bicep = styled.div<BoneProps>`
  position: absolute;
  height: 1.2cqw;
  background: #ff5964;
  border-radius: 0.6cqw;
  transform-origin: left center;
  width: ${props => props.$length}px;
  transform: rotate(${props => props.$angle}deg);
`;

const Forearm = styled.div<BoneProps>`
  position: absolute;
  left: 100%;
  top: 0;
  height: 1cqw;
  background: #35a7ff;
  border-radius: 0.5cqw;
  transform-origin: left center;
  margin-top: 0.1cqw;
  width: ${props => props.$length}px;
  transform: rotate(${props => props.$angle}deg);
`;

const Hand = styled.div<BoneProps>`
  position: absolute;
  left: 100%;
  top: 0;
  height: 0.8cqw;
  background: #38b000;
  border-radius: 0.2cqw;
  transform-origin: left center;
  margin-top: 0.1cqw;
  width: ${props => props.$length}px;
  transform: rotate(${props => props.$angle}deg);
`;

// 5. Component Props
interface IKArmComponentProps {
  avatarRef: React.RefObject<HTMLImageElement | null>;
  direction: number;
}

export const IK_ArmComponent: React.FC<IKArmComponentProps> = ({ avatarRef, direction }) => {
  const snap = useSnapshot(armState);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!avatarRef.current) return;

      // 1. Find your avatar bounding rect bounds dynamically
      const rect = avatarRef.current.getBoundingClientRect();

      // 2. Define standard shoulder anchor offsets inside your sprite box
      // Adjust these percentages (0.35 and 0.4) until it matches your avatar's sprite art perfectly
      const shoulderX = direction === 1
        ? rect.left - rect.width / 2
        : rect.left + rect.width * (1 - 0.35);
      const shoulderY = rect.top + rect.height * 0.4;

      armState.shoulder = { x: shoulderX, y: shoulderY };
      armState.target = { x: e.clientX, y: e.clientY };

      solveIK(direction);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [avatarRef, direction]);

  return (
    <ArmOverlayContainer>
      <Bicep
        $length={snap.lengths[0]}
        $angle={snap.rotations[0]}
        style={{
          left: snap.shoulder.x,
          top: snap.shoulder.y,
          // Flip transform origin orientation if facing left
          transformOrigin: direction === -1 ? 'right center' : 'left center',
          marginLeft: direction === -1 ? -snap.lengths[0] : 0
        }}
      >
        <Forearm $length={snap.lengths[1]} $angle={snap.rotations[1]}>
          <Hand $length={snap.lengths[2]} $angle={snap.rotations[2]} />
        </Forearm>
      </Bicep>
    </ArmOverlayContainer>
  );
};
