
import React, { useState, useRef, useEffect, RefObject } from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import NpcSpellCanvasComponent from '../SpellCanvas/NpcSpellCanvasComponent';
import { SpellBadgeComponent } from './SpellBadgeComponent';
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
    $isPlace: boolean;
    $isHighlighted: boolean;
    $isDisabled: boolean;
    $spellOwnerColor?: string;
    $transparency: number;
    $i: number;
    $j: number;
    $maxI: number;
    $maxJ: number;
    $numPlacementCells: number;
    $isOccupied: boolean;
}>`
  /* 1. LIQUID GLASS BACKGROUND & BLUR */
  /* Replaced opaque colors with semi-transparent ones to allow backdrop-filter to work */
  background: rgba(200, 200, 210, 0.12);

  /* The magic property: creates the refractive thick-glass distortion */
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);

  /* 2. REFRACED GLASS BORDERS & DEPTH */
  /* A very thin white-tinted border that acts as a shining edge highlight */
  border: 0.05cqw solid rgba(255, 255, 255, 0.35);
  box-shadow: 
    inset 0 1px 1px rgba(255, 255, 255, 0.4),    /* Top inner light reflection */
    inset 0 -1px 1px rgba(0, 0, 0, 0.1),         /* Bottom inner grounding shadow */
    0 4px 12px rgba(0, 0, 0, 0.08);              /* Subtle ambient shadow onto elements below */

  /* Game logic positioning borders (making them slightly emissive/neon glass) */
  ${props => (!props.$isDisabled && props.$isPlace && props.$i == 0) && 'border-top: 0.05cqw solid rgba(219, 214, 104, 0.9); box-shadow: inset 0 2px 4px rgba(219, 214, 104, 0.3);'}
  ${props => (!props.$isDisabled && props.$isPlace && props.$j == props.$maxJ - props.$numPlacementCells + 1) && 'border-left: 0.05cqw solid rgba(219, 214, 104, 0.9);'}
  ${props => (!props.$isDisabled && props.$isPlace && props.$j == props.$maxJ) && 'border-right: 0.05cqw solid rgba(219, 214, 104, 0.9);'}
  ${props => (!props.$isDisabled && props.$isPlace && props.$i == props.$maxI) && 'border-bottom: 0.05cqw solid rgba(219, 214, 104, 0.9);'}

  /* Layout and Sizing */
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* Keeps the gloss reflection element contained */
  
  /* Transitions */
  transition: opacity 1s ease, background 0.3s ease, border 0.15s ease, filter 0.2s ease, box-shadow 0.2s ease;
  opacity: .1;
  //${props => props.$transparency}; // TESTING

  /* 3. ENVIRONMENTAL GLASS HOVER EFFECT */
  ${props => props.$isHighlighted && `
    filter: brightness(1.25);
    box-shadow: 
      inset 0 1px 2px rgba(255, 255, 255, 0.6),
      0 0 15px rgba(255, 255, 255, 0.2);
  `}

  &:hover {
    ${props => (!props.$isDisabled && props.$isPlace || !props.$isDisabled)
        && `
        filter: brightness(1.2);
        box-shadow: 
          inset 0 1px 2px rgba(255, 255, 255, 0.5),
          0 6px 16px rgba(0, 0, 0, 0.12);
      `};
  }

  cursor: ${props => !props.$isDisabled && props.$isPlace ? 'pointer' : props.$isOccupied ? 'help' : 'inherit'};

  /* 4. GLOSS SHIMMER LAYER (Liquid Surface Aspect) */
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
            <LockSymbolComponent isLocked={isDisabled} />
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
                        $isPlace={snap.isCanPlaceGameSymbolOn(c)}
                        $isHighlighted={c.getIsHighlighted()}
                        $spellOwnerColor={c.getColor()}
                        $isOccupied={!c.getIsFree()}
                        $isDisabled={isDisabled}
                        $transparency={c.getTransparencyAmt()}
                    >
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