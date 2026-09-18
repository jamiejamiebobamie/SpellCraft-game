

export class GameClock {
    secondsHandAngle: number = 0;
    angleIncrement: number = 0;
    isPaused: boolean = false;

    static readonly INTERVAL_DELAY: number = 500;

    constructor(angleIncrement: number) {
        this.angleIncrement = angleIncrement;
    }

    getSecondsHandAngle = (): number => {
        return this.secondsHandAngle;
    }

    resetSecondsHandAngle = (): void  => {
        this.secondsHandAngle = 0;
    }

    incrementSecondsHandAngle = (): void  => {
        this.secondsHandAngle += this.angleIncrement;
    }

    pauseSecondsHandAngle = (): void => {
        this.isPaused = true;
    }

    unpauseSecondsHandAngle = (): void  => {
        this.isPaused = false;
    }

}