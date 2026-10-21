import React, { useEffect, useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { keyframes } from 'styled-components';
import { GameOverStatus } from '../DataClasses/types'; // Update paths based on your actual structure
import { titleLetteringCss } from './Logo/titleLettering';
import { PlayButtonFace, PLAY_BUTTON_BRIGHTNESS, getPlayButtonGlow } from './PlayButtonStyles';

// --- Inherited Animation Keyframes ---
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
// (fontSize, cqw: each line on one line)
const MODAL_CONTENT_MAP: Record<string, ModalTextConfig> = {
  [GameOverStatus.BothDead]: {
    title: 'A Draw',
    text: "The match ends in a draw!",
    fontSize: 2.8
  },
  [GameOverStatus.PlayerWon]: {
    title: 'You Won',
    text: 'You won ...this night.',
    fontSize: 2.8
  },
  [GameOverStatus.NpcWon]: {
    title: 'You Lost',
    text: 'You lost...',
    fontSize: 2.8
  },
  [GameOverStatus.TimesUp]: {
    title: 'Caught!',
    text: 'You have been caught out of bed after curfew and will surely be expelled.',
    fontSize: 2.4
  },
};

/** "Play again?", under each ending's line (cqw). */
const PLAY_AGAIN_FONT_SIZE = 2.6;

/**
 * Reviewing the endings: open the game with ?gameOverPreview in the address to show this modal with a
 * switcher (or the left and right arrow keys) going through each ending.
 */
const PREVIEW_ORDER = [GameOverStatus.PlayerWon, GameOverStatus.NpcWon, GameOverStatus.BothDead, GameOverStatus.TimesUp];
const getIsPreview = (): boolean => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gameOverPreview');

const MIN_OPACITY = 0, MAX_OPACITY = .65, TRANSITION_TIME_SEC = 1.5;

// --- Styled Component Architectures ---

// Fiddle with the \$bgOpacity parameter inside your wrapper implementation to adjust view shading
const ModalDimOverlay = styled.div<{ $isDisplay: boolean; $bgOpacity: number }>`
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 4cqw;
  box-sizing: border-box;
  z-index: 10000; /* Layered slightly over your LoadingOverlay (9999) */

  opacity: ${props => props.$isDisplay ? 1 : 0};
  pointer-events: ${props => props.$isDisplay ? 'auto' : 'none'};
  
  background: rgba(0, 0, 0, ${props => props.$bgOpacity});
  backdrop-filter: blur(2px);
  
  transition: opacity 0.5s ease, background 0.5s ease;
  transition-delay: ${props => props.$isDisplay ? `${TRANSITION_TIME_SEC}s` : '0s'};
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
  font-size: 15cqw;
  line-height: 1.1;

  margin-bottom: 1cqw;
  
  /* In the "SpellCraft" title's lettering (still) */
  ${titleLetteringCss({ strokeCqw: 0.1, glowCqw: 0.8 })}
`;

const ModalSubText = styled.p<{ $fontSize: number }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$fontSize}cqw;
  color: #efe0b9; /* vellum */
  white-space: nowrap; /* one line */
  margin: 0 auto;
  text-shadow: 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.9), 0 0 0.8cqw rgba(0, 0, 0, 0.7);
  line-height: 1.4;
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

/** The ruby button (PlayButtonStyles), as on the landing screen. */
const RubyModalButton = styled.button<{ $glow: string }>`
  position: relative;
  cursor: pointer;
  border: none;
  outline: none;
  background: transparent;
  width: 24cqw;
  height: ${24 * 100 / 386}cqw; /* the button's shape (386 x 100) */
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 4cqw;
  line-height: 1;
  user-select: none;
  z-index: 10;
  filter: brightness(${PLAY_BUTTON_BRIGHTNESS.rest});
  transition: filter 0.2s ease;

  &:hover {
    filter: brightness(${PLAY_BUTTON_BRIGHTNESS.hover}) drop-shadow(0 0 1.2cqw ${props => props.$glow});
    .panel { filter: brightness(1.25); }
  }
  &:active {
    .inner { transform: translateY(2px); }
  }
`;

/** Steps through the endings while reviewing them (?gameOverPreview). */
const PreviewSwitcher = styled.div`
  position: absolute;
  top: 1.5cqw;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1cqw;
  align-items: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 1.6cqw;
  color: #efe0b9;
  z-index: 1;
  button {
    font: inherit;
    color: inherit;
    background: rgba(0, 0, 0, 0.5);
    border: 0.1cqw solid #9a7432;
    border-radius: 0.4cqw;
    padding: 0.2cqw 0.9cqw;
    cursor: pointer;
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
    <RubyModalButton
      $glow={getPlayButtonGlow('ruby')}
      onClick={onClick}
      onMouseEnter={() => { setHoverKey(prev => prev + 1); setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PlayButtonFace look="ruby" label={label} />
      {isHovered && (
        <WispContainer key={hoverKey}>
          <SingleBurstWisp $left="15%" $anim={scatterWispLeft} />
          <SingleBurstWisp $left="38%" $anim={scatterWispCenter} />
          <SingleBurstWisp $left="52%" $anim={scatterWispLeft} />
          <SingleBurstWisp $left="66%" $anim={scatterWispRight} />
          <SingleBurstWisp $left="82%" $anim={scatterWispCenter} />
        </WispContainer>
      )}
    </RubyModalButton>
  );
};

export const GameOverModalComponent: React.FC = () => {
  const snap = useSnapshot(rootGameStore);
  // Reviewing the endings (?gameOverPreview): one at a time, by the switcher or the arrow keys
  const [isPreview] = useState(getIsPreview);
  const [previewIndex, setPreviewIndex] = useState(0);
  const step = (by: number) => setPreviewIndex(k => (k + by + PREVIEW_ORDER.length) % PREVIEW_ORDER.length);
  useEffect(() => {
    if (!isPreview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') step(1); if (event.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPreview]);
  const currentGameOverState = isPreview ? PREVIEW_ORDER[previewIndex] : snap.getGameOver();
  // (compared with null: a draw, GameOverStatus.BothDead, is 0)
  const isGameOver = currentGameOverState !== null;
  const contentConfig = isGameOver ? MODAL_CONTENT_MAP[currentGameOverState] : { title: '', fontSize: 0, text: '' };

  return (
    <ModalDimOverlay $isDisplay={isGameOver} $bgOpacity={isGameOver ? MAX_OPACITY : MIN_OPACITY}>
      {isPreview && (
        <PreviewSwitcher>
          <button onClick={() => step(-1)}>&lt;</button>
          {contentConfig.title} ({previewIndex + 1}/{PREVIEW_ORDER.length})
          <button onClick={() => step(1)}>&gt;</button>
        </PreviewSwitcher>
      )}
      <ModalCardContent>
        <ModalTitle>{contentConfig.title}</ModalTitle>
        <ModalSubTextContainer>
          <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
          <ModalSubText $fontSize={PLAY_AGAIN_FONT_SIZE}>Play again?</ModalSubText>
        </ModalSubTextContainer>
        {isGameOver && <ButtonRow>
          <ModalButtonWithWisps label="Yes" onClick={rootGameStore.resetGame} />
          <ModalButtonWithWisps label="No" onClick={() => window.open('https://github.com/jamiejamiebobamie/QuickCast', '_blank', 'noopener,noreferrer')} />
        </ButtonRow>}
      </ModalCardContent>
    </ModalDimOverlay>
  );
};

export default GameOverModalComponent;
