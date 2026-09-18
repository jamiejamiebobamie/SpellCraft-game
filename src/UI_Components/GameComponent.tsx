
import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import PlayerComponent from './Player/PlayerComponent';
import SpellCanvasComponent from './SpellCanvas/SpellCanvasComponent';
import AutomaticSpellCanvasComponent from './SpellCanvas/AutomaticSpellCanvasComponent';
import { HARDCODED_SYMBOLS } from '../DataClasses/PlacedSpells/HardCodedSymbols';
import GameBoardComponent from './GameBoard/GameBoardComponent';
import GameLogComponent from './GameLog/GameLogComponent';
import SpellBookComponent from './UI_Elements/Buttons/SpellBookComponent';
import { PixieDustCanvas } from './SpellCanvas/PixieDustCanvas'
import ClockFaceComponent from './UI_Elements/Buttons/ClockFaceComponent';
import NpcDifficultyComponent from './UI_Elements/Buttons/NpcDifficultyComponent';
import ChandelierComponent from './UI_Elements/SceneElements/ChandelierComponent';
import { rootGameStore } from '../DataClasses/store';
import styled, { keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';

// The Candle Flicker Animation
const candleFlicker = keyframes`
 0%, 100% { filter: brightness(1.00); }
  12%      { filter: brightness(0.98); }
  24%      { filter: brightness(1.01); }
  36%      { filter: brightness(0.99); }
  50%      { filter: brightness(1.02); } /* Peak soft flare */
  62%      { filter: brightness(0.97); } /* Deepest gentle dim */
  75%      { filter: brightness(1.00); }
  88%      { filter: brightness(0.99); }
`;

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

  // background-image: url('UI_mockup.png');
  background-image: url('background-scene/QuickCast-Background-Test2.png');
  
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;

  // cursor: initial;
  cursor: ${props => props.$isPlacingGameSymbol ? 'none' : 'inherit'};

 /* 
    Runs the flicker loop. 
    Using 'linear' or 'ease-in-out' works well, but a fast duration (0.8s - 1.2s) 
    makes the chaotic jumps in the keyframes feel like real fire.
  */
  // animation: ${candleFlicker} 2s infinite linear;
  
  /* Improves browser rendering performance for heavy filters during animation */
  will-change: filter; 

`;

const MainColumn = styled.div`
  flex: 2;
  background: transparent;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  // overflow: hidden;
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
  const snap = useSnapshot(rootGameStore);
  // Explicitly typing the HTML element inside the hook reference
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const outOfFocusTimeoutRef = useRef<number>(false);
  const mousePos = useRef({ x: 0, y: 0 }); // mouseCoords in 'mousePos' useRef to throttle state updates
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPlayerOutOfFocus, setIsPlayerOutOfFocus] = useState<boolean>(false);
  const [, forceUpdate] = useReducer<number, []>((x) => x + 1, 0);
  const gameSymbolIcon = snap.getGameSymbolIcon();

  snap.useGameplayKeyBindings(forceUpdate);

  useEffect(() => {
    let animationFrameId: number;
    const updateGameSymbol = () => {
      setMouseCoords({ x: mousePos.current.x, y: mousePos.current.y });
      animationFrameId = requestAnimationFrame(updateGameSymbol);
    };

    animationFrameId = requestAnimationFrame(updateGameSymbol);

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameSymbolIcon]);

  // Added React MouseEvent typing to handle DOM positional calculations safely
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoneRef.current) return;

    // Calculate mouse position relative to this specific container
    const rect = zoneRef.current.getBoundingClientRect();
    const mouseCoords = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    mousePos.current = mouseCoords;
    // setMouseCoords(mouseCoords);
  }, []);

  // TESTING...
  // PLAYERS - - 
  const playerOneSnap = useSnapshot(rootGameStore.players[0]);
  const playerTwoSnap = useSnapshot(rootGameStore.players[1]);
  // - - - - - - 

  return (
    <>
      {/* <PixieDustCanvas /> */}
      <GameWrapper
        ref={zoneRef}
        $isPlacingGameSymbol={!!gameSymbolIcon}
        onMouseMove={handleMouseMove}
        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
          const target = e.target as HTMLElement;
          const isUiButton = target.closest('[data-click-type="ui-buttons"]');
          if (isUiButton || rootGameStore.getIsDrawing()) return;
          if (rootGameStore.getIsPlacing()) {
            const isClickOutsideGameBoard = !target.closest('[data-click-type="board-cell"]')
            if (isClickOutsideGameBoard) {
              rootGameStore.cancelPlacingSymbol();
            } else if (!rootGameStore.getHasFocus()) {
              setIsPlayerOutOfFocus(true);
              rootGameStore.appendToLog('Out of Focus! End your turn to regain focus.', '#6aadd9')
            }
          } else if (rootGameStore.getHasFocus()) {
            rootGameStore.beginDrawing();
          } else if (!rootGameStore.getHasFocus()) {
            setIsPlayerOutOfFocus(true);
            rootGameStore.appendToLog('Out of Focus! End your turn to regain focus.', '#6aadd9')
          }
        }}
        onMouseUp={() => {
          setIsPlayerOutOfFocus(false);
          if (!rootGameStore.getIsDrawing()) return;
          rootGameStore.endDrawing();
          rootGameStore.runInference();
        }}
        onMouseLeave={() => {
          setIsPlayerOutOfFocus(false);
          if (!rootGameStore.getIsDrawing()) return;
          rootGameStore.endDrawing();
          rootGameStore.runInference();
        }}
      >
        <ChandelierComponent left={'22.5cqw'} animDelay={'3.5s'} />
        <ChandelierComponent right={'22.5cqw'} />
        <GameSymbolCursor $x={mouseCoords.x} $y={mouseCoords.y} $isVisible={!!gameSymbolIcon} $gameSymbolIcon={gameSymbolIcon} />
        <SpellBookComponent rootGameStore={rootGameStore} />
        <NpcDifficultyComponent />
        <ClockFaceComponent
          rootGameStore={rootGameStore}
          // clockSpeed={clockSpeed}
          onMinuteHandLap={() => rootGameStore.endTurn(forceUpdate)} />
        {/* <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get('star')} rotation={270} size={'10cqw'} drawSpeed={.6} isLooped={true} /> */}
        <SpellCanvasComponent rootGameStore={rootGameStore} />
        {/* LEFT COLUMN: PLAYER */}
        <PlayerComponent playerSnap={playerOneSnap} mousePosRef={mousePos} isPlayerOutOfFocus={isPlayerOutOfFocus} />
        {/* CENTER COLUMN: CANVAS GRID MATRIX */}
        <MainColumn>
          <GameBoardComponent snap={snap} rootGameStore={rootGameStore} />
          <GameLogComponent snap={snap} rootGameStore={rootGameStore} />
        </MainColumn>
        {/* RIGHT COLUMN: NPC PLAYER ENEMY */}
        <PlayerComponent playerSnap={playerTwoSnap} mousePosRef={mousePos} isPlayerOutOfFocus={false} />
      </GameWrapper>
    </>
  );
};