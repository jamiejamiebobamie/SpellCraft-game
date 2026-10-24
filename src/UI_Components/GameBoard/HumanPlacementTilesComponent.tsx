
import styled, { keyframes } from 'styled-components';
import { rootGameStore } from '../../DataClasses/store';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { useSnapshot } from 'valtio';
import { EtchedFrame, GOLD } from '../goldStyle';

/**
 * Drawing off the board: the player's side of it (their 3 columns) outlined in the UI's gold (goldStyle),
 * glowing, a faint gold wash over it, pulsing between low and high (opacity) every `seconds`. Sizes in cqw.
 */
const PLACEMENT_HIGHLIGHT = { edge: 0.22, glow: 1.2, wash: 0.1, low: 0.35, high: 1, seconds: 1 };

const pulse = keyframes`
  0%, 100% { opacity: ${PLACEMENT_HIGHLIGHT.low}; }
  50% { opacity: ${PLACEMENT_HIGHLIGHT.high}; }
`;

// (shown and hidden by fading, apart from the pulse: so it fades out, not cut off, as the pulse stops)
const PlacementFade = styled.div<{ $isShow: boolean }>`
  position: absolute;
  width: ${GameBoard.NUM_ROWS / GameBoard.NUM_COLS * 100}%;
  height: 100%;
  z-index: 15;
  pointer-events: none;
  opacity: ${props => props.$isShow ? 1 : 0};
  transition: opacity ${props => props.$isShow ? 0.3 : 0.8}s ease-out;
`;

const PlacementArea = styled.div`
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: ${PLACEMENT_HIGHLIGHT.edge}cqw solid ${GOLD};
  border-radius: 0.4cqw;
  background: rgba(230, 197, 99, ${PLACEMENT_HIGHLIGHT.wash});
  box-shadow: 0 0 ${PLACEMENT_HIGHLIGHT.glow}cqw rgba(255, 220, 130, 0.75), inset 0 0 ${PLACEMENT_HIGHLIGHT.glow}cqw rgba(255, 220, 130, 0.45);
  animation: ${pulse} ${PLACEMENT_HIGHLIGHT.seconds}s ease-in-out infinite;
`;

export const HumanPlacementTilesComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isDrawingOffBoard = snap.getIsDrawingOffBoard();
  const isGameBoardDisabled: boolean = snap.getIsGameBoardDisabled();
  return (
    <PlacementFade $isShow={!isGameBoardDisabled && isDrawingOffBoard}>
      <PlacementArea>
        <EtchedFrame inset={0.6} diamond={0.6} />
      </PlacementArea>
    </PlacementFade>
  );
}
