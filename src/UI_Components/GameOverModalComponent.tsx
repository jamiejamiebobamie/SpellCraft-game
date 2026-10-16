import React, { useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';
import { GameOverStatus } from '../DataClasses/types'; // Update paths based on your actual structure

// --- Inherited Animation Keyframes ---
const specularReflection = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
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

// --- Configuration Content Maps ---
interface ModalTextConfig {
  title: string;
  text: string;
  fontSize: number;
}

// Assuming your 4th state "Caught by Teacher" maps to a status key or string fallback
const MODAL_CONTENT_MAP: Record<string, ModalTextConfig> = {
  [GameOverStatus.BothDead]: {
    title: 'A Draw',
    text: "The match ends in a draw!",
    fontSize: 4.5
  },
  [GameOverStatus.PlayerWon]: {
    title: 'You Won',
    text: 'You won ...this night.',
    fontSize: 4.5
  },
  [GameOverStatus.NpcWon]: {
    title: 'You Lost',
    text: 'You lost...',
    fontSize: 4.5
  },
  [GameOverStatus.TimesUp]: {
    title: 'Caught!',
    text: 'You have been caught out of bed after curfew and will surely be expelled.',
    fontSize: 3.7
  },
};

// --- Styled Component Architectures ---

// Fiddle with the \$bgOpacity parameter inside your wrapper implementation to adjust view shading
const ModalDimOverlay = styled.div<{ $bgOpacity: number }>`
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
  z-index: 10000; /* Layered slightly over your LoadingOverlay (9999) */
  background: rgba(0, 0, 0, ${props => props.$bgOpacity});
  backdrop-filter: blur(2px);
  transition: background 0.3s ease;
`;

const ModalCardContent = styled.div`
  padding: 4cqw;
  width: 85%;
  position: relative;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: column;
  gap: 3cqw;
  text-align: center;
`;

// Reused Loader text specifications for your centered Modal Title
const ModalTitle = styled.h2`
  width: 100%;
  margin: 0;
  padding: 0;
  text-align: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 11cqw;
  line-height: 1.1;

  margin-bottom: 1cqw;
  
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

const ModalSubText = styled.p<{ $fontSize: number }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$fontSize}cqw;
  color: rgb(187 36 36);
  max-width: 90%;
  margin: 0 auto; 
  text-shadow: 0cqw 0.3cqw 0.5cqw rgba(0, 0, 0, 0.9);
  line-height: 1.3;
  text-align: center;
`;

const ModalSubTextContainer = styled.div`
   display: flex;
    flex-flow: column wrap;
    justify-content: center;
    align-items: center;
    width: 100%;
    text-align: center;
`;

const ButtonRow = styled.div`
  width: 80%;
  max-width: 600px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6cqw;
  margin-top: 2cqw;
`;

// --- Shared Core Shape Sub-Layouts ---
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

// Reused Magical Play Button Core shape configurations
const MagicalModalButton = styled.button`
  position: relative;
  cursor: pointer;
  border: none;
  outline: none;
  background: transparent;
  width: 26cqw;
  height: 8cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 4.5cqw;
  line-height: 1;

  color: rgb(197 250 255);
  text-shadow: rgba(255, 255, 255, 0.8) 0px 0cqw 1cqw;
  user-select: none;
  z-index: 10;
  transition: filter 0.2s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg, #745c22 0%, rgb(255 226 141) 70%, #513f13 100%);
    clip-path: polygon(0% 50%, 14% 0%, 86% 0%, 100% 50%, 85% 6cqw, 15% 6cqw);
    box-shadow: 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.5);
    z-index: -2;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0.3cqw; left: 0.7cqw; right: 0.7cqw; bottom: 0.3cqw;
    
    background-color: rgb(1 52 72);
    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.1) 45%, transparent 50%);
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

  &:hover {
    color: #fffdf0;
    filter: drop-shadow(0 0 1cqw rgba(0, 164, 228, 0.7));
    
    &::after {
      background-color: #00b4f0;
      transform: translateY(0.18cqw) scale(0.985);
      box-shadow: 
        inset 0 0.5cqw 0.8cqw rgba(0, 0, 0, 0.85),
        inset 0 -0.2cqw 0.4cqw rgba(255, 255, 255, 0.2);
    }
  }

  &:active {
    &::after {
      transform: translateY(0.3cqw) scale(0.96);
    }
  }
`;

// --- Component Definition ---
interface ActionButtonProps {
  label: string;
  onClick: () => void;
}

const ModalButtonWithWisps: React.FC<ActionButtonProps> = ({ label, onClick }) => {
  const [hoverKey, setHoverKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  return (
    <MagicalModalButton
      onClick={onClick}
      onMouseEnter={() => { setHoverKey(prev => prev + 1); setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <VineUnderlay />
      {isHovered && (
        <WispContainer key={hoverKey}>
          <SingleBurstWisp $left="15%" $anim={scatterWispLeft} />
          <SingleBurstWisp $left="38%" $anim={scatterWispCenter} />
          <SingleBurstWisp $left="52%" $anim={scatterWispLeft} />
          <SingleBurstWisp $left="66%" $anim={scatterWispRight} />
          <SingleBurstWisp $left="82%" $anim={scatterWispCenter} />
        </WispContainer>
      )}
      {label}
    </MagicalModalButton>
  );
};

export const GameOverModalComponent: React.FC = () => {
  const snap = useSnapshot(rootGameStore);

  const currentGameOverState = snap.getGameOver();
  if (currentGameOverState === null) return null;

  const contentConfig = MODAL_CONTENT_MAP[currentGameOverState];

  return (
    <ModalDimOverlay $bgOpacity={0.65}>
      <ModalCardContent>
        <ModalTitle>{contentConfig.title}</ModalTitle>
        <ModalSubTextContainer>
          <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
          <ModalSubText $fontSize={contentConfig.fontSize}>Play again?</ModalSubText>
        </ModalSubTextContainer>
        <ButtonRow>
          <ModalButtonWithWisps label="Yes" onClick={rootGameStore.resetGame} />
          <ModalButtonWithWisps label="No" onClick={() => window.open('https://github.com/jamiejamiebobamie/QuickCast', '_blank', 'noopener,noreferrer')} />
        </ButtonRow>
      </ModalCardContent>
    </ModalDimOverlay>
  );
};

export default GameOverModalComponent;
