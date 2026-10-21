// TurnCard.tsx
// Whose move it is as each turn begins: "Your Move" or "Their Move" over the board, in the title's
// lettering, fading in, holding a moment, then fading away. (While a turn goes on, the active
// wizard's spotlight shows it: see Spotlight.)
import styled, { keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../DataClasses/store';
import { titleLetteringCss } from './Logo/titleLettering';

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
