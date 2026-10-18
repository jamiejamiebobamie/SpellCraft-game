import { Player } from "./Player";
import { CellIndex, InferenceString, NpcDifficulty, NPCMoveData, Point } from '../types';
import { proxy } from "valtio";
import { GameBoard } from "../GameBoard/GameBoard";
import { HARDCODED_SYMBOLS } from '../PlacedSpells/HardCodedSymbols'
import { GameSymbol } from '../PlacedSpells/GameSymbol';
import { Cell } from "../GameBoard/Cell";
import type { PlannedNpcCast } from "./NpcBrain";
import { SpellClass, getPlacementFocusCost, planSpellPlacement } from "../GameRules/gameRules";

/** A cast decided by the NPC's brain: drawn like any other, then placed on exactly these cells. */
export type PlannedNpcMove = PlannedNpcCast & { onCast: () => void };

/** How sloppy the NPC's random drawings are (was: up to 3.9 cells, up to 90 degrees, often outside its zone). */
export const NPC_RANDOM_DRAWING = { minSize: 0.9, maxSize: 3, maxRotation: 25 };

export class NPCPlayer extends Player {
    readonly avatarHeadUrl: string = './player_avatars/Head2.png';
    readonly avatarRobeUrl: string = './player_avatars/Robe2a.png';
    readonly avatarBicepUrl: string = './player_avatars/Bicep2.png';

    difficulty: NpcDifficulty = 'Normal';

    drawingPoints: Array<Point> = proxy([]);
    npcMousePos: Point = { x: 0, y: 0 };
    numRemainingMovesPerTurn: number = 1;

    npcMoveData: Array<NPCMoveData> = [];

    constructor(direction: -1 | 1, avatarUrl: string) {
        super(direction, avatarUrl);
    }

