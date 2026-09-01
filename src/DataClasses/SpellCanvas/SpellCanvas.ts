/*
  
  the SpellCanvas class encapsulates data needed to draw on the canvas and show/hide the canvas. it...
    - show/hide the Canvas
    - capture rawPoint data
    - clear rawPoint data
 
  the SpellCanvas class does NOT:
      - render the HTML canvas

*/

export interface Point {
    x: number;
    y: number;
}

export class SpellCanvas {
    private isShowCanvas: boolean = false; // show/hide canvas
    private isDrawing: boolean = false; // controls adding points in React component
    private rawPoints: Point[] = [];

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

    public clearDrawing(): void {
        this.rawPoints = [];
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
}