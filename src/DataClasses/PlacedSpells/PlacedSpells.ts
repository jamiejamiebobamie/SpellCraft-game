// PlacedSpells.ts
import { Spell } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex } from '../types';

export class PlacedSpells {
  // Properties
  spells: Array<Spell> = [];

  // --- Core Array Utilities ---

  getTop = (): Spell | null => {
    return this.spells[this.spells.length - 1]
  };

  addSpell = (spell: Spell): void => {
    // Prevent adding duplicates
    if (!this.spells.includes(spell)) {
      spell.updatePropertyValue('updateOrder', this.spells.length);
      this.spells.push(spell);
    }
  };

  removeSpell = (spell: Spell): void => {
    this.spells = this.spells.filter(s => s !== spell).map((s, i) => {
      s.updatePropertyValue('updateOrder', i + 1);
      return s;
    });
  };

  // --- Batch Engine Turn Loop Update ---

  /**
   * Batch updates all active spells on the board cell track.
   * Handles sub-stepping movements to calculate step-by-step collisions accurately.
   */
  updateSpells = (gameBoard: GameBoard): void => {
    // Loop backwards through the collection if you intend to filter/splice 
    // destroyed spells safely within the same evaluation pass.
    for (let i = 0; i < this.spells.length; i++) {
      const spell = this.spells[i];
      this.updateSpell(gameBoard, spell);
    }

    // Secondary Cleanup: Filter out any remaining phantom items that lost board references
    this.spells = this.spells.filter(spell => spell.getCellIndex() !== null);
  };

  // called above and also (TO-DO:) after placing a spell on the board for the first time
  updateSpell(gameBoard: GameBoard, spell: Spell): void {
    const currentCellIndex = spell.getCellIndex();

    // Skip evaluation if the spell has already been swept or lacks a grid home
    if (!currentCellIndex) return;

    // Extract raw speed (how many steps it must perform this tick)
    // Note: your dynamic accessor checks for property name keys
    const speed = spell.getPropertyValue('speedDirection');
    const numMoves = Math.abs(speed);

    // Clear the spell's old starting track cell presence before it steps forward
    const startingCell = gameBoard.getCellAt({ i: currentCellIndex.i, j: currentCellIndex.j });
    if (startingCell && startingCell.getSpell() === spell) { // handle spell that has a numMoves of 0(?)
      startingCell.setSpell(null);
    }

    let spellDestroyedDuringMove = false;

    // Sub-step movement loop for collision precision
    for (let j = 0; j < numMoves; j++) {
      // 1. Advance the internal coordinates of the spell instance
      spell.move();

      const newCellIndex = spell.getCellIndex();

      // Safety check: verify if the move pushed the projectile off the map entirely
      if (!newCellIndex || gameBoard.getIsOffBoardAt({ i: newCellIndex.i, j: newCellIndex.j })) {
        this.removeSpell(spell);
        spell.setCellIndex(null);
        spellDestroyedDuringMove = true;
        break; // Stop evaluating sub-steps for this spell
      }

      // Map coordinates cleanly to rows (i) and columns (j)
      const targetCellIndex: CellIndex = { i: newCellIndex.i, j: newCellIndex.j };
      const cell = gameBoard.getCellAt(targetCellIndex);

      if (!cell) continue;

      // 2. Check for Endzone Opponent Base collisions first
      if (cell.getIsPlayerCell()) {
        const owner = cell.getCellOwner();
        if (owner && owner !== spell.caster) {
          // Apply damage or player impacts
          spell.resolvePlayerCollision(owner);
          this.removeSpell(spell);
          spellDestroyedDuringMove = true;
          break; // Projectile exploded against opponent base
        }
      }

      // 3. Check for Projectile-on-Projectile Collisions
      if (!cell.getIsFree()) {
        const otherSpell = cell.getSpell();
        if (otherSpell && otherSpell !== spell) {
          // spell consumes otherSpell and absorbs its properties
          spell.resolveSpellCollision(otherSpell);

          // Clean up the consumed spell out of our batch engine registry
          this.removeSpell(otherSpell);

          // check if spell has invalid stats that requires removal
          if (spell.isModifierValueInvalid()) {
            this.removeSpell(spell);
            spellDestroyedDuringMove = true;
            break; // Projectile exploded against opponent base
          }
        }
      }

      // 4. Update board map link context on the final step
      const isLastSpellMove = j + 1 === numMoves;
      if (isLastSpellMove && !spellDestroyedDuringMove) {
        cell.setSpell(spell);
      }
    }
  }
}