    // GET
    getNpcDifficulty = (): NpcDifficulty => this.difficulty;
    getNpcDrawingPoints = (): Array<Point> => this.drawingPoints;
    getNpcMousePos = (): Point => this.npcMousePos;
    getNumRemainingMovesPerTurn = (): number => this.numRemainingMovesPerTurn;
    getNPCMoveData = (): Array<NPCMoveData> => this.npcMoveData;
    getNPCMoveDatum = (i: number): NPCMoveData | null => this.npcMoveData[i] || null;
    getRandomInferenceString = (): InferenceString => {
        let GAME_SYMBOLS: Array<InferenceString> = ['star' , 'line', 'circle', 'triangle', 'diamond'];
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
    /** Whether this NPC turn is a random one (otherwise its brain plays it): more often on easier difficulties. */
    isRandomMove = (): boolean => {
        const rand = Math.random();
        switch (this.difficulty) {
            case 'Hard':
                return rand > 0.5;
            case 'Brutal':
                return false; // temporarily all trained AI, for testing (was: rand > 0.7)
            default: // 'Normal'
                return rand > 0.3;
        }
    }
    /** Draws the planned symbol (unrotated) over the area of its cells in the NPC's zone. */
    getPlannedMoveData = ({ inferenceString, cells }: PlannedNpcCast): NPCMoveData => {
        const zoneStartJ = GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS;
        const minI = Math.min(...cells.map(c => c.i)), maxI = Math.max(...cells.map(c => c.i));
        const minJ = Math.min(...cells.map(c => c.j)), maxJ = Math.max(...cells.map(c => c.j));
        const inset = 0.1; // cells of margin around the drawing
        // translationNorm: fraction of the zone's width / the board's height; scale: in cell widths
        const translationNorm = { x: (minJ - zoneStartJ + inset) / GameBoard.NUM_PLACEMENT_CELLS, y: (minI + inset) / GameBoard.NUM_ROWS };
        const scale = { x: maxJ - minJ + 1 - 2 * inset, y: maxI - minI + 1 - 2 * inset };
        return proxy(new NPCMoveData(inferenceString, translationNorm, scale, 0));
    }

    getRandomMoveForTesting = (): NPCMoveData => {
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

        - - - - - - - - - - - - - - - - - - - - 
        
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
        // Size (in cell widths), up to the zone's 3 cells; roughly as tall as wide
        const x = this.getRandomFloatInRange(NPC_RANDOM_DRAWING.maxSize, NPC_RANDOM_DRAWING.minSize);
        const scale = { x, y: Math.min(NPC_RANDOM_DRAWING.maxSize, Math.max(NPC_RANDOM_DRAWING.minSize, this.getRandomFloatInRange(x + .2, x - .2))) };
        const randRot = this.getRandomFloatInRange(NPC_RANDOM_DRAWING.maxRotation, -NPC_RANDOM_DRAWING.maxRotation);

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

        // Kept inside the NPC's zone: fractions of the zone's width / the board's height
        const translationNorm = {
            x: this.getRandomFloatInRange((GameBoard.NUM_PLACEMENT_CELLS - scale.x) / GameBoard.NUM_PLACEMENT_CELLS, 0),
            y: this.getRandomFloatInRange((GameBoard.NUM_ROWS - scale.y) / GameBoard.NUM_ROWS, 0),
        };
        const npcMoveData = proxy(new NPCMoveData(inferenceString, translationNorm, scale, randRot));
        return npcMoveData;
    }

    // SET
    setNpcDifficulty = (difficulty: NpcDifficulty): void => {
        this.difficulty = difficulty;
    }
    setNpcDrawingPoints = (drawingPoints: Array<Point>) => {
        this.drawingPoints = drawingPoints
    }
    setNpcMousePos = (npcMousePos: Point) => {
        this.npcMousePos = npcMousePos;
    }
    decrementNumRemaningMovesPerTurn = (): void => { this.numRemainingMovesPerTurn--; }
    cycleThroughDifficulties = (): void => {
        const newDifficulty = this.difficulty == 'Normal' ? 'Hard' : this.difficulty == 'Hard' ? 'Brutal' : 'Normal';
        this.setNpcDifficulty(newDifficulty);
    }

    // RESET
    clearNumRemaningMovesPerTurn = (): void => {
        this.numRemainingMovesPerTurn = 0;
    }
    resetNumRemainingMovesPerTurn = () => {
        this.numRemainingMovesPerTurn = 1;
    }
    resetNpcMove = () => {
        this.npcMoveData = proxy([]);
    }

    reset(): void {
        super.reset();
        this.resetNumRemainingMovesPerTurn();
        this.resetNpcMove();
    }

    /**
     * Draws a symbol and casts its spell. With `plannedMove` (from the NPC's brain), draws that symbol
     * over its cells and casts there, then calls `plannedMove.onCast`; otherwise draws a random one.
     */
    /**
     * The cells of a random drawing the NPC can cast without killing itself with blood magic: all of
     * them, else just one (the smallest cast), else none.
     */
    private getCellsSafeToCast = (spell: SpellClass, cells: Array<CellIndex>, gameBoard: GameBoard): Array<CellIndex> => {
        const isOccupied = (cell: CellIndex) => !gameBoard.getCellAt(cell)?.getIsFree();
        const getIsSafe = (castCells: Array<CellIndex>) => {
            const focusCost = Math.max(1, Math.ceil(getPlacementFocusCost(spell, planSpellPlacement(spell, castCells, this.getDirection(), isOccupied))));
            const bloodMagicCost = Math.max(0, focusCost - this.getFocus()) * this.getBloodMagicCost();
            return bloodMagicCost < this.getHealth();
        };
        if (getIsSafe(cells)) return cells;
        return cells.length && getIsSafe(cells.slice(0, 1)) ? cells.slice(0, 1) : [];
    };

    doNpcMove = (gameBoard: GameBoard, filterDominantCells: Function, spawnSizedSpellInstance: Function, isCanPlaceGameSymbolOn: Function, getCellAt: Function, forceUpdate: Function, plannedMove?: PlannedNpcMove): void => {
        if (!this.getFocus() || this.getIsDead()) {
            this.clearNumRemaningMovesPerTurn();
            return;
        }

        const npcMoveData = plannedMove ? this.getPlannedMoveData(plannedMove) : this.getRandomMoveForTesting();
        const { inferenceString, translationNorm, scale, rotation } = npcMoveData;

        const cellWidth = gameBoard.getCellWidth()
        if (!cellWidth) return;

        const normalizedPoints = HARDCODED_SYMBOLS.get(inferenceString);
        if (!normalizedPoints) return;

        // Convert degrees to radians for Math.cos and Math.sin
        const radians = (rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        // Center of rotation for normalized space
        const cx = 0.5;
        const cy = 0.5;

        const { left, top, width, height } = gameBoard.getBoardRefDimensions() || { left: 0, top: 0, width: 0, height: 0 };
        if (!width) return;

        const startOfNpcPlacementCellsX = left + (GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS) * cellWidth;
        const startOfNpcPlacementCellsY = top;
        const widthOfPlacementCells = GameBoard.NUM_PLACEMENT_CELLS * cellWidth;

        let lastPoint: Point | null = null;
        const rawPoints: Array<Point> = []
        normalizedPoints.forEach(({ x, y }) => {
            // Step 1: Translate point so that the center (0.5, 0.5) is at origin (0, 0)
            const tx = x - cx;
            const ty = y - cy;

            // Step 2: Apply 2D Rotation Matrix
            const rotatedX = tx * cos - ty * sin;
            const rotatedY = tx * sin + ty * cos;

            // Step 3: Translate back from origin to center space
            const finalNormX = rotatedX + cx;
            const finalNormY = rotatedY + cy;

            const newPoint = {
                x: startOfNpcPlacementCellsX + widthOfPlacementCells * translationNorm.x + finalNormX * scale.x * cellWidth,
                y: startOfNpcPlacementCellsY + height * translationNorm.y + finalNormY * scale.y * cellWidth
            }
            if (lastPoint) {
                const numMorePoints = 200;
                const vec: Point = { x: newPoint.x - lastPoint.x, y: newPoint.y - lastPoint.y };
                // generate more points for board interaction...
                for (let i = 0; i < numMorePoints; i++) {
                    rawPoints.push(
                        {
                            x: lastPoint.x + i * vec.x / numMorePoints,
                            y: lastPoint.y + i * vec.y / numMorePoints
                        }
                    )
                }
            }
            rawPoints.push(newPoint);
            lastPoint = newPoint
        });

        // Within doNpcMove -> storedSpell container:
        const storedSpell = () => {
            if (plannedMove) {
                spawnSizedSpellInstance(inferenceString, plannedMove.cells, this);
                this.setGameSymbol(null);
                plannedMove.onCast();
                return;
            }

            const dominantCells = filterDominantCells(rawPoints);
            if (dominantCells.length > 0) {
                const spell = GameSymbol.SPELL_LOOKUP.get(inferenceString);
                if (spell) {
                    const freeCells = dominantCells.map((cellIndex: CellIndex) => gameBoard.getCellAt(cellIndex)).filter((cell: Cell) => isCanPlaceGameSymbolOn(cell, this as Player));
                    const freePositions = freeCells.filter((c: Cell | null) => !!c).map((c: Cell) => c?.getCellIndex());
                    const safeCells = this.getCellsSafeToCast(spell as SpellClass, freePositions, gameBoard);
                    if (safeCells.length) spawnSizedSpellInstance(inferenceString, safeCells, this);
                }
            }

            this.setGameSymbol(null);
            this.decrementNumRemaningMovesPerTurn();

            if (this.getNumRemainingMovesPerTurn() > 0 && this.getFocus() > 0) {
                setTimeout(
                    () => this.doNpcMove(gameBoard, filterDominantCells, spawnSizedSpellInstance, isCanPlaceGameSymbolOn, getCellAt, forceUpdate),
                    Math.random() * 1000);
            } else {
                this.setIsDoneWithTurn(true);
                forceUpdate();
            }
        };


        this.setNpcDrawingPoints(rawPoints);
        // set to get arm-wand movements while drawing
        this.setGameSymbol(new GameSymbol(inferenceString, this))
        this.npcMoveData.push({ ...npcMoveData, storedSpell, speed: 1.3 / scale.x });
        forceUpdate();
    }


}