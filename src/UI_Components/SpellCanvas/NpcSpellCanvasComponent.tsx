
import React, { useState, useRef, useMemo, RefObject } from 'react';
import AutomaticSpellCanvasComponent from './AutomaticSpellCanvasComponent';
import { HARDCODED_SYMBOLS } from '../../DataClasses/PlacedSpells/HardCodedSymbols';
import { Point } from '../../DataClasses/types';
import styled from 'styled-components';
import { useSnapshot } from 'valtio';
import { GameBoard } from '../../DataClasses/GameBoard/GameBoard';
import { rootGameStore } from '../../DataClasses/store';


const SpellCanvasWrapper = styled.div<{ $isShow: boolean, $top: number, $left: number, $cellWidth: number, $scale: Point, $rotation: number, $translation: Point | null }>`
  position: absolute;
  ${props => `top: ${props.$top}px; left: ${props.$left}px; width: ${props.$cellWidth * props.$scale.x}px; height: ${props.$cellWidth * props.$scale.y}px;`}
  opacity: ${props => props.$isShow ? 1 : 0};
  transition: transform 3s ease-out, opacity 1s ease-in-out;
  pointer-events: none;
  z-index: 42;
  display: flex;
  align-self: center;
  transform-origin: center center;
  transform: ${props=> props.$translation ? `translate(${props.$translation.x}px, ${props.$translation.y}px)` : `rotate(${props.$rotation}deg)`};
  will-change: transform;
`;

interface NpcSpellCanvasComponentProps { i: number }
const NpcSpellCanvasComponent = ({ i }: NpcSpellCanvasComponentProps) => {
    const ref = useRef<HTMLDivElement | null>(null);
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
    const cellWidth: number = snap.getCellWidth() || 0;
    const npcPlacementCellsX: number = useMemo(() => cellWidth * (GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS), [cellWidth]);
    const normalizedPoints: Array<Point> | undefined = HARDCODED_SYMBOLS.get(inferenceString);
    const [isVisible, setIsVisible] = useState<boolean>(true);
    const [translation, setTranslation] = useState<Point | null>(null);
    const timeoutRef = useRef<number>(0);
    return (
        <SpellCanvasWrapper
            ref={ref}
            $isShow={isVisible}
            $cellWidth={cellWidth}
            $scale={scale}
            $top={height * translationNorm.y}
            $left={npcPlacementCellsX + GameBoard.NUM_PLACEMENT_CELLS * cellWidth * translationNorm.x}
            $rotation={rotation}
            $translation={translation}
        >
            <AutomaticSpellCanvasComponent
                points={normalizedPoints || []}
                drawSpeed={speed}
                isLooped={false}
                callBack={(progressRef: RefObject<number>) => {
                    if (!progressRef || !progressRef.current) return;
                    const isDone = progressRef.current >= 1;

                    if (isDone) {
                        !timeoutRef.current && storedSpell && storedSpell();
                        timeoutRef.current = setTimeout(() => {
                            if (ref && ref.current) {
                                const rect = ref.current.getBoundingClientRect();
                                const x = rect.left + (rect.width/2) - window.innerWidth;
                                const y =  rect.top + (rect.height/2) -  (window.innerHeight / 2);
                                setTranslation({ x:x/5, y: y/5 });
                                setIsVisible(false);
                            }
                        }, 0);
                    } else {
                        const points = rootGameStore.getNpcDrawingPoints();
                        if (points && points.length) {
                            const i = Math.floor(points.length * progressRef.current)
                            const mousePos = points[i];
                            rootGameStore.setNpcMousePos(mousePos);
                        }
                    }
                }} />
        </SpellCanvasWrapper>
    );
}

export default NpcSpellCanvasComponent;