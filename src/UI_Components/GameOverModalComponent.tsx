import React, { useState } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { css, keyframes } from 'styled-components';
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
  // Caught by a teacher (the weaker wizard; both, if even)
  [GameOverStatus.TimesUp]: {
    title: 'Teacher!',
    text: 'A teacher caught you both out of bed after curfew. You will surely be expelled.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtPlayer]: {
    title: 'You Lost', // (caught: the rival got away, so they won)
    text: 'Too weary to flee, you were caught by a teacher. Your rival slipped away into the dark.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.EnemyFled]: {
    title: 'Enemy Fled',
    text: 'Your rival fled the hall, leaving the duel to you.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.OutOfStep]: {
    title: 'Out of Step',
    text: "Your spells and your rival's no longer match up: the duel can't go on fairly.",
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtNpc]: {
    title: 'You Won', // (the rival was caught: you got away)
    text: 'A teacher caught your rival, too weary to flee. You slipped away into the dark.',
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
const ModalNote = styled.div`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.6cqw;
  color: #e6c563;
  text-align: center;
  margin-top: 1.5cqw;
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

/** Raises the title and its line of text (not the buttons) this far (cqw). */
const TEXT_RAISE = 4;

/** The title and its line of text, raised (TEXT_RAISE). */
/**
 * A teacher's catch: the caught wizard's mask over the title, cracking (cracks drawn across it, with a
 * jolt) a moment after the card shows. size: cqw wide.
 */
const CRACKED_MASK = { size: 7, crackDelaySeconds: 0.6, crackSeconds: 0.5 };
const CAUGHT_STATUSES: Array<number> = [GameOverStatus.CaughtPlayer, GameOverStatus.CaughtNpc, GameOverStatus.TimesUp];

const crackDraw = keyframes`
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
`;
const crackJolt = keyframes`
  0%, 100% { transform: rotate(0deg) scale(1); }
  20% { transform: rotate(-4deg) scale(1.06); }
  45% { transform: rotate(3deg) scale(0.98); }
  70% { transform: rotate(-1deg) scale(1); }
`;

const MaskBox = styled.div<{ $delay: number }>`
  position: relative;
  width: ${CRACKED_MASK.size}cqw;
  aspect-ratio: 58 / 73;
  margin: 0 auto -1cqw;
  background: url('mask-icons/1mask-icon-Normal.png') center / cover no-repeat;
  filter: drop-shadow(0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.8)) brightness(0.9);
  ${props => css`animation: ${crackJolt} 0.45s ease-out ${props.$delay}s 1;`}
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  path {
    fill: none;
    stroke: #1a0e06;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    ${props => css`animation: ${crackDraw} ${CRACKED_MASK.crackSeconds}s ease-out ${props.$delay}s forwards;`}
  }
`;

/** The caught wizard's mask, cracking (shown with a catch's card). */
const CrackedMask = ({ delaySeconds }: { delaySeconds: number }) => (
  <MaskBox $delay={delaySeconds} aria-hidden>
    {/* (cracks from a point on the brow, in a 58 x 73 box; pathLength 1 so each draws in evenly) */}
    <svg viewBox='0 0 58 73'>
      <path pathLength={1} d='M30 14 L27 22 L31 29 L26 37 L29 46 L25 55' />
      <path pathLength={1} d='M27 22 L19 26 L15 33' />
      <path pathLength={1} d='M31 29 L39 32 L43 40' />
      <path pathLength={1} d='M29 46 L35 51' />
    </svg>
  </MaskBox>
);

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
  const isAwaitingRematch = snap.getIsAwaitingRematch(), isRivalLeft = snap.getIsRivalLeft();

  return (
    <ModalDimOverlay $isDisplay={isGameOver} $bgOpacity={isGameOver ? MAX_OPACITY : MIN_OPACITY}>
      <ModalCardContent>
        <RaisedText>
          {isGameOver && CAUGHT_STATUSES.includes(currentGameOverState) && <CrackedMask delaySeconds={TRANSITION_TIME_SEC + CRACKED_MASK.crackDelaySeconds} />}
          <ModalTitle>{contentConfig.title}</ModalTitle>
          <ModalSubTextContainer $extraLinesCqw={contentConfig.isPlayAgainOwnLine ? (2 * contentConfig.fontSize - STANDARD_SUBTEXT_SIZE) * SUBTEXT_LINE_HEIGHT : 0}>
            {contentConfig.isPlayAgainOwnLine ? (
              <>
                <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
                {/* (no "Play again?" once the rival has left) */}
                {!isRivalLeft && <ModalSubText $fontSize={contentConfig.fontSize}>Play again?</ModalSubText>}
              </>
            ) : (
              <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}{isRivalLeft ? '' : ' Play again?'}</ModalSubText>
            )}
          </ModalSubTextContainer>
        </RaisedText>
        {/* (a 2-player match: Yes waits for the rival's; a rival who left can't play again) */}
        {isGameOver && isRivalLeft && currentGameOverState !== GameOverStatus.EnemyFled && <ModalNote>Your rival has left the hall.</ModalNote>}
        {isGameOver && isAwaitingRematch && !isRivalLeft && <ModalNote>Waiting for your rival…</ModalNote>}
        {isGameOver && !isAwaitingRematch && <ButtonRow>
          {!isRivalLeft && <ModalButtonWithSymbols label="Yes" onClick={() => rootGameStore.chooseRematch()} />}
          <ModalButtonWithSymbols label={isRivalLeft ? "Back" : "No"} onClick={() => {
            // Back to the landing page (a fresh start; an invite link's join left off, so it isn't joined again)
            if (snap.getIsMultiplayer()) rootGameStore.leaveMatch();
            window.location.href = window.location.origin + window.location.pathname;
          }} />
        </ButtonRow>}
      </ModalCardContent>
    </ModalDimOverlay>
  );
};

export default GameOverModalComponent;
