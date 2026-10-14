

export class GameClock {
    minuteAngleAcc: number = 0;
    secondsHandAngle: number = 0;
    angleIncrement: number = 0;
    isPaused: boolean = false;
    timeoutRef: number = 0;
    intervalRef: number = 0;
    endTurn = () => { };

    /*
      360 for callback to trigger every hour
        30 to trigger every 1/12th hour.
    */
    static readonly MINUTE_INCREMENT_ANGLE: number = 30;
    static readonly SECONDS_INCREMENT_ANGLE: number = 24;
    static readonly INTERVAL_DELAY: number = 1000;

    constructor(endTurn: () => {}) {
        this.endTurn = endTurn;
    }

    // PRIVATE
    incrementSecondsHandAngle = (): void => {
        this.secondsHandAngle += GameClock.SECONDS_INCREMENT_ANGLE;
    }

    // PUBLIC
    getMinuteAngleAcc = (): number => {
        return this.minuteAngleAcc;
    }

    getMinuteIncrAngle = (): number => {
        return GameClock.MINUTE_INCREMENT_ANGLE;
    }

    incrementMinuteAngleAcc = (): void => {
        this.minuteAngleAcc += GameClock.MINUTE_INCREMENT_ANGLE;
    }

    resetMinuteAngleAcc = (): void => {
        this.minuteAngleAcc = 0;
    }

    getSecondsHandAngle = (): number => {
        return this.secondsHandAngle;
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
        clearInterval(this.intervalRef);
        this.intervalRef = setInterval(() => {

            if (this.isPaused) return;

            this.incrementSecondsHandAngle();

            if (this.secondsHandAngle >= 360 + GameClock.SECONDS_INCREMENT_ANGLE)
                this.endTurn();

        }, GameClock.INTERVAL_DELAY);
    }

    stopClock = (): void => {
        clearInterval(this.intervalRef);
        clearTimeout(this.timeoutRef);
    }
}