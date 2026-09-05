import { UniqueId } from '../UniqeId';

// Fizzle.ts
export class Fizzle extends UniqueId {
  // Constants assigned at creation
  readonly turnCreated: number;
  readonly numTurnsUntilRemoved: number;

  constructor(currentTurn: number, lifetimeTurns: number = 3) {
    super();
    this.turnCreated = currentTurn;
    this.numTurnsUntilRemoved = lifetimeTurns;
  }

  /**
   * Compares the current global turn count against the creation turn and lifetime limit.
   * @param currentTurn The current game turn count
   */
  getIsExpired = (currentTurn: number): boolean => {
    return currentTurn >= this.turnCreated + this.numTurnsUntilRemoved;
  };

  /**
   * Explicit cleanup hook if you need to run specific logic when a fizzle dissolves.
   */
  remove = (): void => {
    // Engine hook placeholder: trigger visual fades, sound effects, or tracking cleanup.
  };
}