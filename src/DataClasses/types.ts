import { Phlegm, Quicken, Ether, GyreUp, GyreDown } from './PlacedSpells/Spell';
import { Player } from './Player/Player';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};

export type SpellPropertyName = 'upDown' | 'speedDirection' | 'dmgHealth' | 'rowShift' | 'updateOrder' | 'gyreLives' | 'empoweredPng' | 'empoweredSpeedDirection' | 'empoweredDmgHealth' | 'consumedEthers' | 'consumedPhlegms' | 'consumedQuickens';

export type Direction = 1 | -1 | 0; // 0 = not valid value

export type NpcDifficulty = 'Normal' | 'Hard' | 'Brutal';

// export type EmpoweredPng = 'Singular' | 'Beginning' | 'Middle' | 'End';
// export type EmpoweredPng = 0 | 1 | 2 | 3;

export type SpellConstructor = new (caster: Player) => Quicken | Ether | Phlegm | GyreUp | GyreDown;

export type InferenceString = 'line' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square' | 'squiggle' | 'SKIP'; // 'SKIP' for NPC AI

export type GameStateProgressionPath = 'HappyPath' | 'UnHappyPath' | 'AltPath' | 'Esc' | null;

export type BadgeValues = {
  dmgHealth: number;
  speedDirection: number;
  gyreLives: number;
  updateOrder: number;
}

export interface Point {
  x: number;
  y: number;
}

export type GameBoardRefDimensions = {
  left: number; top: number; width: number; height: number;
}

export type NPCMoveData = {
  inferenceString: InferenceString;
  cellIndex: CellIndex;
  scale: number;
  rotation: number // degrees
};