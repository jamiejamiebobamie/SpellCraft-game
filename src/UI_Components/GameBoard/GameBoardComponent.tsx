
import React, { useState, useRef, useEffect, RefObject } from 'react';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import NpcSpellCanvasComponent from '../SpellCanvas/NpcSpellCanvasComponent';
import { Game } from '../../DataClasses/Game';
import { SpellBadgeComponent } from './SpellBadgeComponent';
import { HumanPlacementTilesComponent } from './HumanPlacementTilesComponent'
import { LockSymbolComponent } from './LockSymbolComponent';
import styled from 'styled-components';


// TO-DO: consider making all non-player placement cells fully transparent (with long opacity transition duration...) when board is not disabled
const BoardWrapper = styled.div<{ $transparency: number, $isDisabled: boolean }>`
  position: relative;
  bottom:  15.5cqw;
  opacity: ${props => props.$transparency};
  transition: opacity 1s ease-in-out;
  pointer-events: ${props => props.$isDisabled ? 'none' : 'auto'}
`;

type WobblePhase = -1 | 0 | 1;
const GridContainer = styled.div<{ $NUM_ROWS: number, $NUM_COLS: number, $wobblePhase: -1 | 0 | 1 }>`
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
  /* 1. LIQUID GLASS BACKGROUND & BLUR */
  /* Replaced opaque colors with semi-transparent ones to allow backdrop-filter to work */
  background: ${props => props.$empoweredSpellColor
        ? `color-mix(in oklab, rgba(255, 255, 255, 0.15), color-mix(in oklab, ${props.$empoweredSpellColor}, ${props.$spellOwnerColor}))`
        : props.$isPlayerCell
            ? 'rgba(235, 235, 240, 0.18)'
            : 'rgba(200, 200, 210, 0.12)'};

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
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$i == 0) && 'border-top: 0.05cqw solid rgba(219, 214, 104, 0.9); box-shadow: inset 0 2px 4px rgba(219, 214, 104, 0.3);'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ - props.$numPlacementCells + 1) && 'border-left: 0.05cqw solid rgba(219, 214, 104, 0.9);'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$j == props.$maxJ) && 'border-right: 0.05cqw solid rgba(219, 214, 104, 0.9);'}
  ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace && props.$i == props.$maxI) && 'border-bottom: 0.05cqw solid rgba(219, 214, 104, 0.9);'}

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
    ${props => (!props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace || !props.$isDisabled && !props.$isPlacingGameSymbol)
        && `
        filter: brightness(1.2);
        box-shadow: 
          inset 0 1px 2px rgba(255, 255, 255, 0.5),
          0 6px 16px rgba(0, 0, 0, 0.12);
      `};
  }

  cursor: ${props => !props.$isDisabled && props.$isPlacingGameSymbol && props.$isPlace ? 'pointer' : props.$isOccupied ? 'help' : 'inherit'};

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

//   &::before {
//     /* Kept your existing hearts code intact */
//     ${props => props.$isPlayerCell && `content: '♥';`}
//     font-size: 5.3cqw;
//     color: rgba(216, 213, 213, 0.85); /* Slightly transparent to integrate with glass look */
//     text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
//     z-index: 1; /* Pushes content above the gloss highlight gradient */
//   }
`;

interface GameBoardComponentProps {
    rootGameStore: Game;
    readonly snap: Game;
    gridOverlayRef: RefObject<HTMLDivElement | null>;
    npcMousePosRef?: RefObject<{ x: number, y: number } | null | undefined>;
}
const GameBoardComponent = ({ snap, rootGameStore, gridOverlayRef }: GameBoardComponentProps) => {
    const isPlayerDoingTurn: boolean = !snap.getIsHumanPlayerDoneWithTurn();
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
            <HumanPlacementTilesComponent rootGameStore={rootGameStore} />
            {npcMoveData.map((npcMd, i) => <NpcSpellCanvasComponent key={npcMd.id} rootGameStore={rootGameStore} i={i} />)}
            <GridContainer
                $NUM_ROWS={GameBoard.NUM_ROWS}
                $NUM_COLS={GameBoard.NUM_COLS}
                $wobblePhase={wobblePhase}>
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
                        $isHighlighted={
                            // (isPlayerDoingTurn && snap.isCanPlaceGameSymbolOn(c))
                            // || 
                            c.getIsHighlighted()}
                        $spellOwnerColor={c.getColor()}
                        // $empoweredSpellColor={c.getEmpoweredColor()}
                        $isOccupied={!c.getIsFree()}
                        // $isPlayerCell={c.getIsPlayerCell()}
                        $isDisabled={isDisabled}
                        $transparency={c.getTransparencyAmt()}
                        // $isPlacingGameSymbol={isPlayerDoingTurn}
                        // onMouseEnter={() =>
                            // rootGameStore.getIsHoverDisabled() && 
                            // rootGameStore.setHoveredGameboardCell(c)}
                        // onMouseLeave={() => rootGameStore.setHoveredGameboardCell(null)}
                        // onClick={() => rootGameStore.placeSpellOnBoard(c)}
                    >
                        {/* <SpellBadgeComponent
                            propertyName={''}
                            // TO-DO: consider roman numerals
                            propertyValue={c.getBadgeValues().updateOrder}
                            isDisplayBadgeCondition={(v: number) => true}
                            isAnim={false}
                            $right='.3cqw'
                            $bottom='.3cqw'
                            $backgroundColor='transparent'// 'grey'
                            $color='black'//'white'
                            $opacityCondition={v => !!v ? .85 : 0}
                        /> */}
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
                        {/* <SpellBadgeComponent
                            propertyName={'Category'}
                            // TO-DO: consider removing and basing on dmgHealth value... moves and consumptions decrease dmgHealth
                            propertyValue={c.getBadgeValues().gyreLives}
                            isDisplayBadgeCondition={(v: number) => v > 0}
                            $left='.3cqw'
                            $bottom='40%'
                            $backgroundColor='#ba913a'
                            $color='white'
                            $opacityCondition={v => !!v ? 1 : 0}
                        /> */}
                        {/* DMG HEALTH 
                            content: "\2605"; // Black Star
                            content: "\269D"; // Outlined White Star
                            content: "\2609"; // Sun <-- HEALING                       
                       */}
                        <SpellBadgeComponent
                            propertyName={c.getBadgeValues().dmgHealth < 0 ? 'Healing' : 'Damage'}
                            // TO-DO: consider representing as stars ... 1 star = 5dmgHealth. max 5 stars on spell.
                            // TO-DO: consider phlegms: pale green ____(s) vs pale yellow stars. - dmgHealth vs + dmgHealth
                            // phlegm currency vs ether, even exchange
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