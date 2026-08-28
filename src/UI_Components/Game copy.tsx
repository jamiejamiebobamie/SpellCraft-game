
import React, { useState, useCallback, useEffect } from 'react';
import {
    GameLogEntry,
    Fizzle,
    GameSpell,
    Player,
    GameStateName,
    SPELL_BOUNDS,
} from './GameTypes';
import DuelistUI from './DuelistUI';
import GameLog from './GameLog';
import SpellCanvas from './SpellCanvas';
import GameBoard from './GameBoard';
import { rootGameStore, controls } from '../DataClasses/store';
import {  useSnapshot } from 'valtio';
import styled from 'styled-components';
import * as ort from 'onnxruntime-web';

export const conferModifierTo = (consumed: GameSpell, consumer: GameSpell): GameSpell => {
    const updated = { ...consumer };
    switch (consumed.subclass) {
        case 'Phlegm':
            updated.dmgHealth = Math.min(SPELL_BOUNDS.DAMAGE.max, updated.dmgHealth + 10);
            break;
        case 'Ether':
            const directionSign = Math.sign(updated.speedDirection);
            updated.speedDirection = Math.max(SPELL_BOUNDS.SPEED.min, Math.min(SPELL_BOUNDS.SPEED.max, updated.speedDirection + (directionSign * 1)));
            updated.dmgHealth = Math.min(SPELL_BOUNDS.DAMAGE.max, updated.dmgHealth + 5);
            break;
        case 'Gyre':
            updated.rowShift = Math.max(SPELL_BOUNDS.ROW_SHIFT.min, Math.min(SPELL_BOUNDS.ROW_SHIFT.max, updated.rowShift + 1));
            break;
        case 'Quicken':
            updated.updateOrder = Math.max(SPELL_BOUNDS.ORDER.min, updated.updateOrder - 1);
            break;
    }
    return updated;
};

export const executeSpellTurnCycle = (
    currentSpells: GameSpell[],
    numCols: number,
    numRows: number,
    onPlayerDamage: (targetPlayerId: number, dmg: number) => void,
    onLogMessage: (text: string, color: string) => void
): GameSpell[] => {

    let activeList = [...currentSpells].sort((a, b) => a.updateOrder - b.updateOrder);
    let resolvedList: GameSpell[] = [];

    for (let i = 0; i < activeList.length; i++) {
        let spell = activeList[i];
        if (!spell.cellIndex) continue;

        let currentPosJ = spell.cellIndex.j;
        let currentPosI = spell.cellIndex.i;
        const moves = Math.abs(spell.speedDirection);
        const directionSign = Math.sign(spell.speedDirection);
        let isTerminated = false;

        for (let step = 0; step < moves; step++) {
            currentPosJ += directionSign;

            if (step === 0 && spell.rowShift !== 0) {
                currentPosI = Math.max(0, Math.min(numRows - 1, currentPosI + spell.rowShift));
            }

            // Border Impact Check
            if (currentPosJ < 0 || currentPosJ >= numCols) {
                const opposingPlayerId = currentPosJ < 0 ? 1 : 2;
                onPlayerDamage(opposingPlayerId, spell.dmgHealth);
                onLogMessage(`💥 ${spell.name} crashed into Player ${opposingPlayerId}'s field zone, causing ${spell.dmgHealth} DMG!`, '#ff7675');
                isTerminated = true;
                break;
            }

            // Interior Grid Collision Checks
            let otherSpellIdx = resolvedList.findIndex(other => other.cellIndex?.i === currentPosI && other.cellIndex?.j === currentPosJ);
            let targetFromQueue = false;

            if (otherSpellIdx === -1) {
                otherSpellIdx = activeList.findIndex((other, oIdx) => oIdx > i && other.cellIndex?.i === currentPosI && other.cellIndex?.j === currentPosJ);
                if (otherSpellIdx !== -1) targetFromQueue = true;
            }

            if (otherSpellIdx !== -1) {
                const victim = targetFromQueue ? activeList[otherSpellIdx] : resolvedList[otherSpellIdx];
                onLogMessage(`🔮 Clash: ${spell.name} consumes ${victim.name} at [${currentPosI}, ${currentPosJ}]!`, '#f1c40f');

                spell = conferModifierTo(victim, spell);

                if (targetFromQueue) {
                    activeList.splice(otherSpellIdx, 1);
                } else {
                    resolvedList.splice(otherSpellIdx, 1);
                }
                if (targetFromQueue && otherSpellIdx <= i) i--;
            }
        }

        if (!isTerminated) {
            spell.cellIndex = { i: currentPosI, j: currentPosJ };
            resolvedList.push(spell);
        }
    }
    return resolvedList;
};

