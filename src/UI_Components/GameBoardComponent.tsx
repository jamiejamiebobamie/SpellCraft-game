
import React from 'react';
import { GameBoard } from '../DataClasses/GameBoard/GameBoard';
import { NPCPlayer, Player } from '../DataClasses/Player/Player'
import { PlacedSpellsComponent } from './PlacedSpellsComponent';
import styled from 'styled-components';
import { Game } from '../DataClasses/Game';
import { PlacedSpells } from '../DataClasses/PlacedSpells/PlacedSpells';
import { useSnapshot } from 'valtio';

const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  12.5cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 0.2s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

const GridContainer = styled.div<{ $transparency: number, $isDisabled: boolean }>`
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
}>`
  background: ${props => props.$isHighlighted ? '#ffffff' : props.$isPlayerCell ? '#686868' : '#d8d5d5'};
  border: 0.05cqw solid;
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border 0.15s ease;
  opacity: ${props => props.$transparency};
  &:hover {
    background: #2d3748;// #ffffff;// #2d3748;
  }

&::before {
    ${props => props.$isPlayerCell && `content: '♥';`}
    font-size: 5.3cqw;
    color: #d8d5d5; // #676565;
  }
`;

const BadgeElement = styled.div<{ $position: string; $color: string; $opacity: number }>`
  position: absolute;
  font-size: 0.9cqw;
  font-family: monospace;
  font-weight: bold;
  color: ${props => props.$color};
  opacity: ${props => props.$opacity};
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

const GameBoardComponent = (rootGameStore: Game, gameBoard: GameBoard, activePlayer: Player, placedSpells: PlacedSpells) => {
    // TO-DO: fix badges not showing. sometimes they show but only on CellIndex 0,0
    // TO-DO: fix badges to show proper icons and values, with correct positions in the cell.
    const gameBoardSnap = useSnapshot(gameBoard);
    const isDisabled = gameBoardSnap.getIsClickDisabled();
    return (
        <BoardWrapper  $isDisabled={isDisabled} $transparency={gameBoardSnap.getBoardTransparencyAmt()}>
            {PlacedSpellsComponent(placedSpells)}
            <GridContainer $isDisabled={isDisabled} $transparency={gameBoardSnap.getBoardTransparencyAmt()}>
                {gameBoard.cells.map(c =>
                    <StyledCell
                        key={`${c.getCellIndex().i}_${c.getCellIndex().j}`}
                        $isPlace={c.getIsPlaceCell(activePlayer)}
                        $isHighlighted={c.getIsHighlighted()}
                        $spellOwnerColor={c.getColor()}
                        $isPlayerCell={c.getIsPlayerCell()}
                        $transparency={c.getTransparencyAmt()}
                        onMouseEnter={() => gameBoard.getIsHoverDisabled() && gameBoard.hoverCell(c)}
                        onMouseLeave={() => gameBoard.hoverCell(null)}
                        onClick={() => {
                            if (c.getIsPlaceCell(activePlayer) && c.getIsFree()
                                && !(activePlayer instanceof NPCPlayer) // TESTING
                            ) {
                                rootGameStore.placeSpellOnBoard(c.getCellIndex())
                            }
                        }}
                    >
                        {c.badges.map((b, bIdx) => {
                            const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                            return (
                                <BadgeElement
                                    key={bIdx}
                                    $position={positions[bIdx]}
                                    $color={b.color}
                                    $opacity={b.transparencyAmt}
                                >
                                    <span>{b.backgroundIcon}</span>
                                    {b.value !== 0 || b.isVisibleIfZero ? <span>{b.value}</span> : null}
                                </BadgeElement>
                            );
                        })}
                    </StyledCell>
                )}
            </GridContainer>
        </BoardWrapper>

    );
}

export default GameBoardComponent;