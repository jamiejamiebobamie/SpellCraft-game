import React, { useEffect, useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';
import LogoComponent from './Logo/LogoComponent';
import { LOGO_CONFIG } from './Logo/logoConfig';
import { titleLetteringCss, titleSheenSlide } from './Logo/titleLettering';

/** How wide one sweep of "Loading..."'s sheen is (cqw): about the word's width. */
const LOADING_SHEEN_TILE = 16;
import { PlayButtonFace, PlayButtonLook, PLAY_BUTTON_LOOKS, PLAY_BUTTON_BRIGHTNESS, getPlayButtonGlow } from './PlayButtonStyles';

/**
 * Trying out the Play button's looks (PlayButtonStyles): while on, clicking it switches look and
 * Shift+click plays (a caption below says which look it is). Off: the first look in the list, and a
 * click plays. 'original' is the button as it was.
 */
const PLAY_BUTTON_TRYOUT = { isOn: true, looks: ['ruby', 'brass', 'verdigris', 'original'] as Array<PlayButtonLook | 'original'> };

const twinkleSparkle = keyframes`
  0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(90deg); opacity: 1; }
`;

const scatterWispLeft = keyframes`
  0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(-6cqw, -14cqw) scale(1.2); opacity: 0; }
`;

const scatterWispCenter = keyframes`
  0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translate(1cqw, -18cqw) scale(0.9); opacity: 0; }
`;

const scatterWispRight = keyframes`
  0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(7cqw, -15cqw) scale(1.3); opacity: 0; }
`;

/** Raises the Play button and "Loading..." toward the logo (visually only, so the logo doesn't move: its clock lines up with the scene's). */
const PLAY_BUTTON_RAISE = '2.4cqw'; // (was 3cqw)

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

const LoadingContent = styled.div`
  padding: 3cqw;
  width: 80%;
  max-width: 800px;
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

// --- Advanced Art Nouveau & WoW Blue Button ---

const WispContainer = styled.div`
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 5;
`;

const SingleBurstWisp = styled.div<{ $left: string; $anim: any }>`
  position: absolute;
  bottom: 30%;
  left: ${props => props.$left};
  width: 0.7cqw;
  height: 0.7cqw;
  background: #fff59d;
  border-radius: 50%;
  box-shadow: 0 0 6px #ffeb3b, 0 0 12px #f57f17;
  animation: ${props => props.$anim} 2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  animation-iteration-count: 1;
`;

const VineUnderlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(0deg, #513f13 0%, #bda251 70%, #8d7331 100%);
  clip-path: polygon(0% 50%, 14% 100%, 86% 100%, 100% 50%, 85% 94%, 15% 94%);
  z-index: -2;
`;

const MagicalPlayButton = styled.button`
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

  color: rgb(197 250 255);
  text-shadow: rgba(255, 255, 255, 0.8) 0px ${playSize(0)} ${playSize(1)};
  user-select: none;
  z-index: 10;
  transition: filter 0.2s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg, #745c22 0%, rgb(255 226 141) 70%, #513f13 100%);
    clip-path: polygon(0% 50%, 14% 0%, 86% 0%, 100% 50%, 85% ${playSize(6)}, 15% ${playSize(6)});
    box-shadow: 0 ${playSize(0.3)} ${playSize(0.6)} rgba(0, 0, 0, 0.5);
    z-index: -2;
  }

  &::after {
    content: '';
    position: absolute;
    top: ${playSize(0.3)}; left: ${playSize(0.7)}; right: ${playSize(0.7)}; bottom: ${playSize(0.3)};
    
    background-color: rgb(1 52 72);
    background-image: 
      linear-gradient(to bottom, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.1) 45%, transparent 50%);
      // ,
      // radial-gradient(circle at 15% 35%, transparent 36%, #051923 40%, transparent 46%),
      // radial-gradient(circle at 85% 65%, transparent 36%, #051923 40%, transparent 46%);
    background-size: 100% 100%;
    background-repeat: no-repeat;
    
    clip-path: polygon(0% 50%, 13% 0%, 87% 0%, 100% 50%, 87% 100%, 13% 100%);
    box-shadow: 
      inset 0 ${playSize(0.3)} ${playSize(0.5)} rgba(255, 255, 255, 0.6), 
      inset 0 -${playSize(0.4)} ${playSize(0.8)} #003554,
      0 ${playSize(0.2)} ${playSize(0.4)} rgba(0, 0, 0, 0.5);
    z-index: -1;
    transform: translateY(0);
    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  /* Hover Actions: Fluid tactical recession slide shift mechanism */
  &:hover {
    color: #fffdf0;
    filter: drop-shadow(0 0 ${playSize(1)} rgba(0, 164, 228, 0.7));
    
    &::after {
      background-color: #00b4f0; /* Intense active WoW highlight surge */
      transform: translateY(${playSize(0.18)}) scale(0.985);
      box-shadow: 
        inset 0 ${playSize(0.5)} ${playSize(0.8)} rgba(0, 0, 0, 0.85),
        inset 0 -${playSize(0.2)} ${playSize(0.4)} rgba(255, 255, 255, 0.2);
    }
  }

  /* Mouse compress interaction vectors */
  &:active {
    &::after {
      transform: translateY(${playSize(0.3)}) scale(0.96);
    }
  }
`;


/** The Play button in one of PlayButtonStyles' looks: the same size and place as MagicalPlayButton. */
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

/** Under the button while trying out looks: which one it is, and how to switch or play. */
const TryoutCaption = styled.div`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 1.3cqw;
  color: #f0d98a;
  text-shadow: 0 0 0.3cqw #000, 0 0 0.6cqw #000;
  pointer-events: none;
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

  // The boot screen (index.html: the title and a spinner) fades out as the logo fades in
  useEffect(() => {
    const bootScreen = document.getElementById('boot-screen');
    if (!isPriorityAssetsLoaded || !bootScreen) return;
    bootScreen.classList.add('boot-screen--done');
    const removeTimeout = setTimeout(() => bootScreen.remove(), 1000);
    return () => clearTimeout(removeTimeout);
  }, [isPriorityAssetsLoaded]);

  // Dynamic state loop key triggering fresh wisp cycles on every re-hover
  const [hoverKey, setHoverKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseEnter = () => {
    setHoverKey(prev => prev + 1);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Trying out the button's looks (PLAY_BUTTON_TRYOUT)
  const [lookIndex, setLookIndex] = useState<number>(0);
  const look = PLAY_BUTTON_TRYOUT.looks[lookIndex % PLAY_BUTTON_TRYOUT.looks.length];
  const onPlayClick = (event: React.MouseEvent) => {
    if (PLAY_BUTTON_TRYOUT.isOn && !event.shiftKey) { setLookIndex(k => k + 1); return; }
    rootGameStore.startGame();
  };
  const wisps = isHovered && (
    <WispContainer key={hoverKey}>
      <SingleBurstWisp $left="15%" $anim={scatterWispLeft} />
      <SingleBurstWisp $left="38%" $anim={scatterWispCenter} />
      <SingleBurstWisp $left="52%" $anim={scatterWispLeft} />
      <SingleBurstWisp $left="66%" $anim={scatterWispRight} />
      <SingleBurstWisp $left="82%" $anim={scatterWispCenter} />
    </WispContainer>
  );
  const caption = PLAY_BUTTON_TRYOUT.isOn && (
    <TryoutCaption>
      {look === 'original' ? 'Original' : PLAY_BUTTON_LOOKS[look].name} ({lookIndex % PLAY_BUTTON_TRYOUT.looks.length + 1}/{PLAY_BUTTON_TRYOUT.looks.length}): click to switch, Shift+click to play
    </TryoutCaption>
  );

  return (
    isDisplay && <LoadingOverlay $isSceneImgsLoaded={isSceneImgsLoaded}>
      <LoadingContent>
        <Logo>{isPriorityAssetsLoaded && <LogoComponent />}</Logo>
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
            look === 'original' ? (
              <MagicalPlayButton
                onClick={onPlayClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <VineUnderlay />
                {wisps}
                Play
                {caption}
              </MagicalPlayButton>
            ) : (
              <FramedPlayButton
                $glow={getPlayButtonGlow(look)}
                onClick={onPlayClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <PlayButtonFace look={look} label="Play" />
                {wisps}
                {caption}
              </FramedPlayButton>
            )
          )}
        </ActionSlot>
        
      </LoadingContent>
    </LoadingOverlay>
  )
};

export default LoaderComponent;
