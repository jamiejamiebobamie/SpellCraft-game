import { proxy } from "valtio";
import { UniqueId } from "./UniqeId";
import { SpellConstructor } from "./types";

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
  hoveredSpellBookSpell: SpellConstructor | null = null;


  getHoveredSpellBookSpell = (): SpellConstructor | null => {
    return this.hoveredSpellBookSpell;
  }

  setHoveredSpellBookSpell = (hoveredSpell: SpellConstructor | null) => {
    this.hoveredSpellBookSpell = hoveredSpell;
  }

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