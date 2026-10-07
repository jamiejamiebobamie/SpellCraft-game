// Symbol.ts
import { SpellConstructor, InferenceString } from '../types';
import { Player } from '../Player/Player';
import { Spell, Phlegm, Ether, GyreUp, GyreDown, Quicken } from './Spell';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

/*

  In-between helper class.
  Links player-drawn inference symbol/string to "Spell" class.

  FUNCTIONS:
    - maps inference string to Spell class
    - used to start/stop IK_ARMComponent CSS anims
    - used to display "Readied Spell" cursor spell

  "Player" class HAS a GameSymbol.
  "Game" class HAS a Player GameSymbol.

*/
export class GameSymbol extends UniqueId {
  symbolName!: InferenceString;
  readonly caster: Player;

  // Stores the recipe/class constructor rather than an already instantiated object
  private SpellClass: SpellConstructor | null = null;

  static readonly FIZZLE_INFERENCES: Array<InferenceString> = ['square', 'squiggle'];

  static readonly SPELL_LOOKUP = new Map<InferenceString, SpellConstructor>([
    ['line', Quicken],
    ['circle', Ether],
    ['diamond', GyreUp],
    ['triangle', GyreDown],
    ['star', Phlegm],
  ]);

  constructor(symbolName: InferenceString, caster: Player) {
    super();
    this.caster = caster;
    this.symbolName = symbolName;
    this.SpellClass = GameSymbol.SPELL_LOOKUP.get(symbolName) || null;
  }

  getSpellClass(): SpellConstructor | null {
    return this.SpellClass;
  }

  setSpellClass(SpellClass: SpellConstructor) {
    this.SpellClass = SpellClass;
  }

  /**
   * Main factory method. Handles cost, validation, and instantiation.
   * Returns the Spell instance if successful, or null if the drawing "Fizzles".
   * 
   * @param strokeLength The length or duration of the player's drawing gesture
   */
  instantiateSpell = (): Spell | null => {
    // Validate drawing and do fizzle if invalid
    if (GameSymbol.FIZZLE_INFERENCES.includes(this.symbolName)) {
      return null;
    }

    this.SpellClass = GameSymbol.SPELL_LOOKUP.get(this.symbolName) || null;

    if (!this.SpellClass) {
      // something went wrong... treat it like a Fizzle
      return null;
    }

    const spell = proxy(new this.SpellClass(this.caster));
    return proxy(spell);
  };
}