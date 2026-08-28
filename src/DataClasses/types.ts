import { Spell } from './PlacedSpells/Spell';
import { Player } from './Player/Player';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};;

export type SpellPropertyName = 'speedDirection' | 'dmgHealth' | 'rowShift';

export type RowShiftDirections = 1 | 0 |-1 | undefined;

export type SpellConstructor = new (caster: Player, rowShift?: RowShiftDirections) => Spell;

export type InferenceString = 'line' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square' | 'squiggle';

export type GameStateProgressionPath = 'HappyPath' | 'UnHappyPath' | 'AltPath' | 'Esc' | null;
