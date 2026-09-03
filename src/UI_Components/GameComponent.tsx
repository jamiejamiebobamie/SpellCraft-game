
import React, { useEffect, useState, useRef } from 'react';
import PlayerComponent from './Player/PlayerComponent';
import SpellCanvasComponent from './SpellCanvas/SpellCanvasComponent';
import AutomaticSpellCanvasComponent from './SpellCanvas/AutomaticSpellCanvasComponent';
import { HARDCODED_SYMBOLS } from '../DataClasses/PlacedSpells/HardCodedSymbols';
import GameBoardComponent from './GameBoard/GameBoardComponent';
import GameLogComponent from './GameLog/GameLogComponent';
import SpellBookComponent from './UI_Elements/SpellBookComponent';
import EndTurnButtonComponent from './UI_Elements/EndTurnButtonComponent';
import ClockFaceComponent from './UI_Elements/ClockFaceComponent';
import { rootGameStore, controls } from '../DataClasses/store';
import styled from 'styled-components';
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
  const player1AvatarRef = useRef<HTMLImageElement | null>(null);
  const player2AvatarRef = useRef<HTMLImageElement | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Added React MouseEvent typing to handle DOM positional calculations safely
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoneRef.current) return;

    // Calculate mouse position relative to this specific container
    const rect = zoneRef.current.getBoundingClientRect();
    const mouseCoords = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setMouseCoords(mouseCoords);
  };

  // TESTING...
  const snap = useSnapshot(rootGameStore);
  const gameSymbolIcon = snap.getGameSymbolIcon();
  // PLAYERS - - 
  const playerOneSnap = useSnapshot(rootGameStore.players[0]);
  const playerTwoSnap = useSnapshot(rootGameStore.players[1]);
  // - - - - - - 

  // TO-DO: resolve Typescript-only type error here
  return (
    <GameWrapper
      ref={zoneRef}
      $isPlacingGameSymbol={!!gameSymbolIcon}
      onMouseMove={handleMouseMove}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const isUiButton = target.closest('[data-click-type="ui-buttons"]');
        // console.log({ isUiButton });
        if (isUiButton || rootGameStore.getIsClickDisabled() || !rootGameStore.getIsHumanPlayerTurn() || rootGameStore.getIsDrawing()) return;
        if (rootGameStore.getIsPlacing() && !rootGameStore.getIsGameBoardDisabled()) {
          const isClickOutsideGameBoard = !target.closest('[data-click-type="board-cell"]')
          if (isClickOutsideGameBoard) {
            rootGameStore.cancelPlacingSymbol();
          }
        } else {
          rootGameStore.beginDrawing();
        }
      }}
      // onMouseDown={() => {

      // }}
      onMouseUp={() => {
        if (!rootGameStore.getIsDrawing()) return;
        rootGameStore.endDrawing();
        rootGameStore.runInference();
      }}
      onMouseLeave={() => {
        if (!rootGameStore.getIsDrawing()) return;
        rootGameStore.endDrawing();
        rootGameStore.runInference();
      }}
    >
      <GameSymbolCursor $x={mouseCoords.x} $y={mouseCoords.y} $isVisible={!!gameSymbolIcon} $gameSymbolIcon={gameSymbolIcon} />
      <SpellBookComponent rootGameStore={rootGameStore} />
      {/* <EndTurnButtonComponent rootGameStore={rootGameStore} /> */}
      <ClockFaceComponent
        clockSpeed={.05}
        onMinuteHandLap={() => {
          rootGameStore.disableGameBoard();
          rootGameStore.updatePlacedSpells();
          rootGameStore.regenFocus();
          rootGameStore.enableGameBoard();
        }} />
      <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get('star')} rotation={270} size={'10cqw'} drawSpeed={.6} isLooped={true} />
      {/* have SpellCanvasComponent to allow for GameBoard cells hover -> have isDrawing = true on click and show canvas (if player's turn and not-NPC) */}
      <SpellCanvasComponent rootGameStore={rootGameStore} />
      {/* LEFT COLUMN: PLAYER */}
      <PlayerComponent rootGameStore={rootGameStore} isTurn={snap?.getIsTurn(1)} playerSnap={playerOneSnap} playerAvatarRef={player1AvatarRef} />
      {/* CENTER COLUMN: CANVAS GRID MATRIX */}
      <MainColumn>
        <GameBoardComponent rootGameStore={rootGameStore} />
        <GameLogComponent rootGameStore={rootGameStore} />
      </MainColumn>
      {/* RIGHT COLUMN: NPC PLAYER ENEMY */}
      <PlayerComponent isTurn={snap?.getIsTurn(-1)} playerSnap={playerTwoSnap} playerAvatarRef={player2AvatarRef} />
    </GameWrapper>
  );
};