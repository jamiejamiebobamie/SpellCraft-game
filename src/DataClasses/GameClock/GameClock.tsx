/**
 * The turn clock: the clock's seconds hand counts down the player's turn. It ticks round once a turn,
 * in TURN_CLOCK.ticksPerTurn ticks over TURN_CLOCK.turnSeconds (faster than real seconds); if the
 * player hasn't ended the turn when it reaches the minute, the turn ends for them.
 */
export const TURN_CLOCK = {
  isOn: true,
  turnSeconds: 30, // how long the player has each turn (real seconds)
  multiplayerTurnSeconds: 15, // (a 2-player match: each player's part of the turn)
  ticksPerTurn: 60, // the seconds hand's ticks round the face (one a "second")
};

export class GameClock {
    minuteAngleAcc: number = 0;
    secondTicks: number = 0; // this turn's ticks so far (0 to TURN_CLOCK.ticksPerTurn)
    isTurnClockRunning: boolean = false;
    intervalRef: number = 0;
    endTurn = () => { };
    /** Whether the turn clock should hold still for now (e.g. a tutorial page is open). */
    getIsHeld: () => boolean = () => false;
    /** Each tick of the turn clock: how far through the turn's time it is (0 to 1). */
    onTick: (fraction: number) => void = () => { };

    /*
      360 for callback to trigger every hour
        30 to trigger every 1/12th hour.
    */
    static readonly MINUTE_INCREMENT_ANGLE: number = 120; // a turn: 20 minutes (30, 5 minutes, was tried)
    static readonly MAX_MINUTE_INCREMENT_ANGLE: number = 360 * 6; // 6 hours (midnight to 6 AM), 360 degrees each

    constructor(endTurn: () => {}) {
        this.endTurn = endTurn;
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

    /** The seconds hand's angle (0 at 12, 360 once it has gone round: the turn's time is up). */
    getSecondsHandAngle = (): number => (this.secondTicks / TURN_CLOCK.ticksPerTurn) * 360;

    /** How far through the turn's time the seconds hand is (0 to 1). */
    getTurnTimeFraction = (): number => this.secondTicks / TURN_CLOCK.ticksPerTurn;

    getIsTurnClockRunning = (): boolean => this.isTurnClockRunning;

    resetClock = (): void => {
        this.stopTurnClock();
        this.resetMinuteAngleAcc();
    }

    /** The player's turn begins: the seconds hand starts from 12, ticking round once over the turn. */
    startTurnClock = (seconds: number = TURN_CLOCK.turnSeconds): void => {
        this.stopTurnClock();
        if (!TURN_CLOCK.isOn) return;
        this.isTurnClockRunning = true;
        const tickMilli = (seconds / TURN_CLOCK.ticksPerTurn) * 1000;
        this.intervalRef = window.setInterval(() => {
            if (this.getIsHeld()) return;
            this.secondTicks++;
            this.onTick(this.getTurnTimeFraction());
            if (this.secondTicks >= TURN_CLOCK.ticksPerTurn) {
                // Time's up: the turn ends for the player
                window.clearInterval(this.intervalRef);
                this.isTurnClockRunning = false;
                this.endTurn();
            }
        }, tickMilli);
    }

    /** The turn is over (ended, or the game is): the seconds hand stops and goes back to 12. */
    stopTurnClock = (): void => {
        window.clearInterval(this.intervalRef);
        this.isTurnClockRunning = false;
        this.secondTicks = 0;
    }
}
