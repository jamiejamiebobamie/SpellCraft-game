// PlacedSpells.ts
import { Spell } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex } from '../types';
import { proxy } from 'valtio';
import { GameLog } from '../GameLog';

export class PlacedSpells {
  // Properties
  spells: Array<Spell> = proxy([]);
  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 300;
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

  // setSpellMovementDelay = (delay: number) => {
  //   PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI = delay;
  // }

  reset = (): void => {
    this.spells.splice(0);
  }

  // removeSpell = (spell: Spell): void => {
  //   spell.markSpellForRemoval();
  //   let count = 1;
  //   this.spells.forEach(s => {
  //     if (!s.isRemove) {
  //       s.updatePropertyValue('updateOrder', count);
  //       count++;
  //     }
  //   });
  // };

  removeInvalidSpells = (): void => {
    const markedForRemoval = this.spells.filter(spell => spell.getIsRemove());
    markedForRemoval.forEach(s => {
      const i = this.spells.indexOf(s);
      if (i != -1) this.spells.splice(i, 1);
    })
    let count = 1;
    this.spells.forEach(s => {
      if (!s.isRemove) {
        s.updatePropertyValue('updateOrder', count);
        count++;
      }
    });
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

  /**
   * Batch updates all active spells on the board cell track.
   * Handles sub-stepping movements to calculate step-by-step collisions accurately.
   */
  updateSpells = async (gameBoard: GameBoard, gameLog: GameLog, forceUpdate: Function): Promise<void> => {
    const spellRange = this.getRangedArray(this.spells.length);
    // Consume the async generator
    for await (const i of this.timedIterator(spellRange, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
      await this.updateSpell(gameBoard, gameLog, this.spells[i], forceUpdate);
    }
    gameBoard.setEmpoweredSpells();
    // Cleanup: Filter out any remaining phantom items that lost board references
    // forceUpdate();
    // Add extra time for CSS to update
    // await this.pauseForCssUpdates();
    this.removeInvalidSpells();
    forceUpdate();
  };

  pauseForCssUpdates = async (): Promise<void> => {
    const spellRange = this.getRangedArray(this.spells.length);
    for await (const _ of this.timedIterator(spellRange, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));
  }

  // called in 'updateSpells' and after placing a spell on the board for the first time
  updateSpell = async (gameBoard: GameBoard, gameLog: GameLog, spell: Spell, forceUpdate: Function): Promise<void> => {
    if (!spell || spell.getIsRemove()) return;

    const currentCellIndex = spell.getCellIndex();
    if (!currentCellIndex) return;

    // Clear the spell's old starting track cell presence before it steps forward
    const startingCell = gameBoard.getCellAt({ i: currentCellIndex.i, j: currentCellIndex.j });
    if (startingCell && startingCell.getSpell() === spell) {
      startingCell.setSpell(null);
    }

    let spellDestroyedDuringMove = false;

    const speed = spell.getPropertyValue('empoweredSpeedDirection');
    const numMoves = Math.abs(speed);
    const moves = this.getRangedArray(numMoves);
    for await (const j of this.timedIterator(moves, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
      spell.moveHorizontally();
      forceUpdate();

      let nextCellIndex = spell.getCellIndex();
      if (spell.getIsRemove() || !nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: nextCellIndex.j })) {
        spell.markSpellForRemoval();
        spellDestroyedDuringMove = true;
        // forceUpdate();
        break; // Stop evaluating sub-steps for this spell
      }

      // Map coordinates cleanly to rows (i) and columns (j)
      let targetCellIndex: CellIndex = { i: nextCellIndex.i, j: nextCellIndex.j };
      let cell = gameBoard.getCellAt(targetCellIndex);
      if (!cell) continue;

      if (!!cell && !cell.getIsFree()) {
        const otherSpell = cell.getSpell();
        if (otherSpell && otherSpell.getIsRemove()) {
          cell.setSpell(null); // <-- HACK... TO-DO: Have 'spell.markForRemoval' clear cell of spell...
        }
      }

      // Check for Projectile-on-Projectile Collision
      while (!!cell && !cell.getIsFree()) {
        const otherSpell = cell.getSpell();
        if (otherSpell && otherSpell !== spell) {
          // Spell consumes otherSpell and absorbs its properties
          spell.resolveSpellCollision(otherSpell);

          // Clear cell of the removed spell
          if (otherSpell.getIsRemove())
            cell.setSpell(null);

          const upDown = spell.getPropertyValue('upDown');
          const numVerticalMoves = Math.abs(upDown);
          const moves = this.getRangedArray(numVerticalMoves);
          for await (const _ of this.timedIterator(moves, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
            // Do vertical movement if 'otherSpell' was Gyre
            spell.moveVertically();
            forceUpdate();
          }

          nextCellIndex = spell.getCellIndex();

          // Safety check: verify if the move pushed the projectile off the map entirely
          if (spell.getIsRemove() || !nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: nextCellIndex.j })) {
            spell.markSpellForRemoval();
            spellDestroyedDuringMove = true;
            cell = null;
            // forceUpdate();
            break; // Stop evaluating sub-steps for this spell
          }

          // Map coordinates cleanly to rows (i) and columns (j)
          targetCellIndex = { i: nextCellIndex.i, j: nextCellIndex.j };
          cell = gameBoard.getCellAt(targetCellIndex);
        }
      }

      if (!cell) continue;

      // Check for Projectile-on-Player Collision
      if (cell.getIsPlayerCell()) {
        const owner = cell.getCellOwner();
        if (spell.getIsPlaced() && owner) {
          const direction = Math.sign(spell.getPropertyValue('speedDirection'));
          // Check to see if the spell did not reverse direction at last spell collision
          if (!spell.getIsRemove() && direction != owner.getDirection()) {

            // Move spell ONTO player avatar
            const moves = this.getRangedArray(3);
            for await (const _ of this.timedIterator(moves, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI)) {
              // Do vertical movement if otherSpell was 'Gyre'
              spell.moveHorizontally();
              forceUpdate();
            }

            const dmgHealth = spell.getPropertyValue('empoweredDmgHealth');
            spell.resolvePlayerCollision(owner, dmgHealth);
            spell.markSpellForRemoval();
            gameLog.appendEntry(`${spell.getCaster().getDirection() == 1 ? 'Your' : 'Their'} ${spell.getSpellName()} spell ${spell.getPropertyValue('empoweredDmgHealth') > 0 ? 'damaged' : 'healed'} ${owner.getDirection() == 1 ? 'you' : 'your opponent'} for ${spell.getPropertyValue('empoweredDmgHealth') * (spell.getPropertyValue('empoweredDmgHealth') > 0 ? 1 : -1)} ${spell.getPropertyValue('empoweredDmgHealth') > 0 ? 'damage' : 'health'}.`, '#b2077c')
            spellDestroyedDuringMove = true;
            // forceUpdate();
            break;
          }
        }
      }

      // Update board map link context on the final step
      const isLastSpellMove = j + 1 === numMoves;
      if (isLastSpellMove && !spellDestroyedDuringMove) {
        cell.setSpell(spell);
      }
      forceUpdate();
    }
  }
}