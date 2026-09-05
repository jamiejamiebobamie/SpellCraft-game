// Symbol.ts
import { SpellConstructor, InferenceString } from '../types';
import { Player } from '../Player/Player';
import { Spell, Phlegm, Ether, GyreUp, GyreDown, Quicken } from './Spell';
import { UniqueId } from '../UniqeId';
import { proxy } from 'valtio';

export type NpcPlaceSpellOnBoardFunc = (gameSymbol: GameSymbol, cellRowIndex?: number) => Promise<void>;

export class GameSymbol extends UniqueId {
  symbolName!: InferenceString;
  readonly caster: Player;

  // Stores the recipe/class constructor rather than an already instantiated object
  private SpellClass: SpellConstructor | null = null;

  static readonly FIZZLE_INFERENCES: Array<InferenceString> = ['square', 'squiggle'];

  static readonly SPELL_LOOKUP = new Map<InferenceString, SpellConstructor>([
    ['line', Quicken],
    ['circle', Phlegm],
    ['star', Ether],
    ['diamond', GyreUp],
    ['triangle', GyreDown]
  ]);

  static readonly SPELL_NAME_LOOKUP = new Map<InferenceString, string>([
    ['line', 'Quicken'],
    ['circle', 'Phlegm'],
    ['diamond', 'Gyre'],
    ['star', 'Ether'],
    ['triangle', 'Gyre'],
  ]);

  constructor(symbolName: InferenceString, caster: Player) {
    super();
    this.caster = caster;
    this.symbolName = symbolName;
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
  instantiateSpell = (currentGlobalTurn: number): Spell | null => {
    // Validate drawing and do fizzle if invalid
    if (GameSymbol.FIZZLE_INFERENCES.includes(this.symbolName)) {
      this.caster.addFizzle(currentGlobalTurn);
      this.caster.decrementFocus(1);
      return null;
    }

    this.SpellClass = GameSymbol.SPELL_LOOKUP.get(this.symbolName) || null;

    if (!this.SpellClass) {
      // something went wrong... treat it like a Fizzle
      this.caster.addFizzle(currentGlobalTurn);
      this.caster.decrementFocus(1);
      return null;
    }

    const spell = new this.SpellClass(this.caster);
    let focusCost: number = spell.getFocusCost();

    this.incurPlayerCostForSpell(focusCost);

    // Spawn the fresh spell instance tied to the caster
    return proxy(spell);
  };

  /**
   * Deducts focus resource. Converts focus deficit into direct health damage.
   */
  incurPlayerCostForSpell = (focusCost: number): void => {
    if (this.caster.getFocus() >= focusCost) {
      this.caster.decrementFocus(focusCost);
    } else {
      // Calculate how much focus is missing
      const difference = focusCost - this.caster.getFocus();

      this.caster.depleteFocusToZero();
      this.caster.decrementHealth(difference); // Health covers the remaining resource debt
    }
  };
}