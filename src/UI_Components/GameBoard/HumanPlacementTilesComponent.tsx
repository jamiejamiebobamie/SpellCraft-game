
import styled from 'styled-components';
import { rootGameStore } from '../../DataClasses/store';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { useSnapshot } from 'valtio';

const PlacementArea = styled.div<{ $isShow: boolean }>`
  position: absolute;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(3, 1fr);
  width: ${GameBoard.NUM_ROWS / GameBoard.NUM_COLS * 100}%;
  height: 100%;
  border: 0.05cqw solid #fff4f494;
  filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3));
  z-index: 15;

  animation: ${props => props.$isShow && 'flashOpacity'} 1s infinite alternate ease-in-out;

  opacity: ${props => props.$isShow ? .2 : 0};
  transition: opacity 1s;

  @keyframes flashOpacity {
    0%, 100%  {
      opacity: 0;
    }
    50% {
      opacity: 0.2;
    }
  }
`;

export const HumanPlacementTilesComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isDrawingOffBoard = snap.getIsDrawingOffBoard();
  const isGameBoardDisabled: boolean = snap.getIsGameBoardDisabled();
  return <PlacementArea $isShow={!isGameBoardDisabled && isDrawingOffBoard} />
}