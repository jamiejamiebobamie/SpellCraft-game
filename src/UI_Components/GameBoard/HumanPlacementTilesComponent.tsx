
import styled, { css, keyframes } from 'styled-components';
import { rootGameStore } from '../../DataClasses/store';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { useSnapshot } from 'valtio';
import { EtchedFrame, GOLD } from '../goldStyle';
import { isWebKit } from '../browserEngine';

/**
 * Drawing off the board: the player's side of it (their 3 columns) outlined in the UI's gold (goldStyle),
 * glowing, a faint gold wash over it, pulsing between low and high (opacity) every `seconds`. Sizes in cqw.
 * In WebKit (Safari, and every browser on an iPad) it doesn't pulse but holds at `webKitOpacity`: there the
 * pulse redrew its glow every frame, and the spells on the board froze while it showed.
 */
const PLACEMENT_HIGHLIGHT = { edge: 0.22, glow: 1.2, wash: 0.1, low: 0.35, high: 1, seconds: 1, webKitOpacity: 0.8 };

const pulse = keyframes`
  0%, 100% { opacity: ${PLACEMENT_HIGHLIGHT.low}; }
  50% { opacity: ${PLACEMENT_HIGHLIGHT.high}; }
`;

// (shown and hidden by fading, apart from the pulse: so it fades out, not cut off, as the pulse stops). Once
// faded out it's hidden outright (visibility) and its pulse paused: left pulsing unseen, its glow was redrawn
// every frame of a match, which made the iPad unplayable (found by bisecting: ba848c6)
const FADE_OUT_SECONDS = 0.8;
const PlacementFade = styled.div<{ $isShow: boolean }>`
  position: absolute;
  width: ${GameBoard.NUM_ROWS / GameBoard.NUM_COLS * 100}%;
  height: 100%;
  z-index: 15;
  pointer-events: none;
  opacity: ${props => props.$isShow ? 1 : 0};
  visibility: ${props => props.$isShow ? 'visible' : 'hidden'};
  transition: ${props => props.$isShow ? 'opacity 0.3s ease-out, visibility 0s' : `opacity ${FADE_OUT_SECONDS}s ease-out, visibility 0s ${FADE_OUT_SECONDS}s`};
`;

const PlacementArea = styled.div<{ $isPulsing: boolean }>`
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: ${PLACEMENT_HIGHLIGHT.edge}cqw solid ${GOLD};
  border-radius: 0.4cqw;
  background: rgba(230, 197, 99, ${PLACEMENT_HIGHLIGHT.wash});
  box-shadow: 0 0 ${PLACEMENT_HIGHLIGHT.glow}cqw rgba(255, 220, 130, 0.75), inset 0 0 ${PLACEMENT_HIGHLIGHT.glow}cqw rgba(255, 220, 130, 0.45);
  ${props => isWebKit ? `opacity: ${PLACEMENT_HIGHLIGHT.webKitOpacity};` : css`
    animation: ${pulse} ${PLACEMENT_HIGHLIGHT.seconds}s ease-in-out infinite;
    animation-play-state: ${props.$isPulsing ? 'running' : 'paused'};
  `}
`;

export const HumanPlacementTilesComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isDrawingOffBoard = snap.getIsDrawingOffBoard();
  // (only while the player can act: when the clock's halo shows, Game.getCanPlayerAct)
  const isShow = snap.getCanPlayerAct() && isDrawingOffBoard;
  return (
    <PlacementFade $isShow={isShow}>
      <PlacementArea $isPulsing={isShow}>
        <EtchedFrame inset={0.6} diamond={0.6} />
      </PlacementArea>
    </PlacementFade>
  );
}
