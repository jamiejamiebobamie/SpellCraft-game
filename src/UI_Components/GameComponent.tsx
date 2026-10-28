import React, { useState, useEffect, useRef, useCallback } from 'react';
import PlayerComponent from './Player/PlayerComponent';
import HTMLCanvasComponent from './HTMLCanvas/HTMLCanvasComponent';
import GameBoardComponent from './GameBoard/GameBoardComponent';
import StarrySkyComponent from './SceneElements/StarrySkyComponent';
import WallElements, { BACKGROUND_IMAGE_BRIGHTNESS } from './SceneElements/WallElements';
import ChandelierComponent from './SceneElements/ChandelierComponent';
import TooltipModalComponent from './TooltipModalComponent';
import LightTipLayer from './LightTipCard';
import LoaderComponent from './LoaderComponent';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { css, keyframes } from 'styled-components';
import { UIFadeIn } from './UIFadeIn';
import { INTRO_WALK_ANIM_TIME } from './Player/CharacterParts';
import GameOverModalComponent from './GameOverModalComponent';
import { CURSOR_MODE, WAND_CURSOR_CSS } from './cursors';
import TurnCard, { RivalWaitingCard } from './TurnCard';
import { useKeyPress } from './UseKeyPress';
import { moveRecorder } from '../DataClasses/Player/MoveRecorder';
import { LanternLight, CaughtStamp, CatchDarkness } from './SceneElements/TeacherCatch';
import DeathDarkness from './SceneElements/DeathDarkness';
import { CATCH_SCENE } from './SceneElements/teacherCatchConfig';
import { PLAY_BUTTON_LOOKS } from './PlayButtonStyles';

/** The hall shaking as a teacher's light floods in (a catch: TeacherCatch.tsx). */
const hallShake = keyframes`
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(-0.4cqw, 0.2cqw); }
  30% { transform: translate(0.35cqw, -0.25cqw); }
  45% { transform: translate(-0.3cqw, -0.15cqw); }
  60% { transform: translate(0.25cqw, 0.2cqw); }
  80% { transform: translate(-0.1cqw, 0.05cqw); }
`;

// NOTE: ensure rnadom moves that trigger blood magic and are guarded / reduced to 1 cell size are drawn correctly...
// NOTE: AI on BRUTAL kills himself often... also does similar opening move (3x3 Ether) every time...

/**
 * The background image's brightness, on top of the scene's lighting: dark (the landing page, and the
 * intro walk until the lights come up; scene lighting 0.1) and lit (once they're up; 0.4). 1 = as is.
 */

/**
 * The game's frame: a band of bevelled brass around its edge, as the Play button's (PlayButtonStyles: the ruby
 * look's frame, lit from above: bright at the top, deep bronze at the bottom), a dark outline outside it, a
 * shade cast inward over the game's edge, and a fine hairline just inside. Sizes in cqw: the band's width,
 * the outline's, the inner shade's spread, and the hairline's width and how far in from the band it sits.
 * brightness: the band's gold (1: as the button's; lower, its sheen toned down).
 */
const GAME_FRAME = {
  isOn: true, width: 0.5, outline: 0.12, innerShade: 0.6, hairline: 0.08, hairlineInset: 0.22, hairlineOpacity: 0.7,
  brightness: 0.8,
};

