
import React, { RefObject } from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import NpcSpellCanvasComponent from '../SpellCanvas/NpcSpellCanvasComponent';
import { HumanPlacementTilesComponent } from './HumanPlacementTilesComponent'
import { LockSymbolComponent } from './LockSymbolComponent';
import styled from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../../DataClasses/store';


const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  15.5cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 1s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'};
`;

const GridContainer = styled.div<{ $NUM_ROWS: number, $NUM_COLS: number }>`
  display: grid;
  ${props => `
      grid-template-rows: repeat(${props.$NUM_ROWS}, 1fr);
      grid-template-columns: repeat(${props.$NUM_COLS}, 1fr);
    `}
`;

const StyledCell = styled.div<{
    $isDisabled: boolean;
    $transparency: number;
    $i: number;
    $j: number;
    $maxI: number;
    $maxJ: number;
    $numPlacementCells: number;
    $isOccupied: boolean;
}>`
  /* Replaced opaque colors with semi-transparent ones to allow backdrop-filter to work */
  background: rgba(200, 200, 210, 0.12);

  /* The magic property: creates the refractive thick-glass distortion */
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);

  /* A very thin white-tinted border that acts as a shining edge highlight */
  border: 0.05cqw solid rgba(255, 255, 255, 0.35);
  box-shadow: 
    inset 0 1px 1px rgba(255, 255, 255, 0.4),    /* Top inner light reflection */
    inset 0 -1px 1px rgba(0, 0, 0, 0.1),         /* Bottom inner grounding shadow */
    0 4px 12px rgba(0, 0, 0, 0.08);              /* Subtle ambient shadow onto elements below */

  /* Layout and Sizing */
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* Keeps the gloss reflection element contained */
  
  /* Transitions */
  transition: opacity 1s ease, background 0.3s ease, border 0.15s ease, filter 0.2s ease, box-shadow 0.2s ease;
  opacity: .2;
  filter: brightness(1.2);


  &:hover {
    ${props => !props.$isDisabled
        && `
        filter: brightness(1.2);
        box-shadow: 
          inset 0 1px 2px rgba(255, 255, 255, 0.5),
          0 6px 16px rgba(0, 0, 0, 0.12);
      `};
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
  }
`;

interface GameBoardComponentProps {
    gridOverlayRef: RefObject<HTMLDivElement | null>;
}

const GameBoardComponent = ({ gridOverlayRef }: GameBoardComponentProps) => {
    const snap = useSnapshot(rootGameStore);
    const npcMoveData = snap.getNPCMoveData();
    const isDisabled: boolean = snap.getIsGameBoardDisabled();
    // const isDoneWithIntro: boolean = snap.getIsDoneWithIntroWalk();
    let numPlacementCells = snap.gameBoard.numPlacementCells;
    return (
        <BoardWrapper ref={gridOverlayRef} $isDisabled={isDisabled} $transparency={snap.gameBoard.getBoardTransparencyAmt()}>
            {/* <LockSymbolComponent isLocked={isDisabled} /> */}
            <HumanPlacementTilesComponent />
            {npcMoveData.map((npcMd, i) => <NpcSpellCanvasComponent key={npcMd.id} i={i} />)}
            <GridContainer
                $NUM_ROWS={GameBoard.NUM_ROWS}
                $NUM_COLS={GameBoard.NUM_COLS}
            >
                {snap.gameBoard.cells.map(c =>
                    <StyledCell
                        key={c.id}
                        data-click-type="board-cell"
                        $maxI={GameBoard.NUM_ROWS - 1}
                        $maxJ={numPlacementCells - 1}
                        $i={c.getCellIndex().i}
                        $j={c.getCellIndex().j}
                        $numPlacementCells={snap.gameBoard.numPlacementCells}
                        $isOccupied={!c.getIsFree()}
                        $isDisabled={isDisabled}
                        $transparency={c.getTransparencyAmt()}
                    />
                )}
            </GridContainer>
        </BoardWrapper>
    );
}

export default GameBoardComponent;