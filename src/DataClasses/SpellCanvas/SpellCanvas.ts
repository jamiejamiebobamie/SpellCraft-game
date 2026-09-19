/*
  
  the SpellCanvas class encapsulates data needed to draw on the canvas and show/hide the canvas. it...
    - show/hide the Canvas
    - capture rawPoint data
    - clear rawPoint data
 
  the SpellCanvas class does NOT:
      - render the HTML canvas

*/

import { CellIndex } from "../types";

export interface Point {
    x: number;
    y: number;
}

type CellPoint = {
    cellIndex: CellIndex;
    rawPointIndex: number;
}

export class SpellCanvas {
    private isShowCanvas: boolean = false; // show/hide canvas
    private isDrawing: boolean = false; // controls adding points in React component
    private rawPoints: Point[] = [];
    private cellPoints: Array<CellPoint> = [];
    private currCellIndex: CellIndex | null = null;

    public getIsShowCanvas(): boolean {
        return this.isShowCanvas;
    }

    public toggleShowCanvas(): void {
        this.isShowCanvas = !this.isShowCanvas;
    }

    public setIsShowCanvas(isShowCanvas: boolean): void {
        this.isShowCanvas = isShowCanvas;
    }

    public getIsDrawing(): boolean {
        return this.isDrawing;
    }

    public setIsDrawing(isDrawing: boolean): void {
        this.isDrawing = isDrawing;
    }

    public updateCellPointsIfDifferent = (currCellIndex: CellIndex) => {
        if (this.getIsCellIndexNew(currCellIndex)) {
            this.currCellIndex = currCellIndex;
            this.cellPoints.push({ cellIndex: currCellIndex, rawPointIndex: this.getNumPoints() - 1 });
        }
    }

    public clearDrawing(): void {
        this.rawPoints = [];
        this.cellPoints = [];
        this.currCellIndex = null;
    }

    public getRawPoints(): Point[] {
        return this.rawPoints;
    }

    public addRawPoint(x: number, y: number): void {
        const newPoint: Point = { x, y };
        this.rawPoints.push(newPoint)
    }

    public getNumPoints(): number {
        return this.rawPoints.length;
    }

    public getIsCellIndexNew = (cellIndex: CellIndex) => {
        if (!this.currCellIndex) return true;
        else
            return !(cellIndex.i == this.currCellIndex.i && cellIndex.j == this.currCellIndex.j);
    }

    getRawPointSubsets = () => {
        const result = [];
        for (let i = 0; i < this.cellPoints.length; i++) {
            const { cellIndex, rawPointIndex } = this.cellPoints[i];
            const startOfSubset = rawPointIndex;
            let endOfSubset = this.rawPoints.length - 1;
            if (i + 1 < this.cellPoints.length) {
                const { rawPointIndex } = this.cellPoints[i + 1];
                endOfSubset = rawPointIndex;
            }
            const rawPointsSubset = this.rawPoints.slice(startOfSubset, endOfSubset);
            result.push({ cellIndex, rawPointsSubset })
        }
        return result;
    }
}