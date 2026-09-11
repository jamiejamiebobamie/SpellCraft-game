
import React, { useState, useRef, useEffect } from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { Game } from '../../DataClasses/Game';
import { SpellComponent } from './SpellComponent';
import { SpellBadgeComponent } from './SpellBadgeComponent';
import styled from 'styled-components';

const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  18cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 1s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

type WobblePhase = -1 | 0 | 1;
const GridContainer = styled.div<{ $wobblePhase: -1 | 0 | 1 }>`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
  
  /* The transition will smoothly catch the transform whenever the state changes */
  transition: transform ${props => props.$wobblePhase != 0 ? 1 : .25}s ease-in-out;
  transform: skewX(${props => props.$wobblePhase * 6}deg);
`;

const StyledCell = styled.div<{
    $isPlace: boolean;
    $isHighlighted: boolean;
    $isDisabled: boolean;
    $spellOwnerColor?: string;
    $empoweredSpellColor?: string;
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
 background-color: ${props => props.$empoweredSpellColor ? `color-mix(in oklab, ${props.$empoweredSpellColor}, ${props.$spellOwnerColor})` : props.$isPlayerCell ? '#bcb9b943' : '#c7c2c23c'};
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

interface GameBoardComponentProps {
    rootGameStore: Game;
    readonly snap: Game;
}

const GameBoardComponent = ({ snap, rootGameStore }: GameBoardComponentProps) => {
    const gridOverlayRef = useRef<HTMLDivElement | null>(null);
    const isPlacingGameSymbol: boolean = !!snap.getGameSymbolIcon();
    const isDisabled: boolean = snap.gameBoard.getIsClickDisabled();
    let numPlacementCells = snap.gameBoard.numPlacementCells;
    const intervalRef = useRef<number | undefined>(undefined);
    const [wobblePhase, setWobblePhase] = useState<WobblePhase>(0);
    useEffect(() => {
        if (isDisabled) {
            setWobblePhase(1);
            intervalRef.current = setInterval(() => {
                setWobblePhase(wp => wp == 1 ? -1 : 1);
            }, 1000);
        } else {
            setWobblePhase(0);
            clearInterval(intervalRef.current);
        }
    }, [isDisabled]);
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
            <GridContainer $wobblePhase={wobblePhase}>
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
                        $empoweredSpellColor={c.getEmpoweredColor()}
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
                        <SpellBadgeComponent
                            propertyName={''}
                            propertyValue={c.getBadgeValues().updateOrder}
                            isDisplayBadgeCondition={(v: number) => true}
                            isAnim={false}
                            $right='.3cqw'
                            $bottom='.3cqw'
                            $backgroundColor='transparent'// 'grey'
                            $color='black'//'white'
                            $opacityCondition={v => !!v ? .85 : 0}
                        />
                        {/* SPEED DIRECTION 
                                speedDirection: number = 0; // horizontal movement amt, positive = right, negative = left, '0' is not valid.
                                content: "\21A4"; // Left Arrow from Bar
                                content: "\21A6"; // Right Arrow from Bar
                                content: "\27A2"; // Three-D Top-Lighted Right Arrowhead
                                content: "\27A3"; // Three-D Bottom-Lighted Right Arrowhead
                        */}
                        <SpellBadgeComponent
                            propertyName={'Speed'}
                            propertyValue={c.getBadgeValues().speedDirection}
                            isDisplayBadgeCondition={(v: number) => Math.abs(v) > 1}
                            $left='.3cqw'
                            $top='.3cqw'
                            $backgroundColor='#57d1ea'
                            $color='white'
                            $opacityCondition={v => !!v ? 1 : 0}
                        />
                        {/* GYRE LIVES 
                                gyreLives: number = 3; // Gyre specific property
                                content: "\2619"; // Reversed Rotated Floral Heart Bullet
                                content: "\2661"; // White Heart Suit
                                content: "\2665"; // Black Heart Suit
                        */}
                        <SpellBadgeComponent
                            propertyName={'Category'}
                            propertyValue={c.getBadgeValues().gyreLives}
                            isDisplayBadgeCondition={(v: number) => v > 0}
                            $left='.3cqw'
                            $bottom='40%'
                            $backgroundColor='#ba913a'
                            $color='white'
                            $opacityCondition={v => !!v ? 1 : 0}
                        />
                        {/* DMG HEALTH 
                            content: "\2605"; // Black Star
                            content: "\269D"; // Outlined White Star
                            content: "\2609"; // Sun <-- HEALING                       
                       */}
                        <SpellBadgeComponent
                            propertyName={c.getBadgeValues().dmgHealth < 0 ? 'Healing' : 'Damage'}
                            propertyValue={c.getBadgeValues().dmgHealth}
                            isDisplayBadgeCondition={(v: number) => Math.abs(v) > 1}
                            $left='.3cqw'
                            $bottom='.3cqw'
                            $backgroundColor={c.getBadgeValues().dmgHealth > 0 ? '#752020' : c.getBadgeValues().dmgHealth < 0 ? '#1e7b5e' : 'transparent'}
                            $color='white'
                            $opacityCondition={v => !!v ? 1 : 0}
                        />
                    </StyledCell>
                )}
            </GridContainer>
        </BoardWrapper>

    );
}

export default GameBoardComponent;