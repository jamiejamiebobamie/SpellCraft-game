// TurnCard.tsx
// Whose move it is as each turn begins: "Your Move" or "Their Move" over the board, in the title's
// lettering, fading in, holding a moment, then fading away. (While a turn goes on, the active
// wizard's spotlight shows it: see Spotlight.) Also NpcPassCard: over the NPC's avatar when it passes its turn.
import styled, { keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../DataClasses/store';
import { titleLetteringCss } from './Logo/titleLettering';
import SymbolSpinner from './SymbolSpinner';
import { EMOTE_TIMING } from '../DataClasses/Multiplayer/emotes';

/** The card (seconds; size in cqw). */
export const TURN_CARD = { delaySeconds: 0.5, inSeconds: 0.35, holdSeconds: 1.1, outSeconds: 0.55, size: 6, yourMove: 'Your Move', theirMove: 'Their Move' };
const TOTAL = TURN_CARD.inSeconds + TURN_CARD.holdSeconds + TURN_CARD.outSeconds;

const showAndFade = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
  ${(TURN_CARD.inSeconds / TOTAL) * 100}% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  ${((TURN_CARD.inSeconds + TURN_CARD.holdSeconds) / TOTAL) * 100}% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.04); }
`;

const Card = styled.div`
  position: absolute;
  left: 50%;
  top: 28cqw;
  z-index: 40;
  pointer-events: none;
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${TURN_CARD.size}cqw;
  line-height: 1;
  opacity: 0;
  ${titleLetteringCss({ strokeCqw: 0.06, glowCqw: 0.6 })}
  animation: ${showAndFade} ${TOTAL}s ease-in-out ${TURN_CARD.delaySeconds}s forwards; /* (the delay: clear of the game over screen fading) */
`;

export default function TurnCard() {
  const snap = useSnapshot(rootGameStore);
  const card = snap.getTurnCard();
  if (!card || snap.getGameOver() !== null) return null;
  // (keyed by the turn, so each turn's card plays afresh)
  return <Card key={card.id}>{card.isPlayerFirst ? TURN_CARD.yourMove : TURN_CARD.theirMove}</Card>;
}

/** The NPC passing its turn (casting nothing): a card over its avatar (seconds; size in cqw; top in % of the avatar). */
export const NPC_PASS_CARD = { inSeconds: 0.25, holdSeconds: 1.1, outSeconds: 0.55, size: 3.2, top: 2, text: 'Pass' };
const PASS_TOTAL = NPC_PASS_CARD.inSeconds + NPC_PASS_CARD.holdSeconds + NPC_PASS_CARD.outSeconds;

const passShowAndFade = keyframes`
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.92); }
  ${(NPC_PASS_CARD.inSeconds / PASS_TOTAL) * 100}% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  ${((NPC_PASS_CARD.inSeconds + NPC_PASS_CARD.holdSeconds) / PASS_TOTAL) * 100}% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -70%) scale(1.04); }
`;

const PassCard = styled.div`
  position: absolute;
  left: 50%;
  top: ${NPC_PASS_CARD.top}%;
  z-index: 40;
  pointer-events: none;
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${NPC_PASS_CARD.size}cqw;
  line-height: 1;
  opacity: 0;
  ${titleLetteringCss({ strokeCqw: 0.05, glowCqw: 0.5 })}
  animation: ${passShowAndFade} ${PASS_TOTAL}s ease-in-out forwards;
`;

/** Placed inside the NPC's avatar (not its mirrored frame). */
export function NpcPassCard() {
  const snap = useSnapshot(rootGameStore);
  const card = snap.getNpcPassCard();
  if (!card || snap.getGameOver() !== null) return null;
  // (keyed by each pass, so each plays afresh)
  return <PassCard key={card.id}>{NPC_PASS_CARD.text}</PassCard>;
}

const waitPulse = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
`;

const WaitingCard = styled.div`
  position: absolute;
  left: 50%;
  top: 28cqw;
  transform: translate(-50%, -50%);
  z-index: 40;
  pointer-events: none;
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 3.6cqw;
  line-height: 1;
  ${titleLetteringCss({ strokeCqw: 0.05, glowCqw: 0.5 })}
  animation: ${waitPulse} 2.2s ease-in-out infinite;
`;

/** A 2-player match waiting for the rival: to join (the host), or to begin (getRivalWaitingText). */
export function RivalWaitingCard() {
  const snap = useSnapshot(rootGameStore);
  const text = snap.getRivalWaitingText();
  if (!text || !snap.getHumanPlayer()?.getIsDoneWithIntroWalk()) return null;
  return <WaitingCard>{text}</WaitingCard>;
}

/** The spinner's place over the rival's head (just above its hat). */
const RivalSpinnerPlace = styled.div`
  position: absolute;
  left: 50%;
  top: -4%;
  transform: translate(-50%, -50%);
  z-index: 40;
  pointer-events: none;
`;

/** Placed inside the rival's avatar (the NPC's side): the spinner, while the rival isn't with us. */
export function RivalSpinner() {
  const snap = useSnapshot(rootGameStore);
  return snap.getIsRivalSpinning() ? <RivalSpinnerPlace><SymbolSpinner size={3.2} /></RivalSpinnerPlace> : null;
}

const emotePop = keyframes`
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.5); }
  14% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  24% { transform: translate(-50%, -50%) scale(1); }
  75% { opacity: 1; transform: translate(-50%, -70%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -90%) scale(0.95); }
`;

/** An emoji over a wizard's head (2-player): bigger and higher than "Pass"; seconds: EMOTE_TIMING. */
const EmoteText = styled.div`
  position: absolute;
  left: 50%;
  top: -16%;
  z-index: 41;
  pointer-events: none;
  font-size: 5.2cqw;
  line-height: 1;
  filter: drop-shadow(0 0.3cqw 0.5cqw rgba(0, 0, 0, 0.6));
  animation: ${emotePop} ${EMOTE_TIMING.showSeconds}s ease-out forwards;
`;

/** Placed inside a wizard's avatar (not its mirrored frame): its latest emoji, for a moment. */
export function EmoteBubble({ side }: { side: 'self' | 'rival' }) {
  const snap = useSnapshot(rootGameStore);
  const emote = snap.getEmote(side);
  if (!emote) return null;
  return <EmoteText key={emote.id}>{emote.emoji}</EmoteText>;
}
