
import React from 'react';
import { GameBoardController } from '../DataClasses/GameBoard/GameBoardController';
import { NPCPlayer, Player } from '../DataClasses/Player/Player'
import styled from 'styled-components';
import { Game } from '../DataClasses/Game';

const GridContainer = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
  opacity: ${props => props.$transparency};
  transition: opacity 0.2s ease-in-out;
  margin-bottom:  12.5cqw;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

const StyledCell = styled.div<{
    $isPlace: boolean;
    $isHighlighted: boolean;
    $ownerColor?: string;
    $transparency: number;
}>`
  background: ${props => props.$isHighlighted ? '#ffffff' : '#d8d5d5'};
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
    background: #ffffff;// #2d3748;
  }

&::before {
    ${props => props.$ownerColor && !props.$isPlace && `content: '♥';`}
    font-size: 5.3cqw;
    color: #e7e5e5;
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

const CenterSpellToken = styled.div<{ $color: string }>`
  width: 3.2cqw;
  height: 3.2cqw;
  border-radius: 50%;
  background: ${props => props.$color};
  border: 0.15cqw solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1cqw;
  color: #fff;
  font-weight: bold;
  box-shadow: 0 0 0.8cqw ${props => props.$color};
  z-index: 2;
`;

{/* COMPACT INTERACTIVE FLYOUT LOGGER */ }
const GameBoardComponent = (rootGameStore: Game, gameBoard: GameBoardController, activePlayer: Player) => {

    return (<GridContainer $isDisabled={gameBoard.getIsClickDisabled()} $transparency={gameBoard.getBoardTransparencyAmt()}>
        {gameBoard.cells.map(c =>
            <StyledCell
                key={`${c.getCellIndex().i}_${c.getCellIndex().j}`}
                $isPlace={c.getIsPlaceCell(activePlayer)}
                $isHighlighted={c.getIsHighlighted()}
                $ownerColor={c.getColor()}
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
                    // TO-DO: fix below positions
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
    </GridContainer>);
}

export default GameBoardComponent;