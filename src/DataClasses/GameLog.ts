export type GameLogEntry = {
  text: string;
  color: string;
};

export class GameLog {
  // Properties
  logEntries: Array<GameLogEntry> = [];

  // HTML DOM ID configuration used for scrolling container reference
  private static readonly CONTAINER_DOM_ID = 'game-log-scroll-container';

  getNumLogs = (): number => {
    return this.logEntries.length;
  };

  // --- Methods (Arrow functions to safely preserve 'this' context) ---

  clearAllEntries = (): void => {
    this.logEntries = [];
  };

  /**
   * Safe data-layer wrapper that pushes an item into the array tracker.
   * If wrapped in Valtio, mutating this list immediately triggers updates in React.
   */
  appendEntry = (text: string, color: string = '#FFFFFF'): void => {

    this.logEntries.push({ text, color });

    // Optional: Auto-scroll to the bottom immediately after a log append
    // Wrap in a microtask timeout to let React finish rendering the new DOM item first
    setTimeout(this.scrollToBottom, 0);
  };

  /**
   * Safely locates the text container element inside the browser layout 
   * and smoothly transitions the user view downward.
   */
  scrollToBottom = (): void => {
    if (typeof window === 'undefined') return; // Safe guard for node-based testing environments

    const container = document.getElementById(GameLog.CONTAINER_DOM_ID);
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
}