
import React from 'react';
import { Game } from '../../DataClasses/Game';
import styled from 'styled-components';
import { useSnapshot } from 'valtio';

const PlacementArea = styled.div<{ $isPlayerDoingTurn: boolean }>`
  position: absolute;
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(3, 1fr);
  width: ${3/7 * 100}%;
  height: 100%;
  border: 0.05cqw solid #fff4f494;
  filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3));
  z-index: 15;
  opacity: ${props => props.$isPlayerDoingTurn ? .2 : 0};
  transition: opacity 1s;
`;

interface HumanPlacementTilesComponentProps {
    rootGameStore: Game;
}
// TO-DO: only show if: (1) isPlayerDoingTurn and (2) if player draws entirely off board... have flashing anim
export const HumanPlacementTilesComponent = ({ rootGameStore }: HumanPlacementTilesComponentProps) => {
    const snap = useSnapshot(rootGameStore);
    const isPlayerDoingTurn: boolean = !snap.getIsHumanPlayerDoneWithTurn();
    return <PlacementArea $isPlayerDoingTurn={false/*isPlayerDoingTurn*/} />
}