const GameWrapper = styled.div`
  margin: 0 auto; 
  width: 100%;
  min-width: 400px;
  max-width: 1200px;
  aspect-ratio: 16 / 9;
  container-type: inline-size;
  container-name: game-canvas;
  display: flex;
  flex-direction: row;
  background: #d5d2d2;// transparent;// #111111;
  user-select: none;
  overflow: hidden;
  position: relative;
  border: 0.15cqw solid #2d2d2d;
`;

const MainColumn = styled.div`
  flex: 2;
  background: transparent;// #1c1c1c;
  display: flex;
  flex-direction: column;
//   justify-content: space-between;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
`;

export const Game = () => {
    const NUM_ROWS = 3;
    const NUM_COLS = 7;
    const MAX_FIZZLES = 3;

    const [gameTurn, setGameTurn] = useState<number>(0);
    const [currentGameState, setCurrentGameState] = useState<GameStateName>('PlayerDrawSpell');
    const [logEntries, setLogEntries] = useState<GameLogEntry[]>([]);
    const [spells, setSpells] = useState<GameSpell[]>([]);

    const [isShowSpellCanvas, setIsShowSpellCanvas] = useState<boolean>(false);
    const [isHideGameBoard, setIsHideGameBoard] = useState<boolean>(false);

    const [isClickDisabled, setIsClickDisabled] = useState<boolean>(false);
    const [isHoverDisabled, setIsHoverDisabled] = useState<boolean>(false);

    const [players, setPlayers] = useState<Player[]>([
        { id: 1, name: "Caster Hero", avatarUrl: "DuelistAvatarPlaceholder.png", direction: 1, color: "#3498db", healthAmt: 100, maxHealth: 100, focusAmt: 4, maxFocus: 4, isTurn: true, fizzles: [] },
        { id: 2, name: "Nexus Boss", avatarUrl: "DuelistAvatarPlaceholder.png", direction: -1, color: "#e74c3c", healthAmt: 120, maxHealth: 120, focusAmt: 4, maxFocus: 4, isTurn: false, fizzles: [] }
    ]);

      const [session, setSession] = useState<ort.InferenceSession | null>(null);
    
      // Load the model locally from your public directory on mount
      useEffect(() => {
        async function loadModel() {
          try {
            const net = await ort.InferenceSession.create('./models/sequential7.onnx');
            setSession(net);
            console.log("Spell model loaded successfully!");
          } catch (e) {
            console.error("Failed to load ONNX model", e);
          }
        }
        loadModel();
      }, []);

    const clearAllLogEntries = useCallback(() => setLogEntries([]), []);
    const addLogEntry = useCallback((text: string, color: string) => {
        setLogEntries(prev => [{ id: crypto.randomUUID(), text, color }, ...prev]);
    }, []);

    const resetGame = useCallback(() => {
        setGameTurn(0);
        setCurrentGameState('PlayerDrawSpell');
        setSpells([]);
        setIsClickDisabled(false);
        setIsHoverDisabled(false);
        // setBoardTransparency(1.0); // HIDE/SHOW GAME BOARD
        setPlayers([
            { id: 1, name: "Caster Hero", avatarUrl: "DuelistAvatarPlaceholder.png", direction: 1, color: "#3498db", healthAmt: 100, maxHealth: 100, focusAmt: 4, maxFocus: 4, isTurn: true, fizzles: [{ id: crypto.randomUUID(), turnCreated: gameTurn, numTurnsUntilRemoved: 3 }, { id: crypto.randomUUID(), turnCreated: gameTurn, numTurnsUntilRemoved: 3 },] },
            { id: 2, name: "Nexus Boss", avatarUrl: "DuelistAvatarPlaceholder.png", direction: -1, color: "#e74c3c", healthAmt: 120, maxHealth: 120, focusAmt: 4, maxFocus: 4, isTurn: false, fizzles: [] }
        ]);
        setLogEntries([{ id: 'init', text: "Game loop reset. Draw phase activated.", color: "#2ecc71" }]);
    }, []);

    useEffect(() => { resetGame(); }, [resetGame]);

    const decrementHealth = useCallback((playerId: number, amount: number) => {
        setPlayers(prev => prev.map(p => {
            if (p.id !== playerId) return p;
            return { ...p, healthAmt: Math.max(0, Math.min(p.maxHealth, p.healthAmt - amount)) };
        }));
    }, []);

    const addFizzle = useCallback((playerId: number) => {
        setPlayers(prev => prev.map(p => {
            if (p.id !== playerId) return p;
            const newFizzle: Fizzle = { id: crypto.randomUUID(), turnCreated: gameTurn, numTurnsUntilRemoved: 3 };
            const updatedFizzles = [...p.fizzles, newFizzle];

            let currentHealth = p.healthAmt;
            let finalFizzles = updatedFizzles;

            if (updatedFizzles.length > MAX_FIZZLES) {
                currentHealth = Math.max(0, currentHealth - 20);
                finalFizzles = [];
                setTimeout(() => addLogEntry(`💥 BACKLASH! ${p.name} triggers a feedback explosion for 20 DMG!`, '#ff7675'), 0);
            }
            return { ...p, fizzles: finalFizzles, healthAmt: currentHealth };
        }));
    }, [gameTurn, addLogEntry]);

    const updatePlayerFizzles = useCallback(() => {
        setPlayers(prev => prev.map(p => {
            const activeFizzles = p.fizzles.filter(f => (gameTurn - f.turnCreated) < f.numTurnsUntilRemoved);
            return { ...p, fizzles: activeFizzles };
        }));
    }, [gameTurn]);

    const incrementGameTurn = useCallback(() => {
        setGameTurn(prev => prev + 1);

        setSpells(prevSpells =>
            executeSpellTurnCycle(
                prevSpells,
                NUM_COLS,
                NUM_ROWS,
                (targetId, dmg) => decrementHealth(targetId, dmg),
                (text, color) => addLogEntry(text, color)
            )
        );
        updatePlayerFizzles();
    }, [decrementHealth, addLogEntry, updatePlayerFizzles]);

    const p1 = players[0];
    const p2 = players[1];

    return (
        <GameWrapper onMouseDown={(e) => {
            if (e.button === 2) {
                addLogEntry("Right Click Canvas Logged", "#888");
                setIsShowSpellCanvas(isShow => !isShow);
            }
        }}>
            {isShowSpellCanvas && SpellCanvas(session)}
            {/* LEFT COLUMN: PLAYER */}
            <DuelistUI
                id={p1.id}
                name={p1.name}
                avatarUrl={p1.avatarUrl}
                direction={p1.direction}
                color={p1.color}
                healthAmt={p1.healthAmt}
                maxHealth={p1.maxHealth}
                maxFocus={p1.maxFocus}
                isTurn={p1.isTurn}
                focusAmt={p1.focusAmt}
                fizzles={p1.fizzles}
            />
            {/* CENTER COLUMN: CANVAS GRID MATRIX */}
            <MainColumn>
                <GameBoard
                    NUM_ROWS={NUM_ROWS}
                    NUM_COLS={NUM_COLS}
                    isHideGameBoard={isHideGameBoard}
                    spells={spells}
                    setSpells={setSpells}
                    addLogEntry={addLogEntry}
                />
                <GameLog logEntries={logEntries} />
            </MainColumn>
            {/* RIGHT COLUMN: ENEMY BOSS */}
            <DuelistUI
                id={p2.id}
                name={p2.name}
                avatarUrl={p2.avatarUrl}
                direction={p2.direction}
                color={p2.color}
                healthAmt={p2.healthAmt}
                maxHealth={p2.maxHealth}
                maxFocus={p2.maxFocus}
                isTurn={p2.isTurn}
                focusAmt={p2.focusAmt}
                fizzles={p2.fizzles}
            />
        </GameWrapper>
    );
};
