// EmojiReactionsComponent.tsx
// 2-player matches: in the difficulty button's place, a symbol changing in place (black, with a glowing
// white outline); clicking it opens a tray of emoji. One picked shows over this player's wizard's head on
// both screens (EmoteBubble), with a short cooldown between them.
import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../../../DataClasses/store';
import { EMOTES, EMOTE_CLEAR } from '../../../DataClasses/Multiplayer/emotes';
import { UIFadeIn } from '../../UIFadeIn';
import { LAYERS } from '../../layers';

/**
 * The button: look 'mask' (the difficulty button's Normal mask, "React" in gold beneath it) or 'symbols'
 * (a symbol changing in place); the symbols (shown as text, not emoji: the ︎) and how often they change (seconds).
 */
export const EMOJI_BUTTON = {
  look: 'mask' as 'mask' | 'symbols',
  label: 'React',
  symbols: ['☺', '✦', '☾', '♥', '❦', '☼', '✿', '♠'].map(symbol => symbol + '︎'),
  everySeconds: 1.3,
  title: 'React',
};

const Anchor = styled(UIFadeIn) <{ $isShowingModal: boolean }>`
  position: absolute;
  top: 1.5cqw;
  right: 4.5cqw;
  /* beneath the canvas while it shows the keyboard controls or a Spell Book page, which then cover it (layers.ts) */
  z-index: ${props => props.$isShowingModal ? LAYERS.buttonUnderOverlay : LAYERS.button};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.8cqw;
`;

const swap = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

const Trigger = styled.button<{ $isCooling: boolean }>`
  width: 7cqw;
  height: 7cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: 'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', serif;
  font-size: 5cqw;
  line-height: 1;
  color: #0b0b0b;
  /* the glowing white outline, behind the black symbol */
  text-shadow: 0 0 0.15cqw #fff, 0 0 0.35cqw #fff, 0 0 0.9cqw rgba(255, 255, 255, 0.85), 0 0 1.8cqw rgba(255, 255, 255, 0.5);
  opacity: ${props => props.$isCooling ? 0.45 : 1};
  transition: transform 0.2s, opacity 0.3s, text-shadow 0.2s;
  span { display: inline-block; animation: ${swap} 0.25s ease-out; }
  &:hover {
    transform: scale(1.1);
    text-shadow: 0 0 0.2cqw #fff, 0 0 0.5cqw #fff, 0 0 1.2cqw #fff, 0 0 2.4cqw rgba(255, 255, 255, 0.7);
  }
`;

/** The mask (as the difficulty button's: NpcDifficultyComponent), with its label beneath. */
const MaskTrigger = styled.button<{ $isCooling: boolean }>`
  position: relative;
  width: 8.5cqw;
  aspect-ratio: 58 / 73;
  margin-bottom: 2.6cqw; /* (room for the label) */
  padding: 0;
  background: transparent url('mask-icons/1mask-icon-Normal.png') center / cover no-repeat;
  border: none;
  cursor: pointer;
  filter: drop-shadow(2px 2px 4px black) brightness(.95);
  opacity: ${props => props.$isCooling ? 0.5 : 1};
  transition: transform 0.4s, filter 0.4s, opacity 0.3s;
  .label {
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translate(-50%, -35%);
    font-family: 'EnchantedLand', sans-serif;
    font-size: 2.4cqw;
    color: #e6c563;
    -webkit-text-stroke: 0.01cqw #3d2a08;
    filter: drop-shadow(0 0 0.4cqw #000) drop-shadow(0 0 0.2cqw #000);
    transition: color 0.3s, filter 0.3s;
    white-space: nowrap;
  }
  &:hover {
    transform: scale(1.08);
    filter: drop-shadow(0 0 0.8cqw rgba(230, 197, 99, 0.7)) brightness(1.1);
  }
  &:hover .label {
    color: #fff1b8;
    filter: drop-shadow(0 0 0.4cqw #000) drop-shadow(0 0 0.6cqw rgba(255, 220, 130, 0.6));
  }
`;

