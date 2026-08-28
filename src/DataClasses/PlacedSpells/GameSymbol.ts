// Symbol.ts
import { SpellConstructor, InferenceString, RowShiftDirections } from '../types';
import { Player } from '../Player/Player';
import { Spell, Phlegm, Ether, Gyre, Quicken } from './Spell';

export class GameSymbol {
  private readonly caster: Player;
  private focusCost: number = 0;

  // Stores the recipe/class constructor rather than an already instantiated object
  private SpellClass: SpellConstructor | null = null;

  private static readonly FIZZLE_INFERENCES = ['square', 'squiggle'];
  private static readonly SPELL_LOOKUP = new Map<InferenceString, SpellConstructor>([
    ['line', Quicken],
    ['circle', Phlegm],
    ['star', Ether],
    ['triangle', Gyre],
    ['diamond', Gyre]
  ])
    private static readonly ROW_SHIFT_LOOKUP = new Map<InferenceString, RowShiftDirections>([
    ['line', 0],
    ['circle', 0],
    ['star', 0],
    ['triangle', -1],
    ['diamond', 1]
  ])

  constructor(caster: Player) {
    this.caster = caster;
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
  instantiateSpell = (inference: InferenceString, currentGlobalTurn: number): Spell | null => {
    // Validate drawing and do fizzle if invalid
    if (GameSymbol.FIZZLE_INFERENCES.includes(inference)) {
      this.caster.addFizzle(currentGlobalTurn);
      return null;
    }

    this.SpellClass = GameSymbol.SPELL_LOOKUP.get(inference) || null;

    if (!this.SpellClass) {
      // something went wrong... treat it like a Fizzle
      this.caster.addFizzle(currentGlobalTurn);
      return null;
    }

    let rowShift: RowShiftDirections = GameSymbol.ROW_SHIFT_LOOKUP.get(inference) || 0;
    const spell = new this.SpellClass(this.caster, rowShift);
    this.focusCost = spell.getFocusCost();

    this.incurPlayerCostForSpell();

    // Spawn the fresh spell instance tied to the caster
    return spell;
  };

  /**
   * Deducts focus resource. Converts focus deficit into direct health damage.
   */
  incurPlayerCostForSpell = (): void => {
    if (this.caster.getFocus() >= this.focusCost) {
      this.caster.decrementFocus(this.focusCost);
    } else {
      // Calculate how much focus is missing
      const difference = this.focusCost - this.caster.getFocus();

      this.caster.depleteFocus();
      this.caster.decrementHealth(difference); // Health covers the remaining resource debt
    }
  };
}