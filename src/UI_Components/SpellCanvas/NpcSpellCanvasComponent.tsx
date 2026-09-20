
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AutomaticSpellCanvasComponent from './AutomaticSpellCanvasComponent';
import { HARDCODED_SYMBOLS } from '../../DataClasses/PlacedSpells/HardCodedSymbols';
import { Point } from '../../DataClasses/types';
import { Game } from '../../DataClasses/Game';
import styled from 'styled-components';
import { useSnapshot } from 'valtio';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';

const SpellCanvasWrapper = styled.div<{ $isShow: boolean, $top: number, $left: number, $cellWidth: number, $scale: Point, $rotation: number }>`
  position: absolute;
  ${props => `top: ${props.$top}px; left: ${props.$left}px; width: ${props.$cellWidth * props.$scale.x}px; height: ${props.$cellWidth * props.$scale.y}px;`}
  opacity: ${props => props.$isShow ? 1 : 0};
  transition: opacity 5s ease-in-out;
  pointer-events: none;
  z-index: 42;
  display: flex;
  align-self: center;
  transform-origin: center center;

  transform: rotate(${props => props.$rotation}deg);

`;

interface NpcSpellCanvasComponentProps { rootGameStore: Game; i: number }
const NpcSpellCanvasComponent = ({ rootGameStore, i }: NpcSpellCanvasComponentProps) => {
    const snap = useSnapshot(rootGameStore);
    const { inferenceString, scale, rotation, translationNorm, storedSpell, speed } = snap.getNPCMoveDatum(i) || {
        inferenceString: '',
        translationNorm: { x: 0, y: 0 },
        scale: { x: 0, y: 0 },
        rotation: 0,
        storedSpell: () => { },
        speed: 1
    };
    const { height } = snap.getBoardRefDimensions()
    const cellWidth = snap.getCellWidth() || 0;
    const npcPlacementCellsX = useMemo(() => cellWidth * (GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS), [cellWidth]);
    const normalizedPoints = HARDCODED_SYMBOLS.get(inferenceString);
    const [isVisible, setIsVisible] = useState(true);
    const timeoutRef = useRef<number>(0);
    useEffect(() => { return () => clearTimeout(timeoutRef.current) })
    return (
        <SpellCanvasWrapper
            $isShow={isVisible}
            $cellWidth={cellWidth}
            $scale={scale}
            $top={height * translationNorm.y}
            $left={npcPlacementCellsX + GameBoard.NUM_PLACEMENT_CELLS * cellWidth * translationNorm.x}
            $rotation={rotation}
        >
            <AutomaticSpellCanvasComponent
                points={normalizedPoints || []}
                drawSpeed={speed}
                isLooped={false}
                callBack={(progress: number) => {
                    const isDone = progress >= 1;
                    if (isDone) {
                        storedSpell && storedSpell();
                        timeoutRef.current = setTimeout(() => {
                            setIsVisible(false);
                        }, 3000);
                    } else {
                        const points = rootGameStore.getNpcDrawingPoints();
                        console.log({ points })
                        if (points && points.length) {
                            const i = Math.floor(points.length * progress)
                            const mousePos = points[i];
                            rootGameStore.setNpcMousePos(mousePos);
                        }
                    }
                }} />
        </SpellCanvasWrapper>
    );
}

export default NpcSpellCanvasComponent;