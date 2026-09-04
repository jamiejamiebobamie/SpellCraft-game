
import React from 'react';
import styled from 'styled-components';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { NPCPlayer } from '../../DataClasses/Player/Player'
import { Game } from '../../DataClasses/Game';
import { SpellComponent } from './SpellComponent';
import { useSnapshot } from 'valtio';

const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  12.5cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 1s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
`;

const StyledCell = styled.div<{
    $isPlace: boolean;
    $isHighlighted: boolean;
    $spellOwnerColor?: string;
    $isPlayerCell: boolean;
    $transparency: number;
    $isPlacingGameSymbol: boolean;
    $i: number;
    $j: number;
    $maxI: number;
    $maxJ: number;
    $numPlacementCells: number;
    $isOccupied: boolean;
}>`
  background: ${props => props.$isPlayerCell ? '#bcb9b9' : '#c7c2c2'};
  ${props => props.$isHighlighted && `filter: brightness(1.1);`}
  border: 0.05cqw solid;
  ${props => (props.$isPlacingGameSymbol && props.$isPlace && props.$i == 0) && 'border-top: 0.05cqw solid #dbd668;'}
  ${props => (props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ - props.$numPlacementCells + 1) && 'border-left: 0.05cqw solid #dbd668;'}
  ${props => (props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ) && 'border-right: 0.05cqw solid #dbd668;'}
  ${props => (props.$isPlacingGameSymbol && props.$isPlace && props.$i == props.$maxI) && 'border-bottom: 0.05cqw solid #dbd668;'}

  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity, background 1s ease, border 0.15s ease;
  opacity: ${props => props.$transparency};
  &:hover {
   ${props => (props.$isPlacingGameSymbol && props.$isPlace || !props.$isPlacingGameSymbol)
        && `filter: brightness(1.2);`};
  }

  cursor: ${props => props.$isPlacingGameSymbol && props.$isPlace ? 'pointer' : props.$isOccupied ? 'help' : 'inherit'};

  &::before {
    ${props => props.$isPlayerCell && `content: '♥';`}
    font-size: 5.3cqw;
    color: #d8d5d5;
  }
`;

const BadgeElement = styled.div<{ $position: string; $color: string; $opacity: number }>`
  position: absolute;
  font-size: 0.9cqw;
  font-family: monospace;
  font-weight: bold;
  color: ${props => props.$color};
  opacity: ${props => props.$opacity};
  transition: opacity 1s ease-in-out;
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.7);
  padding: 0.05cqw 0.2cqw;
  border-radius: 0.15cqw;
  
  ${props => props.$position === 'top-left' && 'top: 0.2cqw; left: 0.2cqw;'}
  ${props => props.$position === 'top-right' && 'top: 0.2cqw; right: 0.2cqw;'}
  ${props => props.$position === 'bottom-left' && 'bottom: 0.2cqw; left: 0.2cqw;'}
  ${props => props.$position === 'bottom-right' && 'bottom: 0.2cqw; right: 0.2cqw;'}
`;

// This container perfectly clones your board's grid structure
const GridOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through to cells below */
  
  /* Mirroring your exact grid configuration */
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
`;

interface GameBoardComponentProps {
    rootGameStore: Game;
}

// TO-DO: spell movement enhancement: spell movement is digital/staccato and needs to be smooth and "analog"
// see if flex-order(i) allows for transition property and if so if it works horizontally and vertically
const GameBoardComponent = ({ rootGameStore }: GameBoardComponentProps) => {
    const snap = useSnapshot(rootGameStore);
    const isPlacingGameSymbol = !!snap.getGameSymbolIcon();
    const isDisabled = snap.gameBoard.getIsClickDisabled();
    const isHumanActivePlayer = !(snap.getActivePlayer() instanceof NPCPlayer);
    let numPlacementCells = snap.gameBoard.numPlacementCells;
    return (
        <BoardWrapper $isDisabled={isDisabled} $transparency={snap.gameBoard.getBoardTransparencyAmt()}>
            <GridOverlay>
                {snap.placedSpells.spells.map(
                    (_, i) =>
                        <SpellComponent spell={rootGameStore.placedSpells.spells[i]} />
                )}
            </GridOverlay>
            <GridContainer>
                {snap.gameBoard.cells.map((c,i) =>
                    <StyledCell
                        key={`${c.getCellIndex().i}_${c.getCellIndex().j}`}
                        data-click-type="board-cell"
                        $maxI={GameBoard.NUM_ROWS - 1}
                        $maxJ={snap.getActivePlayer().getDirection() == 1 ? numPlacementCells - 1 : GameBoard.NUM_COLS - 1}
                        $i={c.getCellIndex().i}
                        $j={c.getCellIndex().j}
                        $numPlacementCells={snap.gameBoard.numPlacementCells}
                        $isPlace={snap.isCanPlaceGameSymbolOn(c)}
                        $isHighlighted={
                            (isPlacingGameSymbol && isHumanActivePlayer &&
                                snap.isCanPlaceGameSymbolOn(c))
                                || c.getIsHighlighted()}
                        $spellOwnerColor={c.getColor()}
                        $isOccupied={!c.getIsFree()}
                        $isPlayerCell={c.getIsPlayerCell()}
                        $transparency={c.getTransparencyAmt()}
                        $isPlacingGameSymbol={isPlacingGameSymbol}
                        onMouseEnter={() => 
                            // rootGameStore.getIsHoverDisabled() && 
                            rootGameStore.setHoveredGameboardCell(c)}
                        onMouseLeave={() => rootGameStore.setHoveredGameboardCell(null)}
                        onClick={() => rootGameStore.placeSpellOnBoard(c)}
                    >
                        {/* {c.badges.map((b, bIdx) => {
                            const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                            // TO-DO: fix badges not showing. sometimes they show but only on CellIndex 0,0
                            // TO-DO: fix badges to show proper icons and values, with correct positions in the cell.
                            return (
                                <BadgeElement
                                    key={bIdx}
                                    $position={positions[bIdx]}
                                    $color={b.color}
                                    $opacity={1}//b.transparencyAmt}
                                >
                                    <span>{b.backgroundIcon}</span>
                                    {b.value !== 0 || b.isVisibleIfZero ? <span>{b.value}</span> : null}
                                </BadgeElement>
                            );
                        })} */}
                    </StyledCell>
                )}
            </GridContainer>
        </BoardWrapper>

    );
}

export default GameBoardComponent;