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
export const NPC_RANDOM_DRAWING = {
  minSize: 0.9, maxSize: 3, // in cell widths
  maxRotation: 25,
  overhang: 0.5, // how far (in cells) a drawing may stray past the zone's edges (only the zone's cells count)
};

/**
 * The AI's drawings keep their proportions: a symbol's width / height stays within this range, so a
 * star or circle never looks squashed (a line, being one-dimensional, is exempt).
 */
export const NPC_DRAWING_ASPECT = { min: 0.55, max: 1.45 };

/**
 * Who casts first each turn: 'waitForPlayer', the NPC waits for the player's first cast, then answers
 * (if the player ends the turn without casting, the NPC still plays first); 'first', the NPC casts
 * right away; 'alternateTurns', switching every turn (the player first on odd turns: the first, third...,
 * the NPC on even ones); 'alternate', switching every match (the first match waits for the player).
 */
export const NPC_TURN_ORDER: 'alternateTurns' | 'alternate' | 'waitForPlayer' | 'first' = 'alternateTurns' as 'alternateTurns' | 'alternate' | 'waitForPlayer' | 'first';

/** The NPC's turn lasts at least this long (ms), even when it casts nothing, so it's seen to take its turn. */
export const NPC_TURN_MIN_MILLI = 500;

/** The "your move first" reminder: after this many seconds of waiting, then 5 seconds later each time it shows. */
export const NPC_WAITING_TIP = { firstSeconds: 10, stepSeconds: 5, maxSeconds: 30 };

/** `scale` with its width / height brought within NPC_DRAWING_ASPECT, by shrinking the longer side. */
const limitAspect = (inferenceString: InferenceString, scale: { x: number; y: number }) => {
  if (inferenceString === 'line') return scale;
  const ratio = scale.x / scale.y;
  if (ratio > NPC_DRAWING_ASPECT.max) return { x: scale.y * NPC_DRAWING_ASPECT.max, y: scale.y };
  if (ratio < NPC_DRAWING_ASPECT.min) return { x: scale.x, y: scale.x / NPC_DRAWING_ASPECT.min };
  return scale;
};

export class NPCPlayer extends Player {
    readonly avatarHeadUrl: string = './player_avatars/Head2.png';
    readonly avatarRobeUrl: string = './player_avatars/Robe2a.png';
    readonly avatarBicepUrl: string = './player_avatars/Bicep2.png';

    difficulty: NpcDifficulty = 'Normal';

    drawingPoints: Array<Point> = proxy([]);
    npcMousePos: Point = { x: 0, y: 0 };
    numRemainingMovesPerTurn: number = 1;

    npcMoveData: Array<NPCMoveData> = [];

    // This turn: when it began, how many spells it drew, and who to tell once it's done
    private turnId = 0; // (bumped as each turn begins or is reset, so a turn finishing late can't end the next)
    private turnStartedAt = 0;
    private drawingsThisTurn = 0;
    private isFinishingTurn = false;
    private onTurnDone: ((isPassed: boolean) => void) | null = null;

    constructor(direction: -1 | 1, avatarUrl: string) {
        super(direction, avatarUrl);
    }

    /** Its turn begins. `onTurnDone` is told when it's done, and whether it passed (drew nothing). */
    beginNpcTurn(onTurnDone: (isPassed: boolean) => void): void {
        this.turnId++;
        this.isFinishingTurn = false;
        this.turnStartedAt = performance.now();
        this.drawingsThisTurn = 0;
        this.onTurnDone = onTurnDone;
    }

    /** Done with its turn: not before NPC_TURN_MIN_MILLI from its start (however it ends). */
    setIsDoneWithTurn(isDoneWithTurn: boolean): void {
        if (!isDoneWithTurn) {
            this.turnId++;
            this.isFinishingTurn = false;
            this.isDoneWithTurn = false;
            return;
        }
        if (this.isDoneWithTurn || this.isFinishingTurn) return;
        const turnId = this.turnId;
        const finish = () => {
            if (turnId !== this.turnId) return; // (the turn is already over)
            this.isFinishingTurn = false;
            this.isDoneWithTurn = true;
            const onTurnDone = this.onTurnDone;
            this.onTurnDone = null;
            onTurnDone?.(this.drawingsThisTurn === 0);
        };
        const waitMilli = NPC_TURN_MIN_MILLI - (performance.now() - this.turnStartedAt);
        this.isFinishingTurn = true;
        if (waitMilli > 0) setTimeout(finish, waitMilli);
        else finish();
    }

