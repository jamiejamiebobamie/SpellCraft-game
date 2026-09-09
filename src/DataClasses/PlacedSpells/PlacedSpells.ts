// PlacedSpells.ts
import { Spell } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex } from '../types';
import { proxy } from 'valtio';
import { GameLog } from '../GameLog';

export class PlacedSpells {
  // Properties
  spells: Array<Spell> = proxy([]);
  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 500;
  // --- Core Array Utilities ---

  getTop = (): Spell | null => {
    return this.spells[this.spells.length - 1]
  };

  addSpell = (spell: Spell): void => {
    // Prevent adding duplicates
    if (!this.spells.includes(spell)) {
      // this.spells.unshift(spell); // TESTING: FIFO priority ordering
      this.spells.push(spell);
      let count: number = 1;
      this.spells.forEach(s => {
        if (!s.isRemove) {
          s.updatePropertyValue('updateOrder', count);
          count++;
        }
      });
    }
  };

  reset = (): void => {
    this.spells.splice(0);
  }

  removeSpell = (spell: Spell): void => {
    spell.markSpellForRemoval();
    let count = 1;
    this.spells.forEach(s => {
      if (!s.isRemove) {
        s.updatePropertyValue('updateOrder', count);
        count++;
      }
    });
  };

  removeInvalidSpells = (): void => {
    const markedForRemoval = this.spells.filter(spell => spell.getIsRemove());
    markedForRemoval.forEach(s => {
      const i = this.spells.indexOf(s);
      if (i != -1) this.spells.splice(i, 1);
    })
  }

  // --- Batch Engine Turn Loop Update ---

