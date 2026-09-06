
import React, { useRef } from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { Game } from '../../DataClasses/Game';
import { SpellComponent } from './SpellComponent';
import { useSnapshot } from 'valtio';
import styled, { css, keyframes } from 'styled-components';

const skewWobble = keyframes`
  0%, 1% {
    transform: skewX(-4deg);      /* Sliding fast through the center... */
  }
  53%, 55% {
    transform: skewX(4deg);      /* Slides right back through the center without stopping */
  }
  99%,100% {
    transform: skewX(-4deg);      /* Drops back to center to complete the wave loop */
  }
`;

const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  18cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 1s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

const GridContainer = styled.div<{ $isWobbling: boolean }>`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
    ${props =>
        props.$isWobbling &&
        css`
      animation: ${skewWobble} 5s ease-in-out infinite;
    `}
`;

const StyledCell = styled.div<{
    $isPlace: boolean;
    $isHighlighted: boolean;
    $isDisabled: boolean;
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
  background: ${props => props.$isPlayerCell ? '#bcb9b943' : '#c7c2c23c'};
  ${props => props.$isHighlighted && `filter: brightness(1.1);`}
  border: 0.05cqw solid;
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$i == 0) && 'border-top: 0.05cqw solid #dbd668;'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ - props.$numPlacementCells + 1) && 'border-left: 0.05cqw solid #dbd668;'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ) && 'border-right: 0.05cqw solid #dbd668;'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$i == props.$maxI) && 'border-bottom: 0.05cqw solid #dbd668;'}

  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity, background 1s ease, border 0.15s ease;
  opacity: ${props => props.$transparency};
  &:hover {
   ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace || !props.$isDisabled && !props.$isPlacingGameSymbol)
        && `filter: brightness(1.2);`};
  }

  cursor: ${props => !props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace ? 'pointer' : props.$isOccupied ? 'help' : 'inherit'};

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


interface GameBoardComponentProps {
    rootGameStore: Game;
    readonly snap: Game;
}

const GameBoardComponent = ({ snap, rootGameStore }: GameBoardComponentProps) => {
    const gridOverlayRef = useRef<HTMLDivElement | null>(null);
    // const snap = useSnapshot<Game>(rootGameStore);
    const isPlacingGameSymbol: boolean = !!snap.getGameSymbolIcon();
    const isDisabled: boolean = snap.gameBoard.getIsClickDisabled();
    let numPlacementCells = snap.gameBoard.numPlacementCells;
    return (
        <BoardWrapper ref={gridOverlayRef} $isDisabled={isDisabled} $transparency={snap.gameBoard.getBoardTransparencyAmt()}>
            {snap.placedSpells.spells.map(
                (s, i) =>
                    <SpellComponent
                        key={s.id}
                        gridOverlayRef={gridOverlayRef}
                        spell={rootGameStore.placedSpells.spells[i]}
                    />
            )}
            <GridContainer $isWobbling={isDisabled}>
                {snap.gameBoard.cells.map(c =>
                    <StyledCell
                        key={c.id}
                        data-click-type="board-cell"
                        $maxI={GameBoard.NUM_ROWS - 1}
                        $maxJ={snap.getActivePlayer().getDirection() == 1 ? numPlacementCells - 1 : GameBoard.NUM_COLS - 1}
                        $i={c.getCellIndex().i}
                        $j={c.getCellIndex().j}
                        $numPlacementCells={snap.gameBoard.numPlacementCells}
                        $isPlace={snap.isCanPlaceGameSymbolOn(c)}
                        $isHighlighted={
                            (isPlacingGameSymbol && snap.isCanPlaceGameSymbolOn(c))
                            || c.getIsHighlighted()}
                        $spellOwnerColor={c.getColor()}
                        $isOccupied={!c.getIsFree()}
                        $isPlayerCell={c.getIsPlayerCell()}
                        $isDisabled={isDisabled}
                        $transparency={c.getTransparencyAmt()}
                        $isPlacingGameSymbol={isPlacingGameSymbol}
                        onMouseEnter={() =>
                            // rootGameStore.getIsHoverDisabled() && 
                            rootGameStore.setHoveredGameboardCell(c)}
                        onMouseLeave={() => rootGameStore.setHoveredGameboardCell(null)}
                        onClick={() => rootGameStore.placeSpellOnBoard(c)}
                    >
                        {/* {c.badges.map((b, i) => {
                            const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                            // TO-DO: fix badges not showing. sometimes they show but only on CellIndex 0,0
                            // TO-DO: fix badges to show proper icons and values, with correct positions in the cell.
                            return (
                                <BadgeElement
                                    key={b.id}
                                    $position={positions[i]}
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