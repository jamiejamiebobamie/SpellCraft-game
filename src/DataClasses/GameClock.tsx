

export class GameClock {
    secondsHandAngle: number = 0;
    angleIncrement: number = 0;
    isPaused: boolean = false;
    timeoutRef: number = 0;
    intervalRef: number = 0;
    endTurn = () => { };

    static readonly ANGLE_INCREMENT: number = 24;
    static readonly INTERVAL_DELAY: number = 1000;

    constructor(endTurn: () => {}) {
        this.endTurn = endTurn;
    }

    // PRIVATE
    incrementSecondsHandAngle = (): void => {
        this.secondsHandAngle += GameClock.ANGLE_INCREMENT;
    }

    // PUBLIC
    getSecondsHandAngle = (): number => {
        return this.secondsHandAngle;
    }

    getAngleIncrement = (): number => {
        return GameClock.ANGLE_INCREMENT;
    }

    resetClock = (): void => {
        this.secondsHandAngle = 0;
    }

    pauseClock = () => {
        this.isPaused = true;
    }

    unpauseClock = () => {
        this.isPaused = false;
    }

    startClock = (): void => {
        this.intervalRef = setInterval(() => {

            if(this.isPaused) return;

            this.incrementSecondsHandAngle();

            if (this.secondsHandAngle >= 360 + GameClock.ANGLE_INCREMENT)
                this.endTurn();

        }, GameClock.INTERVAL_DELAY);
    }

    stopClock = (): void => {
        clearInterval(this.intervalRef);
        clearTimeout(this.timeoutRef);
    }
}