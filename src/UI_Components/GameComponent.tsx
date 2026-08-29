
import React, { useEffect, useState } from 'react';
import PlayerComponent from './PlayerComponent';
import SpellCanvasComponent from './SpellCanvasComponent';
import GameBoardComponent from './GameBoardComponent';
import GameLogComponent from './GameLogComponent';
import { rootGameStore, controls } from '../DataClasses/store';
import styled from 'styled-components';
import { Ether, Gyre, Phlegm, Quicken } from '../DataClasses/PlacedSpells/Spell';
import { useSnapshot } from 'valtio';

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
//   background: #d5d2d2;// transparent;// #111111;
  user-select: none;
  overflow: hidden;
  position: relative;
  border: 0.15cqw solid #2d2d2d;

    background-image: url('UI_mockup.png');
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
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

export const GameComponent = () => {

  // TESTING...
  const [count, setCount] = useState(0)
  const snap = useSnapshot(rootGameStore);

  // PLAYERS - - 
  const p1 = rootGameStore.players[0];
  const p2 = rootGameStore.players[1];

  // console.log(rootGameStore.players);

  const playerOneSnap = useSnapshot(rootGameStore.players[0]);
  const playerTwoSnap = useSnapshot(rootGameStore.players[1]);

  // - - - - - - 

  // SPELL CANVAS - - 
  const spellCanvas = rootGameStore.spellCanvas;
  const model = rootGameStore.model;
  // - - - - - - - - -

  // GAME LOG - - 
  const gameLog = rootGameStore.gameLog;
  const logEntries = rootGameStore.gameLog.logEntries;
  // - - - -  - - 

  // GAMEBOARD - - -
  const gameBoard = rootGameStore.gameBoard;
  const activePlayer = rootGameStore.gameContext.activePlayer; // current player who's turn it is
  const placedSpells = rootGameStore.placedSpells;
  // - - - - - - - -

  // useEffect(() => {
  //   const spells = [new Phlegm(p2, { i: 3, j: 3 }), new Gyre(p1, 1, { i: 0, j: 0 })];
  //   spells.forEach(s => placedSpells.addSpell(s));
  // }, []);

  // useEffect(() => {
  //   console.log({ placedSpells })
  // }, [placedSpells]);


  return (
    <GameWrapper onMouseDown={(e) => {

      // const [count, setCount] = useState(0)

      // setCount(c => {
      //   rootGameStore.gameLog.appendToLog(`Right Click Canvas Logged ${c + 1}`, "#888");
      //   if (c > 10) rootGameStore.clearLog();
      //   if (c % 3 == 0) {
      //     rootGameStore.enableGameBoard();
      //     // rootGameStore.spellCanvas.toggleShowCanvas();
      //   } else {
      //     rootGameStore.hideGameBoard();
      //     // rootGameStore.spellCanvas.toggleShowCanvas();
      //   }
      //   return c + 1
      // })

      // rootGameStore.spellCanvas.toggleShowCanvas();




      if (e.button === 2) {
        rootGameStore.appendToLog("Right Click Canvas Logged", "#888");
        rootGameStore.spellCanvas.toggleShowCanvas();
        console.log('right click!')
        spellCanvas.getIsShowCanvas() ? rootGameStore.hideGameBoard() : rootGameStore.enableGameBoard();
      }

      if(!spellCanvas.getIsShowCanvas() ){
      // console.log("heyehyheyheyeh")
      const spells = [
        new Phlegm(p2, { i: Math.floor(Math.random() * 3), j: Math.floor(Math.random() * 7) }),

        new Quicken(p2, { i: Math.floor(Math.random() * 3), j: Math.floor(Math.random() * 7) }),
        new Ether(p2, { i: Math.floor(Math.random() * 3), j: Math.floor(Math.random() * 7) }),

        new Gyre(p1, 1, { i: Math.floor(Math.random() * 3), j: Math.floor(Math.random() * 7) }),
        new Gyre(p1, -1, { i: Math.floor(Math.random() * 3), j: Math.floor(Math.random() * 7) }),

      ];
      spells.forEach(s => placedSpells.addSpell(s));

      // rootGameStore.players[0].decrementHealth(1);


      rootGameStore.updatePlayer(rootGameStore.players[0], 'decrementHealth', 1);

      rootGameStore.updatePlayer(rootGameStore.players[1], 'decrementHealth', 3);

      // rootGameStore.updatePlayer(rootGameStore.players[1], 'addFizzle', true);

      rootGameStore.updatePlayer(rootGameStore.players[0], 'decrementFocus', 1);

      rootGameStore.updatePlayer(rootGameStore.players[1], 'decrementFocus', 3);




      // updatePlayer = (
      //   player: Player, 
      //   action: 'decrementHealth' | 'decrementFocus' | 'setIsTurn', 
      //   param: number | boolean
      // ): void => {
      //   switch (action) {
      //     case 'decrementHealth':
      //       if (typeof param === 'number') player.decrementHealth(param);
      //       break;
      //     case 'decrementFocus':
      //       if (typeof param === 'number') player.decrementFocus(param);
      //       break;
      //     case 'setIsTurn':
      //       if (typeof param === 'boolean') player.setIsTurn(param, this.gameTurn);
      //       break;
      //   }
      // };

      // p1.decrementHealth(1);

      // p2.decrementFocus(1);
      // p2.addFizzle(1);

      // console.log({ playerOneSnap })

      }

    }}>
      {/* {snap.spellCanvas.getIsShowCanvas() && SpellCanvasComponent(spellCanvas, model)} */}
      {SpellCanvasComponent(rootGameStore, spellCanvas, model)}
      {/* LEFT COLUMN: PLAYER */}
      {/* TO-DO: resolve Typescript-only type error here */}
      {PlayerComponent(playerOneSnap)}
      {/* CENTER COLUMN: CANVAS GRID MATRIX */}
      <MainColumn>
        {GameBoardComponent(rootGameStore, gameBoard, activePlayer, placedSpells)}
        {GameLogComponent(rootGameStore.gameLog)}
      </MainColumn>
      {/* RIGHT COLUMN: NPC PLAYER ENEMY */}
      {/* TO-DO: resolve Typescript-only type error here */}
      {PlayerComponent(playerTwoSnap)}
    </GameWrapper>
  );
};
