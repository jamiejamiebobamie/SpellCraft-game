
import React from 'react';
import PlayerComponent from './PlayerComponent';
import GameLog from './GameLog';
import SpellCanvasComponent from './SpellCanvasComponent';
import GameBoardComponent from './GameBoardComponent';
import { rootGameStore, controls } from '../DataClasses/store';
import styled from 'styled-components';

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
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
`;

export const Game = () => {
    // PLAYERS - - 
    const p1 = rootGameStore.players[0];
    const p2 = rootGameStore.players[1];
    // - - - - - - 

    // SPELL CANVAS - - 
    const spellCanvas = rootGameStore.spellCanvas;
    const model = rootGameStore.model;
    const isShowSpellCanvas = spellCanvas.getIsShowCanvas();
    // - - - - - - - - -

    // GAME LOG - - 
    const gameLog = rootGameStore.gameLog;
    const logEntries = rootGameStore.gameLog.logEntries;
    // - - - -  - - 

    // GAMEBOARD - - -
    const gameBoard = rootGameStore.gameBoard;
    const activePlayer = rootGameStore.gameContext.activePlayer; // current player who's turn it is
    // - - - - - - - -

    return (
        <GameWrapper onMouseDown={(e) => {
            if (e.button === 2) {
                gameLog.appendEntry("Right Click Canvas Logged", "#888");
                spellCanvas.toggleShowCanvas();
            }
        }}>
            {isShowSpellCanvas && SpellCanvasComponent(spellCanvas, model)}
            {/* LEFT COLUMN: PLAYER */}
            {PlayerComponent(p1)}
            {/* CENTER COLUMN: CANVAS GRID MATRIX */}
            <MainColumn>
                {GameBoardComponent(rootGameStore, gameBoard, activePlayer)}
                {GameLog(logEntries)}
            </MainColumn>
            {/* RIGHT COLUMN: ENEMY BOSS */}
            {PlayerComponent(p2)}
        </GameWrapper>
    );
};
