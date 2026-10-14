import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import PlayerComponent from './Player/PlayerComponent';
import HTMLCanvasComponent from './HTMLCanvas/HTMLCanvasComponent';
import GameBoardComponent from './GameBoard/GameBoardComponent';
import StarrySkyComponent from './SceneElements/StarrySkyComponent';
import ChandelierComponent from './SceneElements/ChandelierComponent';
import TooltipModalComponent from './TooltipModalComponent';
import LoaderComponent from './LoaderComponent';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';
import { UIFadeIn } from './UIFadeIn';
import { INTRO_WALK_ANIM_TIME } from './Player/CharacterParts';

const GameWrapper = styled.div<{ $backgroundSceneBrightness: number }>`
  margin: 0 auto; 
  display: flex;
  flex-direction: row;
  user-select: none;
  overflow: hidden;
  position: relative;

  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;

  align-self: center;
  
  /* Fallbacks to make sure it never overflows the height or boundaries */
  max-width: min(1200px, calc(100dvh * 16 / 9));
  max-height: 100dvh;

  transition: width 1s, height 1s;
  
  container-type: inline-size;
  container-name: game-canvas;
  border: 0.15cqw solid #2d2d2d;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('background-scene/QuickCast-Background-Test3.png');
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    transition: filter ${INTRO_WALK_ANIM_TIME}s;
    filter: brightness(${props => props.$backgroundSceneBrightness}); 
    z-index: -1;
  }
`;

const MainColumn = styled(UIFadeIn)`
  flex: 3;
  background: transparent;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  z-index: 11;
`;

export const GameComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const gameWrapperRef = useRef<HTMLDivElement | null>(null);
  const gridOverlayRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const [isPlayerOutOfFocus, setIsPlayerOutOfFocus] = useState<boolean>(false);
  const [, forceUpdate] = useReducer<number, []>((x) => x + 1, 0);
  const isPlaying = snap.getIsPlaying();
  const isOutOfFocus = snap.getIsOutOfFocus();
  const backgroundSceneBrightness = snap.getBackgroundSceneBrightness();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const isTooltips = snap.getIsTooltips();

  useEffect(() => {
    if (isPlaying) {
      if (isTooltips) {
        // SEE TOOLTIPS
        rootGameStore.showTooltip()
      } else {
        // PLAY
        rootGameStore.beginIntro();
      }
    }
  }, [isPlaying, isTooltips]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    if (!gameWrapperRef.current) return;

    const rect = gameWrapperRef.current.getBoundingClientRect();
    const mouseCoords = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    mousePos.current = mouseCoords;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    if (!gameWrapperRef.current) return;

    const rect = gameWrapperRef.current.getBoundingClientRect();

    if (e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    const mouseCoords = {
      x: x - rect.left,
      y: y - rect.top,
    };

    mousePos.current = mouseCoords;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    const target = e.target as HTMLElement;
    const isUiButton = target.closest('[data-click-type="ui-buttons"]');
    if (isUiButton || rootGameStore.getIsDrawing()) return;

    if (rootGameStore.getHasFocus()) {
      rootGameStore.beginDrawing();

    } else
      if (!rootGameStore.getHasFocus()) {
        setIsPlayerOutOfFocus(true);
        rootGameStore.cancelPlacingSymbol();
      }
  }, []);

  const handleTouchDown = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    const target = e.target as HTMLElement;
    const isUiButton = target.closest('[data-click-type="ui-buttons"]');
    if (isUiButton || rootGameStore.getIsDrawing()) return;

    if (rootGameStore.getHasFocus()) {
      rootGameStore.beginDrawing();

    } else
      if (!rootGameStore.getHasFocus()) {
        setIsPlayerOutOfFocus(true);
        rootGameStore.cancelPlacingSymbol();
      }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    rootGameStore.startBackgroundMusic();
    setIsPlayerOutOfFocus(false);
    if (!rootGameStore.getIsDrawing()) return;
    rootGameStore.endDrawing();
    rootGameStore.runInference({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchUp = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

    rootGameStore.startBackgroundMusic();
    setIsPlayerOutOfFocus(false);
    if (!rootGameStore.getIsDrawing()) return;
    rootGameStore.endDrawing();

    let touch = undefined;
    if (e && e.touches) {
      const touches = e?.touches;
      const x = touches ? touches[0]?.clientX : undefined;
      const y = touches ? touches[0]?.clientY : undefined;
      if (x && y) touch = { x, y };
    }

    rootGameStore.runInference(touch);
  }, []);

  useEffect(() => {
    const el = gameWrapperRef.current;
    if (!el) return;

    const options = { passive: false };

    el.addEventListener('touchstart', handleTouchDown, options);
    el.addEventListener('touchmove', handleTouchMove, options);
    el.addEventListener('touchend', handleTouchUp, options);
    el.addEventListener('touchcancel', handleTouchUp, options);

    return () => {
      el.removeEventListener('touchstart', handleTouchDown);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchUp);
      el.removeEventListener('touchcancel', handleTouchUp);
    };
  }, []);

  useEffect(() => {
    rootGameStore.setForceUpdate(forceUpdate);
  }, []);

  snap.useGameplayKeyBindings();

  useEffect(() => {
    rootGameStore.setGameBoardRef(gridOverlayRef);
  }, [gridOverlayRef]);

  useEffect(() => {
    rootGameStore.setGameWrapperRef(gameWrapperRef);
  }, [gameWrapperRef]);

  const sceneElements = <>
    <ChandelierComponent
      backgroundSceneBrightness={backgroundSceneBrightness}
      left={'22.5cqw'} animDelay={'-3.5s'}
    />
    <ChandelierComponent
      backgroundSceneBrightness={backgroundSceneBrightness}
      right={'22.5cqw'} />
    {Array.from({ length: 4 }).map((_, i) => <StarrySkyComponent key={i} index={i} />)}
  </>;

  const mainUI = <>
    <PlayerComponent playerIndex={0} mousePosRef={mousePos} isPlayerOutOfFocus={isPlayerOutOfFocus || isOutOfFocus} />
    <MainColumn $isDoneWithIntro={isDoneWithIntro}>
      <GameBoardComponent gridOverlayRef={gridOverlayRef} />
    </MainColumn>
    <PlayerComponent playerIndex={1} mousePosRef={mousePos} isPlayerOutOfFocus={false} />
  </>;

  return (
    <GameWrapper
      ref={gameWrapperRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      $backgroundSceneBrightness={backgroundSceneBrightness}
    >
      <LoaderComponent />
      <TooltipModalComponent />
      <HTMLCanvasComponent gridOverlayRef={gridOverlayRef} />
      {sceneElements}
      {mainUI}
    </GameWrapper>)
};