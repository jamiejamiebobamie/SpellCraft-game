import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import PlayerComponent from './Player/PlayerComponent';
import HTMLCanvasComponent from './HTMLCanvas/HTMLCanvasComponent';
import GameBoardComponent from './GameBoard/GameBoardComponent';
import StarrySkyComponent from './SceneElements/StarrySkyComponent';
import ChandelierComponent from './SceneElements/ChandelierComponent';
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

// TO-DO: add back in 'tsc -b &&' for the build script options... ORIGINAL:     "build": "tsc -b && vite build",

// TO-DO: hide website until spell model loads....

// TO-DO: local storage is not working on iPhone/iPad(?)

/* --- TOOLTIP OVERLAY STYLES --- */
const TooltipOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4cqw;
  box-sizing: border-box;
  z-index: 9999; /* Top-level item */
`;

const ModalContent = styled.div`
  background: #1a1a1a;
  border: 0.2cqw solid #444;
  border-radius: 0.8cqw;
  padding: 3cqw;
  width: 80%;
  max-width: 800px;
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 3cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.8);
  color: #fff;
  box-sizing: border-box;
`;

const TextColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;

  h2 {
    margin-top: 0;
    margin-bottom: 1.5cqw;
    font-size: 2.2cqw;
    color: #e6c563;
    font-family: sans-serif;
  }

  p {
    margin: 0 0 1cqw 0;
    font-size: 1.3cqw;
    line-height: 1.5;
    color: #e0e0e0;
    font-family: sans-serif;
  }
`;

const MediaColumn = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 25cqw;
    max-height: 25cqw;
    border-radius: 0.4cqw;
    border: 0.1cqw solid #333;
    object-fit: contain;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1cqw;
  right: 1cqw;
  background: transparent;
  border: none;
  color: #888;
  font-size: 2cqw;
  cursor: pointer;
  line-height: 1;
  padding: 0.2cqw;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }
`;

const FooterControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2cqw;
  margin-top: 2cqw;
  width: 100%;
  border-top: 0.1cqw solid #333;
  padding-top: 1.5cqw;
`;

const PageIndicator = styled.span`
  font-size: 1.2cqw;
  color: #aaa;
  font-family: sans-serif;
  min-width: 4cqw;
  text-align: center;
`;

const NavArrow = styled.button<{ $disabled: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$disabled ? '#444' : '#e6c563'};
  font-size: 2cqw;
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.4 : 1};
  transition: color 0.2s, transform 0.2s;
  pointer-events: ${props => props.$disabled ? 'none' : 'auto'};
  padding: 0 1cqw;

  &:hover {
    color: #fff;
    transform: ${props => props.$disabled ? 'none' : 'scale(1.2)'};
  }
`;


export const GameComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const gameWrapperRef = useRef<HTMLDivElement | null>(null);
  const gridOverlayRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const [isPlayerOutOfFocus, setIsPlayerOutOfFocus] = useState<boolean>(false);
  const [, forceUpdate] = useReducer<number, []>((x) => x + 1, 0);
  const isOutOfFocus = snap.getIsOutOfFocus();
  const backgroundSceneBrightness = snap.getBackgroundSceneBrightness();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();

  // Snapshot coordinates for global Tooltip Manager tracking state
  const tooltip = snap.tooltipManager;

  useEffect(() => {
    rootGameStore.beginIntro();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return; // Ignore gesture handling while modal overlay is open

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

  const handleCloseTooltip = () => {
    rootGameStore.tooltipManager.closeTooltip();
    forceUpdate();
  };

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

  // Destructure out active sub-properties from the snapshot layout matrix
  const hasPages = tooltip.pages && tooltip.pages.length > 0;
  const currentPage = hasPages ? tooltip.pages[tooltip.currentPageIndex] : null;
  const totalPages = hasPages ? tooltip.pages.length : 0;
  const isMultiPage = totalPages > 1;
  
  return (
    <GameWrapper
      ref={gameWrapperRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      $backgroundSceneBrightness={backgroundSceneBrightness}
    >
      <HTMLCanvasComponent gridOverlayRef={gridOverlayRef} />
      {sceneElements}
      {mainUI}

      {/* --- TOP-LEVEL TOOLTIP OVERLAY MODULE --- */}
      {tooltip.active && currentPage && (
        <TooltipOverlay onClick={handleCloseTooltip}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={handleCloseTooltip}>&times;</CloseButton>

            <div style={{ display: 'flex', flexDirection: 'row', gap: '3cqw', width: '100%' }}>
              {/* Text Column - Content is entirely optional per screen setup */}
              {(currentPage.title || currentPage.paragraphs) && (
                <TextColumn>
                  {currentPage.title && <h2>{currentPage.title}</h2>}
                  {currentPage.paragraphs && currentPage.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </TextColumn>
              )}

              {/* Optional/Conditional Media Element column */}
              {currentPage.mediaUrl && (
                <MediaColumn>
                  <img
                    src={currentPage.mediaUrl}
                    alt={currentPage.title ? `${currentPage.title} tutorial graphic` : 'Tutorial graphic'}
                  />
                </MediaColumn>
              )}
            </div>

            {/* Pagination Controls Row Layer Footer */}
            {isMultiPage && (
              <FooterControls>
                <NavArrow
                  $disabled={tooltip.currentPageIndex === 0}
                  onClick={() => {
                    rootGameStore.tooltipManager.prevPage();
                    forceUpdate();
                  }}
                >
                  &#9664;
                </NavArrow>

                <PageIndicator>
                  {tooltip.currentPageIndex + 1} / {totalPages}
                </PageIndicator>

                <NavArrow
                  $disabled={tooltip.currentPageIndex === totalPages - 1}
                  onClick={() => {
                    rootGameStore.tooltipManager.nextPage();
                    forceUpdate();
                  }}
                >
                  &#9654;
                </NavArrow>
              </FooterControls>
            )}
          </ModalContent>
        </TooltipOverlay>
      )}
    </GameWrapper>
  );
}