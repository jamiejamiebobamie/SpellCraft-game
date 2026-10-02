import { Player } from "./Player";
import { InferenceString, NpcDifficulty, NPCMoveData, Point } from '../types';
import { rootGameStore } from '../store';
import { proxy } from "valtio";

export class NPCPlayer extends Player {
    readonly avatarHeadUrl: string = './player_avatars/Head2.png';
    readonly avatarRobeUrl: string = './player_avatars/Robe2a.png';
    readonly avatarBicepUrl: string = './player_avatars/Bicep2.png';

    difficulty: NpcDifficulty = 'Normal';

    drawingPoints: Array<Point> = proxy([]);
    npcMousePos: Point = { x: 0, y: 0 };
    numRemainingMovesPerTurn: number = 1;

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
            case 'Hard':
                return rand > 0.5;
            case 'Brutal':
                return rand > 0.7;
            default: // 'Normal'
                return rand > 0.3;
        }
    }

    getNpcDifficulty = (): NpcDifficulty => {
        return this.difficulty;
    }

    setNpcDifficulty = (difficulty: NpcDifficulty): void => {
        this.difficulty = difficulty;
    }

    getNpcDrawingPoints = (): Array<Point> => {
        return this.drawingPoints;
    }

    setNpcDrawingPoints = (drawingPoints: Array<Point>) => {
        this.drawingPoints = drawingPoints
    }

    getNpcMousePos = (): Point => {
        return this.npcMousePos;
    }

    setNpcMousePos = (npcMousePos: Point) => {
        this.npcMousePos = npcMousePos;
    }

    getNumRemainingMovesPerTurn = (): number => {
        return this.numRemainingMovesPerTurn;
    }

    decrementNumRemaningMovesPerTurn = (): void => {
        this.numRemainingMovesPerTurn--;
    }

    clearNumRemaningMovesPerTurn = (): void => {
        this.numRemainingMovesPerTurn = 0;
    }

    resetNumRemainingMovesPerTurn = () => {
        this.numRemainingMovesPerTurn = 1;//this.getRandomNumberInRange(5, 2);
    }

    cycleThroughDifficulties = (): void => {
        const newDifficulty = this.difficulty == 'Normal' ? 'Hard' : this.difficulty == 'Hard' ? 'Brutal' : 'Normal';
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


    getRandomInferenceString = (): InferenceString => {
        let GAME_SYMBOLS: Array<InferenceString> = ['star', 'circle']//'line', 'circle', 'star', 'triangle', 'diamond'];
        const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
        const inferenceString = GAME_SYMBOLS[rand];
        return inferenceString;
    }

    getRandomNumberInRange = (max: number, min?: number): number => {
        const rand = min ? Math.floor(Math.random() * (max - min)) + min : Math.floor(Math.random() * max);
        return rand;
    }

    getRandomFloatInRange = (max: number, min?: number): number => {
        const rand = min ? Math.random() * (max - min) + min : Math.random() * max;
        return rand;
    }

    /*
    
    From:
    1. players state
    2. board state

    - - npc AI - - 
    
    returns:
    1.inferenceString -> InferenceString type
    2.scale -> relative to cellWidth
    3.rotation -> [0, 360] degrees
    4. random CellIndex in NPC Placement cells

    "getRandomMoveForTesting" ->

    1. generate random inferenceString (all valid... no fizzles or skips)
    2. get random i [0,2] get random j [4, 6]
    3. check how many cells there is vertically and horizontally from bottom right corner
    4. get random scale X (in cell widths) [0,2],  get random scale Y (in cell widths) [0,2]. both based on available space.
    5. get random rotation [0,360]
    ^^ return the above
    6. in Game.tsx generate rawPoints from translation, scale, and rotation

    
    */

    getRandomMoveForTesting = (): NPCMoveData => {
        /*
        
            1. generate random inferenceString (all valid... no fizzles or skips)
            2. get random i [0,2] get random j [4, 6]
            3. check how many cells there is vertically and horizontally from bottom right corner
            4. get random scale X (in cell widths) [0,2],  get random scale Y (in cell widths) [0,2]. both based on available space.
            5. get random rotation [0,360]
            ^^ return the above
            6. in Game.tsx generate rawPoints from translation, scale, and rotation
        
        */

        const inferenceString = this.getRandomInferenceString();

        // in cell widths
        const x = this.getRandomNumberInRange(4, .9);
        const scale = { x, y: Math.max(.9, this.getRandomNumberInRange(x + .2, x - .2)) };

        // const randRot = this.getRandomNumberInRange(60, -60);

        const randRot = this.getRandomNumberInRange(90, -90);


        /*
        
            "translation-shift vector multiplier":

                - 2d vector that gets multiplied with
                    the GameWrapper's width and height
                    to shift the CENTER of the spawned NPC drawn spell

            GameWrapper's aspect-ratio: 16 / 9

            0,0     1,0

              .5,.5

            0,1     1,1
        

        */

        const translationNorm = { x: this.getRandomFloatInRange(.9, -.25), y: this.getRandomFloatInRange(.9, -.5) };
        const npcMoveData = proxy(new NPCMoveData(inferenceString, translationNorm, scale, randRot));

        return npcMoveData;
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