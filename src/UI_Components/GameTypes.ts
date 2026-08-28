// ============================================================================
// 1. DATA PRIMITIVES & TYPE INTERFACES
// ============================================================================
export type CellIndex = { i: number; j: number; };

export type GameLogEntry = {
  id: string;
  text: string;
  color: string;
};

export interface Fizzle {
  id: string;
  turnCreated: number;
  numTurnsUntilRemoved: number;
}

export type SpellSubclassType = 'Phlegm' | 'Ether' | 'Gyre' | 'Quicken';

export interface GameSpell {
  id: string;
  name: string;
  casterId: number;
  subclass: SpellSubclassType;
  cellIndex: CellIndex | null;
  speedDirection: number;
  dmgHealth: number;
  rowShift: number;
  updateOrder: number;
}

export interface Player {
  id: number;
  name: string;
  avatarUrl: string;
  direction: -1 | 1;
  color: string;
  healthAmt: number;
  maxHealth: number;
  focusAmt: number;
  maxFocus: number;
  isTurn: boolean;
  fizzles: Fizzle[];
}

export type GameStateName = 
  | 'PlayerDrawSpell' 
  | 'PlayerRunInference' 
  | 'PlayerPlaceSymbol'
  | 'SymbolResolution' 
  | 'PostSymbolResolution' 
  | 'GameOver'
  | 'NPCDrawSpell' 
  | 'NPCRunInference' 
  | 'NPCPlaceSymbol';

export interface BadgeState {
  type: 'DirectionSpeed' | 'DmgHealth' | 'UpdateOrder' | 'RowShift';
  value: number;
  isVisibleIfZero: boolean;
  transparencyAmt: number;
  backgroundIcon: string;
  color: string;
}

// Statutory Bounds Configurations
export const SPELL_BOUNDS = {
  SPEED: { min: -3, max: 3 },
  DAMAGE: { min: 0, max: 50 },
  ROW_SHIFT: { min: -1, max: 1 },
  ORDER: { min: 1, max: 10 }
};