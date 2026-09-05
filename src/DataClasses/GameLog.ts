import { proxy } from "valtio";
import { UniqueId } from "./UniqeId";

export class GameLogEntry extends UniqueId {
  text!: string;
  color!: string;

  constructor(text: string, color: string) {
    super();
    this.text = text;
    this.color = color;
  }
};

export class GameLog {
  logEntries: Array<GameLogEntry> = proxy([]);

  getNumLogs = (): number => {
    return this.logEntries.length;
  };

  clearAllEntries = (): void => {
    this.logEntries.splice(0);
  };

  appendEntry = (text: string, color: string = '#FFFFFF'): void => {
    if (this.logEntries.length > 25) {
      this.logEntries.splice(0, 1);
    }
    this.logEntries.push(proxy(new GameLogEntry(text, color)));
  };
}