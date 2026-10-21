import React, { useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';
import { GameOverStatus } from '../DataClasses/types'; // Update paths based on your actual structure
import { titleLetteringCss } from './Logo/titleLettering';
import HoverSymbols from './HoverSymbols';
import { PlayButtonFace, PLAY_BUTTON_BRIGHTNESS, getPlayButtonGlow } from './PlayButtonStyles';

// --- Configuration Content Maps ---
interface ModalTextConfig {
  title: string;
  text: string;
  fontSize: number;
  isPlayAgainOwnLine?: boolean; // "Play again?" on its own line, below (for a long ending)
}

// Assuming your 4th state "Caught by Teacher" maps to a status key or string fallback
// (fontSize, cqw: each ending's line, with "Play again?" after it, on one line)
const MODAL_CONTENT_MAP: Record<string, ModalTextConfig> = {
  [GameOverStatus.BothDead]: {
    title: 'A Draw',
    text: "The match ends in a draw.",
    fontSize: 3.6
  },
  [GameOverStatus.PlayerWon]: {
    title: 'You Won',
    text: 'You won!',
    fontSize: 3.6
  },
  [GameOverStatus.NpcWon]: {
    title: 'You Lost',
    text: 'You lost...',
    fontSize: 3.6
  },
  [GameOverStatus.TimesUp]: {
    title: 'Caught!',
    text: 'You have been caught out of bed after curfew and will surely be expelled.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
};

const MIN_OPACITY = 0, MAX_OPACITY = .85, TRANSITION_TIME_SEC = 1.5;

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

/** The ending's text's line height (in its font size). */
const SUBTEXT_LINE_HEIGHT = 1.4;
/** The usual ending's text size (cqw): the buttons sit where they do below one line of it. */
const STANDARD_SUBTEXT_SIZE = 3.6;

const ModalSubText = styled.p<{ $fontSize: number }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$fontSize}cqw;
  color: #efe0b9; /* vellum */
  white-space: nowrap; /* one line */
  margin: 0 auto;
  text-shadow: 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.9), 0 0 0.8cqw rgba(0, 0, 0, 0.7);
  line-height: ${SUBTEXT_LINE_HEIGHT};
  text-align: center;
`;

/** The ending's text. $extraLinesCqw: how much taller it is than one line at the standard size, taken back out of the layout so the buttons stay where they are on every ending. */
const ModalSubTextContainer = styled.div<{ $extraLinesCqw: number }>`
  display: flex;
  flex-flow: column wrap;
  justify-content: center;
  align-items: center;
  width: 100%;
  text-align: center;
  margin-bottom: -${props => props.$extraLinesCqw}cqw;
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

/** Raises the title and its line of text (not the buttons) this far (cqw). */
const TEXT_RAISE = 4;

/** The title and its line of text, raised (TEXT_RAISE). */
const RaisedText = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3cqw;
  transform: translateY(-${TEXT_RAISE}cqw);
`;

// --- Component Definition ---
interface ActionButtonProps {
  label: string;
  onClick: () => void;
}

const ModalButtonWithSymbols: React.FC<ActionButtonProps> = ({ label, onClick }) => {
  const [hoverKey, setHoverKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  return (
    <RubyModalButton
      $glow={getPlayButtonGlow('ruby')}
      onClick={onClick}
      onMouseEnter={() => { setHoverKey(prev => prev + 1); setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PlayButtonFace look="ruby" label={label} isGlinting={isHovered} />
      <HoverSymbols isHovered={isHovered} hoverKey={hoverKey} />
    </RubyModalButton>
  );
};

export const GameOverModalComponent: React.FC = () => {
  const snap = useSnapshot(rootGameStore);
  const currentGameOverState = snap.getGameOver();
  // (compared with null: a draw, GameOverStatus.BothDead, is 0)
  const isGameOver = currentGameOverState !== null;
  const contentConfig = isGameOver ? MODAL_CONTENT_MAP[currentGameOverState] : { title: '', fontSize: 0, text: '' };

  return (
    <ModalDimOverlay $isDisplay={isGameOver} $bgOpacity={isGameOver ? MAX_OPACITY : MIN_OPACITY}>
      <ModalCardContent>
        <RaisedText>
          <ModalTitle>{contentConfig.title}</ModalTitle>
          <ModalSubTextContainer $extraLinesCqw={contentConfig.isPlayAgainOwnLine ? (2 * contentConfig.fontSize - STANDARD_SUBTEXT_SIZE) * SUBTEXT_LINE_HEIGHT : 0}>
            {contentConfig.isPlayAgainOwnLine ? (
              <>
                <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
                <ModalSubText $fontSize={contentConfig.fontSize}>Play again?</ModalSubText>
              </>
            ) : (
              <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text} Play again?</ModalSubText>
            )}
          </ModalSubTextContainer>
        </RaisedText>
        {isGameOver && <ButtonRow>
          <ModalButtonWithSymbols label="Yes" onClick={rootGameStore.resetGame} />
          <ModalButtonWithSymbols label="No" onClick={() => {
            // The project's GitHub in a new tab, and this one back to the landing page (a fresh start)
            window.open('https://github.com/jamiejamiebobamie/SpellCraft-game', '_blank', 'noopener,noreferrer');
            window.location.reload();
          }} />
        </ButtonRow>}
      </ModalCardContent>
    </ModalDimOverlay>
  );
};

export default GameOverModalComponent;
