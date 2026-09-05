import { Phlegm, Quicken, Ether, GyreUp, GyreDown } from './PlacedSpells/Spell';
import { Player } from './Player/Player';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};;

export type SpellPropertyName = 'upDown' | 'speedDirection' | 'dmgHealth' | 'rowShift' | 'updateOrder';

export type RowShiftDirections = 1 | 0 |-1 | undefined;

export type SpellConstructor = new (caster: Player) => Quicken | Ether | Phlegm | GyreUp | GyreDown;

export type InferenceString = 'line' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square' | 'squiggle' | 'SKIP'; // 'SKIP' for NPC AI

export type GameStateProgressionPath = 'HappyPath' | 'UnHappyPath' | 'AltPath' | 'Esc' | null;