    // GET
    getNpcDifficulty(): NpcDifficulty { return this.difficulty; }
    getNpcDrawingPoints(): Array<Point> { return this.drawingPoints; }
    getNpcMousePos(): Point { return this.npcMousePos; }
    getNumRemainingMovesPerTurn(): number { return this.numRemainingMovesPerTurn; }
    getNPCMoveData(): Array<NPCMoveData> { return this.npcMoveData; }
    getNPCMoveDatum(i: number): NPCMoveData | null { return this.npcMoveData[i] || null; }
    getRandomInferenceString(): InferenceString {
        let GAME_SYMBOLS: Array<InferenceString> = ['star' , 'line', 'circle', 'triangle', 'diamond'];
        const rand = Math.floor(Math.random() * GAME_SYMBOLS.length);
        const inferenceString = GAME_SYMBOLS[rand];
        return inferenceString;
    }
    getRandomFloatInRange(max: number, min?: number): number {
        const rand = min ? Math.random() * (max - min) + min : Math.random() * max;
        return rand;
    }
    /** Whether this NPC turn is a random one (otherwise its brain plays it): more often on easier difficulties. */
    isRandomMove(): boolean {
        const rand = Math.random();
        switch (this.difficulty) {
            case 'Hard':
                return rand > 0.5;
            case 'Brutal':
                return rand > 0.7; // 30% random, 70% the trained model
            default: // 'Normal'
                return rand > 0.3;
        }
    }
    /**
     * Draws the planned symbol (unrotated) over the area of its cells in the NPC's zone, keeping its
     * proportions (NPC_DRAWING_ASPECT): centered in that area if it can't fill it.
     */
    getPlannedMoveData({ inferenceString, cells }: Pick<PlannedNpcCast, 'inferenceString' | 'cells'>): NPCMoveData {
        const zoneStartJ = GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS;
        const minI = Math.min(...cells.map(c => c.i)), maxI = Math.max(...cells.map(c => c.i));
        const minJ = Math.min(...cells.map(c => c.j)), maxJ = Math.max(...cells.map(c => c.j));
        const inset = 0.1; // cells of margin around the drawing
        const area = { x: maxJ - minJ + 1 - 2 * inset, y: maxI - minI + 1 - 2 * inset };
        const scale = limitAspect(inferenceString, area);
        // translationNorm: fraction of the zone's width / the board's height; scale: in cell widths
        const translationNorm = {
            x: (minJ - zoneStartJ + inset + (area.x - scale.x) / 2) / GameBoard.NUM_PLACEMENT_CELLS,
            y: (minI + inset + (area.y - scale.y) / 2) / GameBoard.NUM_ROWS,
        };
        return proxy(new NPCMoveData(inferenceString, translationNorm, scale, 0));
    }

    getRandomMoveForTesting(): NPCMoveData {
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
        const scale = limitAspect(inferenceString, { x, y: Math.min(NPC_RANDOM_DRAWING.maxSize, Math.max(NPC_RANDOM_DRAWING.minSize, this.getRandomFloatInRange(x * 1.2, x * 0.85))) });
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

        // Mostly inside the NPC's zone, straying up to NPC_RANDOM_DRAWING.overhang cells past its edges:
        // fractions of the zone's width / the board's height
        const { overhang } = NPC_RANDOM_DRAWING;
        const translationNorm = {
            x: this.getRandomFloatInRange((GameBoard.NUM_PLACEMENT_CELLS - scale.x + overhang) / GameBoard.NUM_PLACEMENT_CELLS, -overhang / GameBoard.NUM_PLACEMENT_CELLS),
            y: this.getRandomFloatInRange((GameBoard.NUM_ROWS - scale.y + overhang) / GameBoard.NUM_ROWS, -overhang / GameBoard.NUM_ROWS),
        };
        const npcMoveData = proxy(new NPCMoveData(inferenceString, translationNorm, scale, randRot));
        return npcMoveData;
    }

