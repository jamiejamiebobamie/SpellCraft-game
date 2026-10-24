import { useEffect, useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';
import LogoComponent from './Logo/LogoComponent';
import { LOGO_CONFIG } from './Logo/logoConfig';
import { titleLetteringCss, titleSheenSlide } from './Logo/titleLettering';
import HoverSymbols from './HoverSymbols';
import { PIXIE_DUST_SECONDS } from './PixieDust'; // (the dissolve's length; the dust itself no longer shown)
import { PlayButtonFace, PLAY_BUTTON_BRIGHTNESS, getPlayButtonGlow } from './PlayButtonStyles';
import ModeSelectComponent from './ModeSelectComponent';
import CodeLinkComponent from './CodeLinkComponent';
import SymbolSpinner from './SymbolSpinner';
import { HostMatchScreen, JoinMatchScreen } from './MatchScreens';
import { MultiplayerSession } from '../DataClasses/Multiplayer/MultiplayerSession';

/** How wide one sweep of "Loading..."'s sheen is (cqw): about the word's width. */
const LOADING_SHEEN_TILE = 16;

const twinkleSparkle = keyframes`
  0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(90deg); opacity: 1; }
`;

/** Raises the Play button and "Loading..." toward the logo (visually only, so the logo doesn't move: its clock lines up with the scene's). */
const PLAY_BUTTON_RAISE = '4.5cqw'; // (was 2.4cqw: up so the title's "p" dips into the space beside the button, a gap still between them)

/** The Play button and "Loading..." (and their slot), relative to their original size: kept smaller than the logo's title. */
const PLAY_BUTTON_SCALE = 0.7;
const playSize = (cqw: number) => `${cqw * PLAY_BUTTON_SCALE}cqw`;

// --- Layout Structures ---

const LoadingOverlay = styled.div<{ $isSceneImgsLoaded: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4cqw;
  box-sizing: border-box;
  z-index: 9999;
  ${props => props.$isSceneImgsLoaded ? 'background: rgba(0, 0, 0, 0);' : 'background: rgba(0, 0, 0, 1);'}
  transition: background 5s;  
`;

/** While the multiplayer service is checked (after Play): the spinner, in the middle. */
const CheckingSpinner = styled.div`
  position: absolute;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
`;

/**
 * The screens after the landing (Choose Your Duel, the invite, joining): overlapAt, how far into the
 * landing's dissolve they begin fading in (a share of it: crossfading); leaveSeconds, their own dissolve
 * once the match begins (1 Player, Begin, or joined), as the landing's.
 */
export const SCREEN_TRANSITIONS = { overlapAt: 0.35, leaveSeconds: 0.7 };

const ScreenLayer = styled.div<{ $isLeaving: boolean }>`
  position: absolute;
  inset: 0;
  transition: opacity ${SCREEN_TRANSITIONS.leaveSeconds}s ease-in, filter ${SCREEN_TRANSITIONS.leaveSeconds}s ease-in, transform ${SCREEN_TRANSITIONS.leaveSeconds}s ease-out;
  ${props => props.$isLeaving && 'opacity: 0; filter: blur(0.5cqw); transform: translateY(-1.5cqw) scale(1.03); pointer-events: none;'}
`;

/** The landing content and its pixie dust (the content dissolving into it as Play is pressed). */
const DissolveArea = styled.div`
  position: relative;
  width: 80%;
  max-width: 800px;
  display: flex;
  justify-content: center;
`;

const LoadingContent = styled.div<{ $isDissolving: boolean }>`
  /* dissolving: fading, blurring and lifting away as the pixie dust rises from it */
  opacity: ${props => props.$isDissolving ? 0 : 1};
  filter: ${props => props.$isDissolving ? 'blur(0.5cqw)' : 'blur(0)'};
  transform: ${props => props.$isDissolving ? 'translateY(-1.5cqw) scale(1.03)' : 'none'};
  transition: opacity ${PIXIE_DUST_SECONDS * 0.75}s ease-in, filter ${PIXIE_DUST_SECONDS * 0.75}s ease-in, transform ${PIXIE_DUST_SECONDS}s ease-out;
  padding: 3cqw;
  width: 100%;
  position: relative;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: column;
  gap: 3cqw;
`;

/** The logo's slot: it appears once its images (the priority assets) have loaded. */
const Logo = styled.div`
  width: 58cqw;
  position: relative;
  aspect-ratio: 100 / ${LOGO_CONFIG.height};
`;

const ActionSlot = styled.div`
  width: 80%;
  max-width: 800px;
  height: ${playSize(11)};
  transform: translateY(-${PLAY_BUTTON_RAISE});
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SparkleContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
`;

const GlitterStar = styled.div<{ $top: string; $left: string; $size: string; $delay: string }>`
  position: absolute;
  top: ${props => props.$top};
  left: ${props => props.$left};
  width: ${props => props.$size};
  height: ${props => props.$size};
  /* Same golds as the "Loading..." text */
  background: radial-gradient(circle, #fffbe0 0%, #ffe875 35%, #ffd700 70%, #ffa500 100%);
  clip-path: polygon(50% 0%, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0% 50%, 39% 35%);
  box-shadow: 0 0 10px #ffe875, 0 0 20px #ffa500;
  animation: ${twinkleSparkle} 2.5s ease-in-out infinite;
  animation-delay: ${props => props.$delay};
`;

const Loader = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  justify-content: center;
  align-items: center;
  display: flex;

  font-family: 'EnchantedLand', sans-serif;
  font-size: ${playSize(5.5)};
  line-height: 1;

  /* In the "SpellCraft" title's lettering, its sheen sliding across */
  ${titleLetteringCss({ strokeCqw: 0.05, glowCqw: 0.5, slide: { tileCqw: LOADING_SHEEN_TILE } })}
  animation: ${titleSheenSlide(LOADING_SHEEN_TILE)} 3s linear infinite;
`;

/** The Play button: the ruby (PlayButtonStyles). */
const FramedPlayButton = styled.button<{ $glow: string }>`
  position: relative;
  cursor: pointer;
  border: none;
  outline: none;
  background: transparent;
  width: ${playSize(34)};
  height: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${playSize(5)};
  line-height: 1;
  user-select: none;
  z-index: 10;
  filter: brightness(${PLAY_BUTTON_BRIGHTNESS.rest});
  transition: filter 0.2s ease;

  &:hover {
    filter: brightness(${PLAY_BUTTON_BRIGHTNESS.hover}) drop-shadow(0 0 ${playSize(1.2)} ${props => props.$glow});
    .panel { filter: brightness(1.25); }
  }
  &:active {
    .inner { transform: translateY(2px); }
    .label { transform: translateY(${playSize(0.15)}); }
  }
`;

// --- Component Wrapper Pipeline ---

const LoaderComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isLoading = snap.getIsLoading();
  const isPlaying = snap.getIsPlaying(); 
  const isDisplay = isLoading || !isPlaying;
  const isSceneImgsLoaded = snap.getIsSceneImgsLoaded();
  const isFontLoaded = snap.getIsFontLoaded();
  const isPriorityAssetsLoaded = snap.getIsPriorityAssetsLoaded();
  // (the logo's spells are drawn behind the boot screen first: LogoComponent, AssetLoader)
  const isLogoSpellsReady = snap.getIsLogoSpellsReady();

  // The boot screen (index.html: the title and a spinner) fades out as the logo fades in, once the
  // logo's spells are ready
  useEffect(() => {
    const bootScreen = document.getElementById('boot-screen');
    if (!isPriorityAssetsLoaded || !isLogoSpellsReady || !bootScreen) return;
    bootScreen.classList.add('boot-screen--done');
    const removeTimeout = setTimeout(() => bootScreen.remove(), 1600); // (its fade through black: index.html)
    return () => clearTimeout(removeTimeout);
  }, [isPriorityAssetsLoaded, isLogoSpellsReady]);

  // Play: the landing page dissolves into pixie dust, then the choice of 1 Player or 2 Players. Opened
  // from an invite link, Play reads "Join", and joins the host's match instead
  const [joinId, setJoinId] = useState<string | null>(() => MultiplayerSession.getJoinIdFromUrl());
  const [isDissolving, setIsDissolving] = useState<boolean>(false);
  const [screen, setScreen] = useState<'landing' | 'checking' | 'mode' | 'host' | 'join'>('landing');
  const dissolveAndPlay = () => {
    if (isDissolving) return;
    setIsDissolving(true);
    // (the multiplayer service is checked meanwhile: if it's down, the game goes straight to 1 Player)
    const isServiceUp = joinId ? Promise.resolve(true) : MultiplayerSession.checkService();
    // (the next screen fading in while the landing is still dissolving: SCREEN_TRANSITIONS.overlapAt)
    window.setTimeout(async () => {
      if (joinId) { setScreen('join'); return; }
      setScreen('checking'); // (a spinner, if the answer isn't in yet)
      if (await isServiceUp) setScreen('mode');
      else window.setTimeout(() => rootGameStore.startGame(), PIXIE_DUST_SECONDS * (1 - SCREEN_TRANSITIONS.overlapAt) * 1000);
    }, PIXIE_DUST_SECONDS * SCREEN_TRANSITIONS.overlapAt * 1000);
  };
  const playAlone = () => { setJoinId(null); setScreen('mode'); };
  // The match beginning: the screen dissolves away first (SCREEN_TRANSITIONS.leaveSeconds)
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const leaveThen = (begin: () => void) => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(begin, SCREEN_TRANSITIONS.leaveSeconds * 1000);
  };

  // Hovering: the symbols around the button
  const [hoverKey, setHoverKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseEnter = () => {
    setHoverKey(prev => prev + 1);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    isDisplay && <LoadingOverlay $isSceneImgsLoaded={isSceneImgsLoaded}>
      <DissolveArea>
      <LoadingContent $isDissolving={isDissolving}>
        <Logo>{isPriorityAssetsLoaded && <LogoComponent isShown={isLogoSpellsReady} onSpellsReady={() => rootGameStore.setIsLogoSpellsReady()} />}</Logo>
        <ActionSlot>
          {isLoading ? (
            <Loader>
              <SparkleContainer>
                <GlitterStar $top="-2cqw" $left="15%" $size="1.8cqw" $delay="0s" />
                <GlitterStar $top="4cqw" $left="25%" $size="1.2cqw" $delay="-0.6s" />
                <GlitterStar $top="-1cqw" $left="48%" $size="2.2cqw" $delay="-1.2s" />
                <GlitterStar $top="5cqw" $left="65%" $size="1.4cqw" $delay="-0.3s" />
                <GlitterStar $top="-2cqw" $left="82%" $size="1.9cqw" $delay="-1.8s" />
                <GlitterStar $top="3cqw" $left="90%" $size="1.3cqw" $delay="-0.9s" />
              </SparkleContainer>
              {isFontLoaded? 'Loading...' : ''}
            </Loader>
          ) : (
            <FramedPlayButton
              $glow={getPlayButtonGlow('ruby')}
              onClick={dissolveAndPlay}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <PlayButtonFace look="ruby" label={joinId ? 'Join' : 'Play'} isGlinting={isHovered} />
              <HoverSymbols isHovered={isHovered} hoverKey={hoverKey} />
            </FramedPlayButton>
          )}
        </ActionSlot>
        
      </LoadingContent>
      </DissolveArea>
      {/* (on the landing page only: it fades as Play is pressed) */}
      {screen === 'landing' && !isLoading && (
        <CodeLinkComponent isHidden={isDissolving} />
      )}
      {screen !== 'landing' && (
        <ScreenLayer $isLeaving={isLeaving}>
          {screen === 'checking' && <CheckingSpinner><SymbolSpinner size={4.2} /></CheckingSpinner>}
          {screen === 'mode' && <ModeSelectComponent onSinglePlayer={() => leaveThen(() => rootGameStore.startGame())} onTwoPlayers={() => setScreen('host')} />}
          {screen === 'host' && <HostMatchScreen onBegin={session => leaveThen(() => rootGameStore.startHostedMatch(session))} onBack={() => setScreen('mode')} />}
          {screen === 'join' && joinId && <JoinMatchScreen hostId={joinId} onJoined={session => leaveThen(() => rootGameStore.startJoinedMatch(session))} onPlayAlone={playAlone} />}
        </ScreenLayer>
      )}
    </LoadingOverlay>
  )
};

export default LoaderComponent;
