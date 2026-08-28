
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    SpellSubclassType,
    GameSpell,
    BadgeState,
    CellIndex
} from './GameTypes';
import styled from 'styled-components';

const GridContainer = styled.div<{ $transparency: number }>`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
//   gap: 0.5cqw;
//   padding: 1.5cqw;
    // flex-grow: 1;
  opacity: ${props => props.$transparency};
  transition: opacity 0.2s ease-in-out;
  margin-bottom:  12.5cqw;
`;

//   /* ${props => props.$isPlace ? 'dashed' : 'solid'};


const StyledCell = styled.div<{
    $isPlace: boolean;
    $isHighlighted: boolean;
    $ownerColor?: string;
    $boardTransparency: number;
}>`
//   background: ${props => props.$isHighlighted ? '#2c3e50' : '#222222'};
  background: ${props => props.$isHighlighted ? '#ffffff' : '#d8d5d5'};
//   border: 0.15cqw solid ${props => props.$ownerColor || (props.$isPlace ? '#444444' : '#2d2d2d')};
  border: 0.05cqw solid;
//   border-radius: 0.5cqw;
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border 0.15s ease;
  opacity: ${props => props.$boardTransparency};
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

interface GameLogProps {
    NUM_ROWS: number;
    NUM_COLS: number;
    isHideGameBoard: boolean;
    spells: Array<GameSpell>;
    setSpells: React.Dispatch<React.SetStateAction<Array<GameSpell>>>;
    addLogEntry: Function;
};

{/* COMPACT INTERACTIVE FLYOUT LOGGER */ }
const GameBoard = ({
    NUM_ROWS,
    NUM_COLS,
    isHideGameBoard,
    spells,
    setSpells,
    addLogEntry
}: GameLogProps) => {

    const [hoveredCellIndex, setHoveredCellIndex] = useState<CellIndex | null>(null);

    useEffect(() => {
        setBoardTransparency(isHideGameBoard ? .2 : .7);
    }, [isHideGameBoard]);

    const [boardTransparency, setBoardTransparency] = useState<number>(0);

    // ============================================================================
    // 2. THE SPELL ENGINE SUBSYSTEM (PURE LOGIC WORKERS)
    // ============================================================================
    const createSpellBlueprint = useCallback((
        subclass: SpellSubclassType,
        casterId: number,
        startIndex: CellIndex | null
    ): GameSpell => {
        const baseData = {
            id: crypto.randomUUID(),
            casterId,
            cellIndex: startIndex,
        };

        switch (subclass) {
            case 'Phlegm':
                return { ...baseData, name: 'Phlegm Bolt', subclass: 'Phlegm', speedDirection: casterId === 1 ? 1 : -1, dmgHealth: 25, rowShift: 0, updateOrder: 2 };
            case 'Ether':
                return { ...baseData, name: 'Ether Pulse', subclass: 'Ether', speedDirection: casterId === 1 ? 2 : -2, dmgHealth: 15, rowShift: 0, updateOrder: 1 };
            case 'Gyre':
                return { ...baseData, name: 'Gyre Vortex', subclass: 'Gyre', speedDirection: casterId === 1 ? 1 : -1, dmgHealth: 10, rowShift: 1, updateOrder: 3 };
            case 'Quicken':
                return { ...baseData, name: 'Quicken Spark', subclass: 'Quicken', speedDirection: casterId === 1 ? 3 : -3, dmgHealth: 5, rowShift: -1, updateOrder: 4 };
        }
    }, []);

    const addSpellToBoard = useCallback((i: number, j: number, casterId: number) => {
        const pools: SpellSubclassType[] = ['Phlegm', 'Ether', 'Gyre', 'Quicken'];
        const randomSubclass = pools[Math.floor(Math.random() * pools.length)];
        const newSpell = createSpellBlueprint(randomSubclass, casterId, { i, j });

        setSpells(prev => [...prev, newSpell]);
        addLogEntry(`Spawned [${newSpell.subclass}] ${newSpell.name} at coordinates [${i}, ${j}]`, '#9b59b6');
    }, [addLogEntry]);

    const getCellProperties = (i: number, j: number) => {
        const isPlayerCell = j === 0 || j === NUM_COLS - 1;
        const isPlaceCell = !isPlayerCell && (j === 1 || j === 2 || j === 4 || j === 5);
        const cellOwnerId = j <= 2 ? 1 : (j >= 4 ? 2 : undefined);
        const ownerColor = cellOwnerId ? (cellOwnerId === 1 ? '#3498db' : '#e74c3c') : undefined;
        return { isPlayerCell, isPlaceCell, ownerColor };
    };

    const getBadgesForCell = (spell?: GameSpell): BadgeState[] => {
        if (!spell) return [];
        return [
            { type: 'DirectionSpeed', value: spell.speedDirection, isVisibleIfZero: true, transparencyAmt: 1.0, backgroundIcon: '➡️', color: '#f1c40f' },
            { type: 'DmgHealth', value: spell.dmgHealth, isVisibleIfZero: true, transparencyAmt: 1.0, backgroundIcon: '❤️', color: '#e74c3c' },
            { type: 'UpdateOrder', value: spell.updateOrder, isVisibleIfZero: false, transparencyAmt: 0.8, backgroundIcon: '🔢', color: '#9b59b6' },
            { type: 'RowShift', value: spell.rowShift, isVisibleIfZero: false, transparencyAmt: 0.6, backgroundIcon: '↕️', color: '#2ecc71' }
        ];
    };

    // const hoveredSpellPath = Array<CellIndex>;
    // useMemo(() => {
    //     if (!hoveredCellIndex?.i) return [];
    //     const hoveredSpell = spells.find(s => s.cellIndex?.i === hoveredCellIndex.i && s.cellIndex?.j === hoveredCellIndex.j);

    //     const speedDirection = activeSpell?.speedDirection;

    // }, [hoveredCellIndex])

    return (<GridContainer $transparency={boardTransparency}>
        {Array.from({ length: NUM_ROWS }).map((_, i) => (
            Array.from({ length: NUM_COLS }).map((_, j) => {
                const { isPlayerCell, isPlaceCell, ownerColor } = getCellProperties(i, j);
                const activeSpell = spells.find(s => s.cellIndex?.i === i && s.cellIndex?.j === j);
                const cellBadges = getBadgesForCell(activeSpell);

                const isHovered = hoveredCellIndex?.i == i && hoveredCellIndex?.j == j;
                const isHighlighted = isHovered;// || hoveredSpellPath.find((c: CellIndex) => c.i == i && c.j == j);
                return (
                    <StyledCell
                        key={`${i}-${j}`}
                        $isPlace={isPlaceCell}
                        $isHighlighted={isHighlighted}
                        $ownerColor={ownerColor}
                        $boardTransparency={boardTransparency}
                        onMouseEnter={() => setHoveredCellIndex({ i, j })}
                        onMouseLeave={() => setHoveredCellIndex(null)}
                        onClick={() => {
                            // if (isClickDisabled) return;
                            if (isPlaceCell && !activeSpell) addSpellToBoard(i, j, j <= 2 ? 1 : 2);
                        }}
                    >
                        {cellBadges.map((badge, bIdx) => {
                            const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                            return (
                                <BadgeElement
                                    key={bIdx}
                                    $position={positions[bIdx]}
                                    $color={badge.color}
                                    $opacity={badge.transparencyAmt}
                                >
                                    <span>{badge.backgroundIcon}</span>
                                    {badge.value !== 0 || badge.isVisibleIfZero ? <span>{badge.value}</span> : null}
                                </BadgeElement>
                            );
                        })}

                        {activeSpell && (
                            <CenterSpellToken $color={activeSpell.casterId === 1 ? '#3498db' : '#e74c3c'}>
                                {activeSpell.subclass === 'Phlegm' && '🟢'}
                                {activeSpell.subclass === 'Ether' && '✨'}
                                {activeSpell.subclass === 'Gyre' && '🌀'}
                                {activeSpell.subclass === 'Quicken' && '⚡'}
                            </CenterSpellToken>
                        )}
                    </StyledCell>
                );
            })
        ))}
    </GridContainer>);
}

export default GameBoard;