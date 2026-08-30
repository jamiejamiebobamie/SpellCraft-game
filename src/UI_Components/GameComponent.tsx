
import React, { useEffect, useState, useRef } from 'react';
import PlayerComponent from './PlayerComponent';
import SpellCanvasComponent from './SpellCanvasComponent';
import GameBoardComponent from './GameBoardComponent';
import GameLogComponent from './GameLogComponent';
import SpellBookComponent from './SpellBookComponent';
import { rootGameStore, controls } from '../DataClasses/store';
import styled from 'styled-components';
import { Ether, Gyre, Phlegm, Quicken } from '../DataClasses/PlacedSpells/Spell';
import { useSnapshot } from 'valtio';

const GameWrapper = styled.div<{ $isPlacingGameSymbol: boolean }>`
  margin: 0 auto; 
  width: 100%;
  min-width: 400px;
  max-width: 1200px;
  aspect-ratio: 16 / 9;
  container-type: inline-size;
  container-name: game-canvas;
  display: flex;
  flex-direction: row;
  user-select: none;
  overflow: hidden;
  position: relative;
  border: 0.15cqw solid #2d2d2d;

  background-image: url('UI_mockup.png');
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;

  // cursor: initial;
  cursor: ${props => props.$isPlacingGameSymbol ? 'none' : 'inherit'};

`;

const MainColumn = styled.div`
  flex: 2;
  background: transparent;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
`;


interface ResponsiveCursorProps {
  $x: number;
  $y: number;
  $isVisible: boolean;
  $gameSymbolIcon: string;
}

// The Responsive Tracker Element with explicit TS typings
const GameSymbolCursor = styled.div.attrs<ResponsiveCursorProps>(props => ({
  style: {
    left: `${props.$x}px`,
    top: `${props.$y}px`,
  },
})) <ResponsiveCursorProps>`
  position: absolute;
  pointer-events: none; /* Allows clicks to pass through to elements beneath */
  background-image: url(${props => props.$gameSymbolIcon}); /* Swap with your image path */
  background-size: contain;
  background-repeat: no-repeat;
  
  /* Scale the cursor dynamically using Container Query Width */
  width: 8cqw;
  height: 8cqw;
  
  /* Centers the cursor hotspot exactly on the coordinate */
  transform: translate(-50%, -50%); 
  
  /* Hide by default, display only when hovering the parent zone */
  display: ${props => (props.$isVisible ? 'block' : 'none')};

  z-index: 40;
`;

export const GameComponent = () => {
  // Explicitly typing the HTML element inside the hook reference
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Added React MouseEvent typing to handle DOM positional calculations safely
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoneRef.current) return;

    // Calculate mouse position relative to this specific container
    const rect = zoneRef.current.getBoundingClientRect();
    setMouseCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // TESTING...
  const snap = useSnapshot(rootGameStore);
  const gameSymbolIcon = snap.getGameSymbolIcon();
  // PLAYERS - - 
  const playerOneSnap = useSnapshot(rootGameStore.players[0]);
  const playerTwoSnap = useSnapshot(rootGameStore.players[1]);
  // - - - - - - 

  // console.log({ snap, gameSymbolIcon });

  return (
    <GameWrapper
      ref={zoneRef}
      $isPlacingGameSymbol={!!gameSymbolIcon}
      onMouseMove={handleMouseMove}
      onMouseDown={(e) => {
        if (e.button === 2) {
          rootGameStore.appendToLog("Right Click Canvas Logged", "#888");
          rootGameStore.spellCanvas.toggleShowCanvas();
          console.log('right click!')
           rootGameStore.spellCanvas.getIsShowCanvas() ? rootGameStore.hideGameBoard() : rootGameStore.enableGameBoard();
        }
      }}>
      <GameSymbolCursor $x={mouseCoords.x} $y={mouseCoords.y} $isVisible={!!gameSymbolIcon} $gameSymbolIcon={gameSymbolIcon} />
      {<SpellBookComponent />}
      <SpellCanvasComponent rootGameStore={rootGameStore} />
      {/* LEFT COLUMN: PLAYER */}
      {/* TO-DO: resolve Typescript-only type error here */}
      <PlayerComponent playerSnap={playerOneSnap} />
      {/* CENTER COLUMN: CANVAS GRID MATRIX */}
      <MainColumn>
        <GameBoardComponent rootGameStore={rootGameStore} />
        <GameLogComponent gameLogSnap={snap.gameLog} />
      </MainColumn>
      {/* RIGHT COLUMN: NPC PLAYER ENEMY */}
      {/* TO-DO: resolve Typescript-only type error here */}
      <PlayerComponent playerSnap={playerTwoSnap} />
    </GameWrapper>
  );
};