/** A colour (#rrggbb) at `factor` of its brightness. */
const dimmed = (hex: string, factor: number): string => '#' + [1, 3, 5]
  .map(k => Math.round(Math.min(255, parseInt(hex.slice(k, k + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
const FRAME_GOLD = PLAY_BUTTON_LOOKS.ruby.frame.map(color => dimmed(color, GAME_FRAME.brightness));

const GameFrame = styled.div`
  position: absolute;
  inset: 0;
  z-index: 99990; /* (over everything in the game, its edges) */
  pointer-events: none;
  border: ${GAME_FRAME.width}cqw solid transparent;
  border-image: linear-gradient(180deg, ${FRAME_GOLD[0]} 0%, ${FRAME_GOLD[1]} 35%, ${FRAME_GOLD[2]} 70%, ${FRAME_GOLD[3]} 100%) 1;
  box-shadow: inset 0 0 0 ${GAME_FRAME.outline}cqw ${PLAY_BUTTON_LOOKS.ruby.outline}, inset 0 0 ${GAME_FRAME.innerShade}cqw rgba(0, 0, 0, 0.55);
  &::before {
    content: '';
    position: absolute;
    inset: ${GAME_FRAME.hairlineInset}cqw;
    border: ${GAME_FRAME.hairline}cqw solid ${PLAY_BUTTON_LOOKS.ruby.hairline};
    opacity: ${GAME_FRAME.hairlineOpacity};
  }
`;

const GameWrapper = styled.div<{ $backgroundSceneBrightness: number; $isShaking: boolean }>`
  /* Vertical placement comes from the spacers around #root (index.css) */
  margin: 0 auto;

  ${CURSOR_MODE === 'arrow' ? '' : WAND_CURSOR_CSS}
  display: flex;
  flex-direction: row;
  user-select: none;
  overflow: hidden;
  position: relative;
  ${props => props.$isShaking && css`animation: ${hallShake} 0.55s ease-in-out ${CATCH_SCENE.floodSeconds * 0.75}s 1;`}

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

  /* The frame's dark outline (GAME_FRAME), then layered shadows (tight contact, mid, large soft and lower)
     that make the game look lifted off the page */
  box-shadow:
    ${GAME_FRAME.isOn ? `0 0 0 ${GAME_FRAME.outline}cqw ${PLAY_BUTTON_LOOKS.ruby.outline},` : ''}
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.3),
    0 24px 48px rgba(0, 0, 0, 0.4);

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
    will-change: filter; /* (its own layer from the start: made mid-intro, as its filter began to change, it could show black for a frame) */
    filter: brightness(${props => props.$backgroundSceneBrightness * (props.$backgroundSceneBrightness > rootGameStore.LOW_BRIGHTNESS ? BACKGROUND_IMAGE_BRIGHTNESS.lit : BACKGROUND_IMAGE_BRIGHTNESS.dark)});
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
  const isPlaying = snap.getIsPlaying();
  const isOutOfFocus = snap.getIsOutOfFocus();
  const backgroundSceneBrightness = snap.getBackgroundSceneBrightness();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const isLoreDone = snap.getIsLoreDone();
  const gameOver = snap.getGameOver();

  // (the site metrics: each game's length and result, once it's over)
  useEffect(() => { if (gameOver !== null) rootGameStore.reportGameOver(); }, [gameOver]);

  useEffect(() => {
    if (isPlaying) {
      if (!isLoreDone) {
        // THE STORY (tooltips on, or not chosen yet); its last page asks about tooltips
        rootGameStore.showLore();
      } else if (!isDoneWithIntro) {
        // PLAY
        rootGameStore.beginIntro();
      } else {
        // BEGIN MATCH!
        rootGameStore.noteMatchBegun();
        rootGameStore.triggerTips(['casting', 'spellBook']); // one after the other
        rootGameStore.doClickClockFlash();
        if (rootGameStore.getIsMultiplayer()) rootGameStore.noteMatchReady(); // (the first turn once both are ready)
        else rootGameStore.startNpcTurn(3000);
      }
    }
  }, [isPlaying, isDoneWithIntro, isLoreDone]);

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

  const handleTouchMove = useCallback((e: TouchEvent) => {
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

  const handleTouchDown = useCallback((e: TouchEvent) => {
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

    setIsPlayerOutOfFocus(false);
    if (!rootGameStore.getIsDrawing()) return;
    rootGameStore.endDrawing();
    rootGameStore.runInference({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchUp = useCallback((e: TouchEvent) => {
    if (!rootGameStore.getIsDoneWithIntroWalk()) return;
    if (rootGameStore.tooltipManager.active) return;

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

  // While developing: the ` key plays the catch scene again (Game.previewCatchScene), the 9 key each game over card (previewGameOver), the 0 key the dawn (previewDawn),
  // the 7 key two great Ethers meeting (previewGreatClash), the 6 key a wizard falling (previewDeath)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') rootGameStore.previewCatchScene();
      if (e.code === 'Digit9') rootGameStore.previewGameOver();
      if (e.code === 'Digit8') moveRecorder.download(); // (the player's recorded moves: MoveRecorder)
      if (e.code === 'Digit0') rootGameStore.previewDawn();
      if (e.code === 'Digit7') rootGameStore.previewGreatClash();
      if (e.code === 'Digit6') rootGameStore.previewDeath();
    };
    window.addEventListener('keyup', onKey);
    return () => window.removeEventListener('keyup', onKey);
  }, []);

  // The game's keys (Game.keyActions): none until the intro walk is over
  useKeyPress({ keyActions: rootGameStore.keyActions, isDisabled: !snap.getIsDoneWithIntroWalk() || snap.getIsMatchOver() });

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
    <WallElements sceneBrightness={backgroundSceneBrightness} />
    <LanternLight />
  </>;

  const mainUI = <>
    <PlayerComponent playerIndex={0} mousePosRef={mousePos} isPlayerOutOfFocus={isPlayerOutOfFocus || isOutOfFocus} />
    <MainColumn $isDoneWithIntro={isDoneWithIntro}>
      <GameBoardComponent gridOverlayRef={gridOverlayRef} />
    </MainColumn>
    <TurnCard />
    <RivalWaitingCard />
    <CatchDarkness />
    <DeathDarkness />
    <CaughtStamp />
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
      $isShaking={snap.getCatchScene() !== null}
    >
      <GameOverModalComponent />
      <LoaderComponent />
      <TooltipModalComponent />
      <HTMLCanvasComponent gridOverlayRef={gridOverlayRef} />
      <LightTipLayer />
      {sceneElements}
      {mainUI}
      {GAME_FRAME.isOn && <GameFrame />}
    </GameWrapper>)
};