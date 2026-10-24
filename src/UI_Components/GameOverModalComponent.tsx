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
  secondLine?: string; // (with isPlayAgainOwnLine) a sentence starting that line, before "Play again?"
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
    text: 'A teacher caught you both out of bed after curfew.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtPlayer]: {
    title: 'You Lost', // (caught: the rival got away, so they won)
    text: 'Too weary to flee, you were caught by a teacher.',
    secondLine: 'Your rival slipped away...',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.EnemyFled]: {
    title: 'Enemy Fled',
    text: 'Your rival fled.',
    fontSize: 3.6,
  },
  [GameOverStatus.OutOfStep]: {
    title: 'Out of Step',
    text: "Your spells and your rival's no longer match up: the duel can't go on fairly.",
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtNpc]: {
    title: 'You Won', // (the rival was caught: you got away)
    text: 'A teacher caught your rival, too weary to flee.',
    secondLine: 'You slipped away...',
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
/**
 * The buttons follow the text, as close on every card as on the two-line caught ones (their text, 3.2cqw, a
 * line longer than one at 3.6cqw: that much taken back out of the gap between the text and the buttons).
 */
const TEXT_TO_BUTTONS_TRIM = (2 * 3.2 - 3.6) * SUBTEXT_LINE_HEIGHT;

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

/** The ending's text (the buttons close beneath it: TEXT_TO_BUTTONS_TRIM). */
const ModalSubTextContainer = styled.div`
  display: flex;
  flex-flow: column wrap;
  justify-content: center;
  align-items: center;
  width: 100%;
  text-align: center;
  margin-bottom: -${TEXT_TO_BUTTONS_TRIM}cqw;
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
 * Both wizards' masks beside the title: the player's (white) on the left, the rival's (green) on the right.
 * A winner's stays whole; a loser's cracks, then splits along the crack and falls apart, a moment after the
 * card shows. size: cqw wide. missingGlow: the light behind a missing (black) mask. titleGap: between each
 * mask's frame and the title (cqw).
 */
const OUTCOME_MASKS = { size: 9, titleGap: 4.5, crackDelaySeconds: 0.6, crackSeconds: 0.5, splitSeconds: 0.7, missingGlow: 'drop-shadow(0 0 0.5cqw rgba(255, 255, 255, 0.9)) drop-shadow(0 0 1.6cqw rgba(255, 255, 255, 0.45))' };

/**
 * Each mask's frame: a gold ring (size: across, cqw; ring: its thickness, cqw) around a dark disc (backing:
 * its opacity), a light travelling around it once every sheenSeconds.
 */
const MASK_FRAME = { size: 13.5, ring: 0.5, backing: 0.35, sheenSeconds: 4 };
// (the ring's gold: deep, with one bright stretch, the sheen, turning round it)
const FRAME_GOLD = 'conic-gradient(#a9822e 0deg, #e6c563 50deg, #fff1b8 80deg, #e6c563 110deg, #a9822e 170deg, #7d5f1f 250deg, #a9822e 360deg)';

const frameSheen = keyframes`
  to { transform: rotate(360deg); }
`;

/** A mask's round gold frame (MASK_FRAME), the mask centered in it. */
const MaskFrame = styled.div`
  position: relative;
  flex: none;
  width: ${MASK_FRAME.size}cqw;
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(0, 0, 0, ${MASK_FRAME.backing}) 60%, rgba(0, 0, 0, ${MASK_FRAME.backing * 0.6}) 100%);
  box-shadow: 0 0 1.2cqw rgba(230, 197, 99, 0.3), 0 0.3cqw 0.8cqw rgba(0, 0, 0, 0.7), inset 0 0 1.2cqw rgba(0, 0, 0, 0.6);
  /* the ring: the turning gold, cut to a band at the edge */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: ${FRAME_GOLD};
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - ${MASK_FRAME.ring}cqw), #000 calc(100% - ${MASK_FRAME.ring}cqw + 1px));
    mask: radial-gradient(farthest-side, transparent calc(100% - ${MASK_FRAME.ring}cqw), #000 calc(100% - ${MASK_FRAME.ring}cqw + 1px));
    animation: ${frameSheen} ${MASK_FRAME.sheenSeconds}s linear infinite;
    pointer-events: none;
  }
`;

/** For each game over (from this player's side): each mask whole, breaking, or missing (a rival who fled: black, backlit). */
type MaskOutcome = 'whole' | 'broken' | 'missing';
const MASK_OUTCOMES: Record<number, { self: MaskOutcome; rival: MaskOutcome }> = {
  [GameOverStatus.BothDead]: { self: 'whole', rival: 'whole' }, // (a draw)
  [GameOverStatus.PlayerWon]: { self: 'whole', rival: 'broken' },
  [GameOverStatus.NpcWon]: { self: 'broken', rival: 'whole' },
  [GameOverStatus.TimesUp]: { self: 'broken', rival: 'broken' }, // (both caught)
  [GameOverStatus.CaughtPlayer]: { self: 'broken', rival: 'whole' },
  [GameOverStatus.CaughtNpc]: { self: 'whole', rival: 'broken' },
  [GameOverStatus.OutOfStep]: { self: 'whole', rival: 'whole' },
  [GameOverStatus.EnemyFled]: { self: 'whole', rival: 'missing' },
};

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
const cracksFade = keyframes`
  to { opacity: 0; }
`;
const splitLeft = keyframes`
  to { transform: translate(-0.35cqw, 0.35cqw) rotate(-4deg); }
