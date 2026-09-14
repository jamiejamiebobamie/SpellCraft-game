import { Player } from "./Player";
import { InferenceString, NpcDifficulty } from '../types';
import { rootGameStore } from '../store';

export class NPCPlayer extends Player {
    readonly avatarHeadUrl: string = './player_avatars/Head2.png';
    readonly avatarRobeUrl: string = './player_avatars/Robe2a.png';
    readonly avatarBicepUrl: string = './player_avatars/Bicep2.png';

    difficulty: NpcDifficulty = 'Normal';

    constructor(direction: -1 | 1, color: string, avatarUrl: string) {
        super(direction, color, avatarUrl);
    }

    /*
    
      TO-DO:
      implement "combos".
      "combos" -> in a single turn, place lower priority spell on owner cell, place later priority spell "in front" to be consumed.
    
      COMBOS: (1) phlegm + phlegm = +2 heal for self
              (2) quicken + quicken = +4 speed
              (3) star + quicken = +2 speed +2 dmg
              (4) quicken + star = +2 speed +2 dmg
  
    */

    isRandomMove = (): boolean => {
        const rand = Math.random();
        switch (this.difficulty) {
            case 'Easy':
                return rand > 0.3;
            case 'Hard':
                return rand > 0.7;
            default: // 'Normal'
                return rand > 0.5;
        }
    }

    getNpcDifficulty = (): NpcDifficulty => {
        return this.difficulty;
    }

    setNpcDifficulty = (difficulty: NpcDifficulty): void => {
        this.difficulty = difficulty;
    }

    cycleThroughDifficulties = (): void => {
        const newDifficulty = this.difficulty == 'Normal' ? 'Hard' : this.difficulty == 'Easy' ? 'Normal' : 'Easy';
        this.setNpcDifficulty(newDifficulty);
    }

    getMove = (): [InferenceString, number?] => {
        const isHasFocus = this.focusAmt > 0;

        const i = rootGameStore.npcGetFutureSpellCollisionRow();
        const isIncomingSpell = i != -1;

        // SKIP
        if (!isHasFocus) {
            return ['SKIP']
        }

        // REFLECT spell BACK!
        // if (isIncomingSpell) {
        //   return ['circle', i];
        // }

        // SHIFT spell OFF COURSE!
        if (isIncomingSpell) {
            const GAME_SYMBOLS: Array<InferenceString> = ['circle']//'star']//'line']//'diamond']//, 'triangle']
            const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
            const inferenceString = GAME_SYMBOLS[rand];
            return [inferenceString, i];
        }

        // HEAL!
        // if (this.healthAmt < 4 && isHasFocus) {
        //   const healingRowIndex = this.gameBoard.npcGetHealingRow();
        //   return ['circle', healingRowIndex];
        // }


        // Do random damaging attack
        let GAME_SYMBOLS: Array<InferenceString> = ['star', 'line']//'diamond']//'triangle']//,'line', 'star']
        const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
        const inferenceString = GAME_SYMBOLS[rand];
        return [inferenceString];
    };

    getRandomMove = (): [InferenceString, number?] => {
        // SKIP
        if (this.focusAmt > 1) {
            return ['SKIP']
        }
        // Do random spell with chance of skip
        let GAME_SYMBOLS: Array<InferenceString> = ['line', 'circle', 'star', 'triangle', 'diamond', 'SKIP'];
        const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
        const inferenceString = GAME_SYMBOLS[rand];
        return [inferenceString];
    }

    doNextNpcMove = (): void => {
        const [inferenceString, cellRowIndex] = this.isRandomMove() ? this.getRandomMove() : this.getMove();
        if (inferenceString != 'SKIP') {
            const npcPlayer = rootGameStore.getNpcPlayer(); // required due to valtio proxy wrapper
            if (npcPlayer) {
                rootGameStore.instantiateGameSymbolFromInferenceString(inferenceString, npcPlayer)
                const cell = rootGameStore.getRandomPlacementCell(npcPlayer, cellRowIndex);
                if (cell) rootGameStore.placeSpellOnBoard(cell, npcPlayer);
            }
        }
    }
}