    // SET
    setNpcDifficulty(difficulty: NpcDifficulty): void {
        this.difficulty = difficulty;
    }
    setNpcDrawingPoints(drawingPoints: Array<Point>) {
        this.drawingPoints = drawingPoints
    }
    setNpcMousePos(npcMousePos: Point) {
        this.npcMousePos = npcMousePos;
    }
    decrementNumRemaningMovesPerTurn(): void { this.numRemainingMovesPerTurn--; }
    cycleThroughDifficulties(): void {
        const newDifficulty = this.difficulty == 'Normal' ? 'Hard' : this.difficulty == 'Hard' ? 'Brutal' : 'Normal';
        this.setNpcDifficulty(newDifficulty);
    }

    // RESET
    clearNumRemaningMovesPerTurn(): void {
        this.numRemainingMovesPerTurn = 0;
    }
    resetNumRemainingMovesPerTurn() {
        this.numRemainingMovesPerTurn = 1;
    }
    resetNpcMove() {
        this.npcMoveData = proxy([]);
    }

    reset(): void {
        super.reset();
        this.turnId++;
        this.isFinishingTurn = false;
        this.onTurnDone = null;
        this.resetNumRemainingMovesPerTurn();
        this.resetNpcMove();
    }

    /** After a random move: another one (if any are left this turn and there's focus), or the turn is done. */
    private finishNpcMove(gameBoard: GameBoard, filterDominantCells: Function, spawnSizedSpellInstance: Function, isCanPlaceGameSymbolOn: Function, getCellAt: Function): void {
        this.decrementNumRemaningMovesPerTurn();
        if (this.getNumRemainingMovesPerTurn() > 0 && this.getFocus() > 0) {
            setTimeout(
                () => this.doNpcMove(gameBoard, filterDominantCells, spawnSizedSpellInstance, isCanPlaceGameSymbolOn, getCellAt),
                Math.random() * 1000);
        } else {
            this.setIsDoneWithTurn(true);
        }
    }

    /** The screen points of a drawing (its symbol rotated, scaled and placed), densely sampled; null before layout. */
    private getDrawingPoints(npcMoveData: NPCMoveData, gameBoard: GameBoard): Array<Point> | null {
        const { inferenceString, translationNorm, scale, rotation } = npcMoveData;
        const cellWidth = gameBoard.getCellWidth();
        const normalizedPoints = HARDCODED_SYMBOLS.get(inferenceString);
        const { left, top, width, height } = gameBoard.getBoardRefDimensions() || { left: 0, top: 0, width: 0, height: 0 };
        if (!cellWidth || !normalizedPoints || !width) return null;

        const radians = (rotation * Math.PI) / 180;
        const cos = Math.cos(radians), sin = Math.sin(radians);
        const cx = 0.5, cy = 0.5; // rotation is about the symbol's center
        const startOfNpcPlacementCellsX = left + (GameBoard.NUM_COLS - GameBoard.NUM_PLACEMENT_CELLS) * cellWidth;
        const widthOfPlacementCells = GameBoard.NUM_PLACEMENT_CELLS * cellWidth;

        let lastPoint: Point | null = null;
        const rawPoints: Array<Point> = [];
        normalizedPoints.forEach(({ x, y }) => {
            const tx = x - cx, ty = y - cy;
            const finalNormX = tx * cos - ty * sin + cx;
            const finalNormY = tx * sin + ty * cos + cy;
            const newPoint = {
                x: startOfNpcPlacementCellsX + widthOfPlacementCells * translationNorm.x + finalNormX * scale.x * cellWidth,
                y: top + height * translationNorm.y + finalNormY * scale.y * cellWidth,
            };
            if (lastPoint) {
                const numMorePoints = 200; // generate more points for board interaction
                const vec: Point = { x: newPoint.x - lastPoint.x, y: newPoint.y - lastPoint.y };
                for (let i = 0; i < numMorePoints; i++) {
                    rawPoints.push({ x: lastPoint.x + i * vec.x / numMorePoints, y: lastPoint.y + i * vec.y / numMorePoints });
                }
            }
            rawPoints.push(newPoint);
            lastPoint = newPoint;
        });
        return rawPoints;
    }