const Tray = styled.div`
  display: flex;
  gap: 0.4cqw;
  max-width: 34cqw;
  /* (sideways only, if there are ever more than fit; no scrollbars, and never up and down) */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  padding: 0.8cqw; /* (room for a hovered emoji to grow) */
  background: rgba(20, 20, 20, 0.85);
  border: 0.15cqw solid #444;
  border-radius: 1.8cqw;
  box-shadow: 0 0.3cqw 0.8cqw rgba(0, 0, 0, 0.6);
  animation: ${swap} 0.18s ease-out;
`;

/** The tray's clear: an ✕ in the game's gold, where an emoji would be. */
const ClearChoice = styled.button<{ $isCooling: boolean }>`
  flex: none;
  width: 3.6cqw;
  height: 3.6cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1.9cqw;
  line-height: 1;
  color: #e6c563;
  background: transparent;
  border: 0.12cqw solid rgba(230, 197, 99, 0.45);
  border-radius: 50%;
  cursor: ${props => props.$isCooling ? 'default' : 'pointer'};
  opacity: ${props => props.$isCooling ? 0.45 : 1};
  transition: transform 0.15s, border-color 0.15s;
  &:hover { transform: scale(1.12); border-color: #e6c563; }
`;

const EmojiChoice = styled.button<{ $isCooling: boolean }>`
  flex: none;
  width: 3.6cqw;
  height: 3.6cqw;
  /* (the emoji centered in its ring) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 2.4cqw;
  line-height: 1;
  background: transparent;
  border: 0.12cqw solid transparent;
  border-radius: 50%;
  cursor: ${props => props.$isCooling ? 'default' : 'pointer'};
  opacity: ${props => props.$isCooling ? 0.45 : 1};
  transition: transform 0.15s, border-color 0.15s;
  ${props => !props.$isCooling && css`
    &:hover { transform: scale(1.2); border-color: #e6c563; }
  `}
`;

export default function EmojiReactionsComponent({ isShowingModal }: { isShowingModal: boolean }) {
  const snap = useSnapshot(rootGameStore);
  // (cooling down, or at risk at dawn: the status is then the frightened face, and reactions wait)
  const isCooling = snap.getIsEmoteCooling() || snap.getIsAtRisk('self');
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isMatchOver = snap.getIsMatchOver();
  useEffect(() => { if (isMatchOver) setIsOpen(false); }, [isMatchOver]); // (the match over: closed)
  const anchorRef = useRef<HTMLDivElement | null>(null);

  // The symbol changing in place
  useEffect(() => {
    const interval = window.setInterval(() => setIndex(k => (k + 1) % EMOJI_BUTTON.symbols.length), EMOJI_BUTTON.everySeconds * 1000);
    return () => window.clearInterval(interval);
  }, []);
  // (the tray closes on a click anywhere else)
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => { if (!anchorRef.current?.contains(e.target as Node)) setIsOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  const send = (emoji: string) => {
    if (isCooling) return;
    rootGameStore.sendEmote(emoji);
    setIsOpen(false);
  };

  return (
    <Anchor ref={anchorRef} $isShowingModal={isShowingModal} $isDoneWithIntro={snap.getIsDoneWithIntroWalk()} data-click-type="ui-buttons">
      {EMOJI_BUTTON.look === 'mask'
        ? (
          <MaskTrigger $isCooling={isCooling} title={EMOJI_BUTTON.title} aria-label={EMOJI_BUTTON.title} onClick={() => setIsOpen(open => !open)}>
            <span className="label">{EMOJI_BUTTON.label}</span>
          </MaskTrigger>
        ) : (
          <Trigger $isCooling={isCooling} title={EMOJI_BUTTON.title} aria-label={EMOJI_BUTTON.title} onClick={() => setIsOpen(open => !open)}>
            <span key={index}>{EMOJI_BUTTON.symbols[index]}</span>
          </Trigger>
        )}
      {isOpen && (
        <Tray>
          {EMOTES.map(emoji => (
            <EmojiChoice key={emoji} $isCooling={isCooling} onClick={() => send(emoji)} aria-label={emoji}>{emoji}</EmojiChoice>
          ))}
          {/* (last: no reaction, the one up taken down) */}
          <ClearChoice $isCooling={isCooling} onClick={() => send(EMOTE_CLEAR)} aria-label='Clear' title='Clear'>✕</ClearChoice>
        </Tray>
      )}
    </Anchor>
  );
}
