import React, { useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';

const specularReflection = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

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

// --- Layout Structures ---

const LoadingOverlay = styled.div`
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
  z-index: 9999;
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

const Logo = styled.div`
  padding: 3cqw;
  width: 80%;
  position: relative;
  height: 30cqw;
  background-color: red;
  opacity: .5;
`;

// Fixed Height Anchor Slot preventing layout jitter
const ActionSlot = styled.div`
  width: 80%;
  max-width: 800px;
  height: 11cqw;
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
  background: #fff;
  clip-path: polygon(50% 0%, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0% 50%, 39% 35%);
  box-shadow: 0 0 10px #fffdf0, 0 0 20px #ffd700;
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
  font-size: 5.5cqw;
  line-height: 1;
  
  background: linear-gradient(
    90deg, 
    #ffd700 0%, 
    #ffe875 25%, 
    #ffffff 45%, 
    #ffffff 55%, 
    #ffe875 75%, 
    #ffa500 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${specularReflection} 3.5s linear infinite;

  filter: drop-shadow(0.3cqw 0.3cqw 0px #1e1202) 
          drop-shadow(-0.3cqw -0.3cqw 0px #1e1202)
          drop-shadow(0.3cqw -0.3cqw 0px #1e1202)
          drop-shadow(-0.3cqw 0.3cqw 0px #1e1202);
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

// Split bottom vine layer completing the weave logic
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
  width: 44cqw; /* Formatted to drop perfectly into the exact dimension scale */
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 5cqw;
  line-height: 1;
  color: #ffffff;
  text-shadow: 0px 0.2cqw 0.4cqw rgba(0, 0, 0, 0.8);
  user-select: none;
  z-index: 10;
  transition: filter 0.2s ease;

  /* Part A: Top Vine Reed weaving over at the edges */
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg, #745c22 0%, #bda251 70%, #513f13 100%);
    clip-path: polygon(0% 50%, 14% 0%, 86% 0%, 100% 50%, 85% 6cqw, 15% 6cqw);
    box-shadow: 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.5);
    z-index: -2;
  }

  /* Core Interactive Plate: Deep World of Warcraft Vivid Mana Blue + Specular Glass Gloss Overlay */
  &::after {
    content: '';
    position: absolute;
    top: 0.3cqw; left: 0.7cqw; right: 0.7cqw; bottom: 0.3cqw;
    
    /* Vivid Blue Base + Dark Inward Ornate Runes + High Gloss Specular Ceiling Cap */
    background-color: #00a4e4; 
    background-image: 
      linear-gradient(to bottom, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.1) 45%, transparent 50%),
      radial-gradient(circle at 15% 35%, transparent 36%, #051923 40%, transparent 46%),
      radial-gradient(circle at 85% 65%, transparent 36%, #051923 40%, transparent 46%);
    background-size: 100% 100%;
    background-repeat: no-repeat;
    
    clip-path: polygon(0% 50%, 13% 0%, 87% 0%, 100% 50%, 87% 100%, 13% 100%);
    box-shadow: 
      inset 0 0.3cqw 0.5cqw rgba(255, 255, 255, 0.6), 
      inset 0 -0.4cqw 0.8cqw #003554,
      0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.5);
    z-index: -1;
    transform: translateY(0);
    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  /* Hover Actions: Fluid tactical recession slide shift mechanism */
  &:hover {
    color: #fffdf0;
    filter: drop-shadow(0 0 1cqw rgba(0, 164, 228, 0.7));
    
    &::after {
      background-color: #00b4f0; /* Intense active WoW highlight surge */
      transform: translateY(0.18cqw) scale(0.985);
      box-shadow: 
        inset 0 0.5cqw 0.8cqw rgba(0, 0, 0, 0.85),
        inset 0 -0.2cqw 0.4cqw rgba(255, 255, 255, 0.2);
    }
  }

  /* Mouse compress interaction vectors */
  &:active {
    &::after {
      transform: translateY(0.3cqw) scale(0.96);
    }
  }
`;

// --- Component Wrapper Pipeline ---

const LoaderComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isLoading = snap.getIsLoading();
  const isPlaying = snap.getIsLoading(); 
  const isDisplay = isLoading || !isPlaying;

  // Dynamic state loop key triggering fresh wisp cycles on every re-hover
  const [hoverKey, setHoverKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handlePlayClick = () => {
    // if (typeof rootGameStore.startGame === 'function') {
    //   rootGameStore.startGame();
    // }
  };

  const handleMouseEnter = () => {
    setHoverKey(prev => prev + 1);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    isDisplay && <LoadingOverlay>
      <LoadingContent>
        <Logo />
        
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
              Loading...
            </Loader>
          ) : (
            <MagicalPlayButton 
              onClick={handlePlayClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <VineUnderlay />
              {/* Unique layout tracking identity mounting fresh firefly vectors cleanly every single cycle */}
              {isHovered && (
                <WispContainer key={hoverKey}>
                  <SingleBurstWisp $left="15%" $anim={scatterWispLeft} />
                  <SingleBurstWisp $left="38%" $anim={scatterWispCenter} />
                  <SingleBurstWisp $left="52%" $anim={scatterWispLeft} />
                  <SingleBurstWisp $left="66%" $anim={scatterWispRight} />
                  <SingleBurstWisp $left="82%" $anim={scatterWispCenter} />
                </WispContainer>
              )}
              Play
            </MagicalPlayButton>
          )}
        </ActionSlot>
        
      </LoadingContent>
    </LoadingOverlay>
  )
};

export default LoaderComponent;