    /**
     * Draws a symbol and casts its spell. With `plannedMove` (from the NPC's brain), draws that symbol
     * over its cells and casts there, then calls `plannedMove.onCast`; otherwise draws a random one.
     */
    /**
     * The cells of a random drawing the NPC can cast without killing itself with blood magic: all of
     * them, else just one (the smallest cast), else none.
     */
    private getCellsSafeToCast(spell: SpellClass, cells: Array<CellIndex>, gameBoard: GameBoard): Array<CellIndex> {
        const isOccupied = (cell: CellIndex) => !gameBoard.getCellAt(cell)?.getIsFree();
        const getIsSafe = (castCells: Array<CellIndex>) => {
            const focusCost = Math.max(1, Math.ceil(getPlacementFocusCost(spell, planSpellPlacement(spell, castCells, this.getDirection(), isOccupied))));
            const bloodMagicCost = Math.max(0, focusCost - this.getFocus()) * this.getBloodMagicCost();
            return bloodMagicCost < this.getHealth();
        };
        if (getIsSafe(cells)) return cells;
        return cells.length && getIsSafe(cells.slice(0, 1)) ? cells.slice(0, 1) : [];
    }

    doNpcMove(gameBoard: GameBoard, filterDominantCells: Function, spawnSizedSpellInstance: Function, isCanPlaceGameSymbolOn: Function, getCellAt: Function, plannedMove?: PlannedNpcMove): void {
        // (every way out of a move that casts nothing ends the NPC's turn, so the turn can always end)
        const endTurnWithoutCasting = () => {
            this.clearNumRemaningMovesPerTurn();
            this.setIsDoneWithTurn(true);
        };
        if (!this.getFocus() || this.getIsDead()) return endTurnWithoutCasting();

        let npcMoveData = plannedMove ? this.getPlannedMoveData(plannedMove) : this.getRandomMoveForTesting();
        let rawPoints = this.getDrawingPoints(npcMoveData, gameBoard);
        if (!rawPoints) return endTurnWithoutCasting(); // (the board isn't laid out yet)

        // A random drawing: its cells, worked out before drawing it. If blood magic would kill the NPC,
        // the cast shrinks to one cell (and is drawn there, at its real size), or is skipped.
        let randomCastCells: Array<CellIndex> = [];
        if (!plannedMove) {
            const spell = GameSymbol.SPELL_LOOKUP.get(npcMoveData.inferenceString);
            const freeCells = spell ? filterDominantCells(rawPoints)
                .map((cellIndex: CellIndex) => gameBoard.getCellAt(cellIndex))
                .filter((cell: Cell | null) => !!cell && isCanPlaceGameSymbolOn(cell, this as Player))
                .map((cell: Cell) => cell.getCellIndex()) : [];
            randomCastCells = spell ? this.getCellsSafeToCast(spell as SpellClass, freeCells, gameBoard) : [];
            if (randomCastCells.length && randomCastCells.length < freeCells.length) {
                npcMoveData = this.getPlannedMoveData({ inferenceString: npcMoveData.inferenceString, cells: randomCastCells });
                rawPoints = this.getDrawingPoints(npcMoveData, gameBoard) ?? rawPoints;
            }
            if (!randomCastCells.length && freeCells.length) {
                // Nothing safe to cast: this move is skipped (not drawn)
                this.finishNpcMove(gameBoard, filterDominantCells, spawnSizedSpellInstance, isCanPlaceGameSymbolOn, getCellAt);
                return;
            }
        }
        const { inferenceString, scale } = npcMoveData;

        // Within doNpcMove -> storedSpell container:
        const storedSpell = () => {
            if (plannedMove) {
                spawnSizedSpellInstance(inferenceString, plannedMove.cells, this);
                this.setGameSymbol(null);
                plannedMove.onCast();
                return;
            }

            if (randomCastCells.length) spawnSizedSpellInstance(inferenceString, randomCastCells, this);
            this.setGameSymbol(null);
            this.finishNpcMove(gameBoard, filterDominantCells, spawnSizedSpellInstance, isCanPlaceGameSymbolOn, getCellAt);
        };


        this.setNpcDrawingPoints(rawPoints);
        // set to get arm-wand movements while drawing
        this.setGameSymbol(new GameSymbol(inferenceString, this))
        this.npcMoveData.push({ ...npcMoveData, storedSpell, speed: 1.3 / scale.x });
        this.drawingsThisTurn++;
    }


}