  /**
   * 2. The Async Generator function
   * @param items An array of items to iterate through
   * @param delayTime The delay time in milliseconds (can be dynamically changed outside)
   */
  async* timedIterator<T>(
    items: T[],
    delayTime: number // Wrapped in an object so reference updates pass through
  ): AsyncGenerator<T, void, unknown> {
    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));
    for (const item of items) {
      // Wait for the current duration specified in your configuration variable
      await wait(delayTime);

      // Yield the item to the loop consuming it
      yield item;
    }
  }

  getRangedArray = (range: number): Array<number> => {
    return Array(range).fill(0).map((_, i) => i);
  }


  // TO-DO: figure out why some spells are able to bypass each other on the same row...

  /**
   * Batch updates all active spells on the board cell track.
   * Handles sub-stepping movements to calculate step-by-step collisions accurately.
   */
  updateSpells = async (gameBoard: GameBoard, gameLog: GameLog, forceUpdate: Function): Promise<void> => {

    const spellRange = this.getRangedArray(this.spells.length);
    // Consume the async generator
    for await (const i of this.timedIterator(spellRange, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
      this.updateSpell(gameBoard, gameLog, this.spells[i], forceUpdate);
    }
    // TO-DO: call this outside of (and after) 'updateSpells' to allow for slow fade on collision with Players...
    // // Cleanup: Filter out any remaining phantom items that lost board references
    this.removeInvalidSpells();

    // add extra time for CSS to update
    await this.pauseForCssUpdates();
  };

  pauseForCssUpdates = async (): Promise<void> => {
    const spellRange = this.getRangedArray(this.spells.length);
    for await (const _ of this.timedIterator(spellRange, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));
  }

  // called in 'updateSpells' and after placing a spell on the board for the first time
  updateSpell = async (gameBoard: GameBoard, gameLog: GameLog, spell: Spell, forceUpdate: Function): Promise<void> => {
    if (spell.getIsRemove()) return;

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

    const moves = this.getRangedArray(numMoves);
    for await (const j of this.timedIterator(moves, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
      // 1. Advance the internal coordinates of the spell instance
      spell.moveHorizontally();
      forceUpdate();
      let nextCellIndex = spell.getCellIndex();

      // Safety check: verify if the move pushed the projectile off the map entirely
      if (!nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: nextCellIndex.j })) {
        this.removeSpell(spell);
        spellDestroyedDuringMove = true;
        gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Your' : 'Their'} ${spell.getSpellName()} spell ricocheted out of sight!`, '#b2077c');
        forceUpdate();
        break; // Stop evaluating sub-steps for this spell
      }

      // Map coordinates cleanly to rows (i) and columns (j)
      let targetCellIndex: CellIndex = { i: nextCellIndex.i, j: nextCellIndex.j };
      let cell = gameBoard.getCellAt(targetCellIndex);

      if (!cell) continue;

      // 3. Check for Projectile-on-Projectile Collisions
      while (!!cell && !cell.getIsFree()) {
        const otherSpell = cell.getSpell();
        if (otherSpell && otherSpell !== spell) {
          // spell consumes otherSpell and absorbs its properties
          spell.resolveSpellCollision(otherSpell);

          // gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Player1\'s' : 'Player2\'s'} ${spell.getSpellName()} spell has consumed ${otherSpell.getCaster().getDirection() == 1 ? 'Player1\'s' : 'Player2\'s'} ${otherSpell.getSpellName()} spell.`, '#b2077c')
          // gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Player1\'s' : 'Player2\'s'} ${spell.getSpellName()} spell has ${otherSpell.getModifierLogText(spell)}`, '#b2077c')

          // Clean up the consumed spell out of our batch engine registry
          this.removeSpell(otherSpell);
          forceUpdate();

          // Clear cell of the removed spell
          cell.setSpell(null);

          // Do vertical movement if otherSpell was 'Gyre'
          spell.moveVertically();
          forceUpdate();

          nextCellIndex = spell.getCellIndex();

          // Safety check: verify if the move pushed the projectile off the map entirely
          if (!nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: nextCellIndex.j })) {
            this.removeSpell(spell);
            spellDestroyedDuringMove = true;
            gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Your' : 'Their'} ${spell.getSpellName()} spell ricocheted out of sight!`, '#b2077c');
            cell = null;
            forceUpdate();
            break; // Stop evaluating sub-steps for this spell
          }

          // Map coordinates cleanly to rows (i) and columns (j)
          targetCellIndex = { i: nextCellIndex.i, j: nextCellIndex.j };
          cell = gameBoard.getCellAt(targetCellIndex);

          // check if spell has invalid stats that requires removal
          // if (spell.isModifierValueInvalid()) {
          //   this.removeSpell(spell);
          //   spellDestroyedDuringMove = true;
          //   break; // Projectile exploded against opponent base
          // }
        }
      }

      if (!cell) continue;


      // 2. Check for Endzone Opponent Base collisions first
      if (cell.getIsPlayerCell()) {
        const owner = cell.getCellOwner();
        if (spell.getIsPlaced() && owner) {
          // Apply damage or player impacts

          const direction = Math.sign(spell.getPropertyValue('speedDirection'));
          // Check to see if the spell did not reverse direction at last spell collision
          if (direction != owner.getDirection()) {
            spell.getPropertyValue('dmgHealth')
            spell.resolvePlayerCollision(owner);
            gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Your' : 'Their'} ${spell.getSpellName()} spell ${spell.getPropertyValue('dmgHealth') > 0 ? 'damaged' : 'healed'} ${owner.getDirection() == 1 ? 'Your' : 'Their'} for ${spell.getPropertyValue('dmgHealth') * (spell.getPropertyValue('dmgHealth') > 0 ? 1 : -1)} ${spell.getPropertyValue('dmgHealth') > 0 ? 'damage' : 'health'}.`, '#b2077c')
            this.removeSpell(spell);
            spellDestroyedDuringMove = true;
            forceUpdate();
            break; // Projectile exploded against opponent base
          }
        }
      }

      // 4. Update board map link context on the final step
      const isLastSpellMove = j + 1 === numMoves;
      if (isLastSpellMove && !spellDestroyedDuringMove) {
        cell.setSpell(spell);
      }
      forceUpdate();
    }
    // Cleanup: Filter out any remaining phantom items that lost board references
    // this.removeInvalidSpells();
  }
}