`;
const splitRight = keyframes`
  to { transform: translate(0.35cqw, 0.5cqw) rotate(3.5deg); }
`;

// The halves, cut along the main crack (in the mask image's 58 x 73 box, as %)
const CRACK_LINE = '53.4% 0%, 51.7% 19.2%, 46.6% 30.1%, 53.4% 39.7%, 44.8% 50.7%, 50% 63%, 43.1% 75.3%, 41.4% 100%';
const LEFT_HALF = `polygon(0% 0%, ${CRACK_LINE}, 0% 100%)`;
// (the right half: up the crack from the bottom, then round by the top right corner: not crossing itself)
const RIGHT_HALF = `polygon(${CRACK_LINE.split(', ').reverse().join(', ')}, 100% 0%, 100% 100%)`;

const MaskBox = styled.div<{ $delay: number; $isBroken: boolean; $isMissing: boolean }>`
  position: relative;
  flex: none;
  width: ${OUTCOME_MASKS.size}cqw;
  aspect-ratio: 58 / 73;
  filter: ${props => props.$isMissing ? OUTCOME_MASKS.missingGlow : 'drop-shadow(0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.8))'};
  ${props => props.$isBroken && css`animation: ${crackJolt} 0.45s ease-out ${props.$delay}s 1;`}
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  svg { ${props => css`animation: ${cracksFade} 0.3s ease-in ${props.$delay + OUTCOME_MASKS.crackSeconds + 0.15}s forwards;`} }
  path {
    fill: none;
    stroke: #1a0e06;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    ${props => css`animation: ${crackDraw} ${OUTCOME_MASKS.crackSeconds}s ease-out ${props.$delay}s forwards;`}
  }
`;

const MaskHalf = styled.div<{ $isWhite: boolean; $isMissing?: boolean; $clip: string; $split: ReturnType<typeof keyframes> | null; $delay: number }>`
  position: absolute;
  inset: 0;
  background: url(${props => props.$isWhite ? 'mask-icons/1mask-icon-Normal-white.png' : 'mask-icons/1mask-icon-Normal.png'}) center / cover no-repeat;
  ${props => props.$isMissing && 'filter: brightness(0);'}
  clip-path: ${props => props.$clip};
  transform-origin: 50% 100%;
  ${props => props.$split && css`animation: ${props.$split} ${OUTCOME_MASKS.splitSeconds}s cubic-bezier(0.3, 0, 0.6, 1) ${props.$delay}s forwards;`}
`;

/** A wizard's mask on the card: whole, cracking and splitting apart (`delaySeconds`: when it cracks), or missing. */
const OutcomeMask = ({ side, outcome, delaySeconds }: { side: 'self' | 'rival'; outcome: MaskOutcome; delaySeconds: number }) => {
  const splitDelay = delaySeconds + OUTCOME_MASKS.crackSeconds + 0.1;
  const isWhite = side === 'self', isBroken = outcome === 'broken', isMissing = outcome === 'missing';
  return (
    <MaskFrame aria-hidden>
    <MaskBox $delay={delaySeconds} $isBroken={isBroken} $isMissing={isMissing}>
      <MaskHalf $isWhite={isWhite} $isMissing={isMissing} $clip={isBroken ? LEFT_HALF : 'none'} $split={isBroken ? splitLeft : null} $delay={splitDelay} />
      {isBroken && <MaskHalf $isWhite={isWhite} $clip={RIGHT_HALF} $split={splitRight} $delay={splitDelay} />}
      {isBroken && (
        // (cracks from a point on the brow; pathLength 1 so each draws in evenly)
        <svg viewBox='0 0 58 73'>
          <path pathLength={1} d='M30 14 L27 22 L31 29 L26 37 L29 46 L25 55' />
          <path pathLength={1} d='M27 22 L19 26 L15 33' />
          <path pathLength={1} d='M31 29 L39 32 L43 40' />
          <path pathLength={1} d='M29 46 L35 51' />
        </svg>
      )}
    </MaskBox>
    </MaskFrame>
  );
};

/** The title, between the two masks. */
const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${OUTCOME_MASKS.titleGap}cqw;
  width: max-content; /* (a long title on one line: the row past the text's width if need be, still centered) */
  h2 { width: auto; white-space: nowrap; }
`;

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
  // (the masks beside the title: a loser's cracking once the card has faded in)
  const masks = isGameOver ? MASK_OUTCOMES[currentGameOverState] : null;
  const maskDelay = TRANSITION_TIME_SEC + OUTCOME_MASKS.crackDelaySeconds;

  return (
    <ModalDimOverlay $isDisplay={isGameOver} $bgOpacity={isGameOver ? MAX_OPACITY : MIN_OPACITY}>
      <ModalCardContent>
        <RaisedText>
          <TitleRow>
            {masks && <OutcomeMask key={`self:${currentGameOverState}`} side='self' outcome={masks.self} delaySeconds={maskDelay} />}
            <ModalTitle>{contentConfig.title}</ModalTitle>
            {masks && <OutcomeMask key={`rival:${currentGameOverState}`} side='rival' outcome={masks.rival} delaySeconds={maskDelay} />}
          </TitleRow>
          <ModalSubTextContainer>
            {contentConfig.isPlayAgainOwnLine ? (
              <>
                <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
                {/* (no "Play again?" once the rival has left) */}
                {(contentConfig.secondLine || !isRivalLeft) && (
                  <ModalSubText $fontSize={contentConfig.fontSize}>{[contentConfig.secondLine, isRivalLeft ? '' : 'Play again?'].filter(Boolean).join(' ')}</ModalSubText>
                )}
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
