// GameBoard/PlacedSpells.ts
import { Spell } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { proxy } from 'valtio';
import { SpellMovementEngine, SpellTurnFrame, SpellTurnFrameKind, combineSpellsMaximally, copySpellGraph, indexSpellGraph } from './SpellMovementEngine';

export class PlacedSpells {
  spells: Array<Spell> = proxy([]);
  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 100; // for micro steps
  static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 1000; // for entire spell movement turn (time it takes for all spells to finish all moves)

  // static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 1000; // for micro steps
  // static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 3000; // for entire spell movement turn (time it takes for all spells to finish all moves)

  private static readonly FRAME_DELAY_MILLI: Record<SpellTurnFrameKind, number> = {
    step: PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI,
    turnEnd: PlacedSpells.SPELL_MOVEMENT_TURN_DELAY_MILLI,
    final: 0,
  };

  addSpell(spell: Spell): void {
    if (!this.spells.includes(spell)) {
      this.spells.push(spell);
    }
  }

  reset(): void {
    this.spells.splice(0);
  }

  /**
   * Runs the spell-movement turn in the rules engine, then replays the resulting frames on the
   * live (rendered) spells. Returns whether any spells collided (or interacted) this turn.
   */
  async updateSpells(gameBoard: GameBoard, forceUpdate: Function, decrementPlayerHealth: Function): Promise<boolean> {
    const { frames } = new SpellMovementEngine(this.spells).simulateTurn();

    // Every live spell seen during the replay, by id, so frames can update them in place
    const liveSpells = new Map<string, Spell>();
    indexSpellGraph(this.spells, liveSpells);

    // A collision: a step removes more spells than hit a wizard (each hit is a health event), or a
    // spell interacts (reflected, lifted, buffed)
    let isCollision = false;
    const removedIds = new Set<string>();
    for (const frame of frames) {
      const removedNow = frame.spells.filter(s => s.getIsRemove() && !removedIds.has(s.id));
      removedNow.forEach(s => removedIds.add(s.id));
      if (removedNow.length > frame.healthEvents.length || frame.interactionEvents.length > 0) isCollision = true;

      frame.healthEvents.forEach(e => decrementPlayerHealth(e.playerIndex, e.dmg));
      this.applyFrame(frame, liveSpells, gameBoard);
      forceUpdate();
      const delay = PlacedSpells.FRAME_DELAY_MILLI[frame.kind];
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
    return isCollision;
  }

  /** Collides a spell just cast onto an enemy spell (SpellMovementEngine.resolveCastCollisions). */
  async resolveCastCollisions(gameBoard: GameBoard, forceUpdate: Function): Promise<void> {
    const { frames } = new SpellMovementEngine(this.spells).resolveCastCollisions();
    const liveSpells = new Map<string, Spell>();
    indexSpellGraph(this.spells, liveSpells);
    for (const frame of frames) {
      this.applyFrame(frame, liveSpells, gameBoard);
      forceUpdate();
      // Long enough to see the collision's effects before its results are removed
      if (frame.kind === 'step') await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_TURN_DELAY_MILLI / 2));
    }
  }

  private applyFrame(frame: SpellTurnFrame, liveSpells: Map<string, Spell>, gameBoard: GameBoard): void {
    const nextSpells = copySpellGraph(frame.spells, liveSpells);

    const isSameMembership = nextSpells.length === this.spells.length && nextSpells.every((s, k) => this.spells[k]?.id === s.id);
    if (!isSameMembership) {
      this.spells = proxy(nextSpells);
      // Track the proxied versions so later frames update through valtio
      this.spells.forEach(s => liveSpells.set(s.id, s));
    }

    gameBoard.cells.forEach(c => c.setSpell(null));
    this.setCellsFromSpells(gameBoard);
  }

  private setCellsFromSpells(gameBoard: GameBoard): void {
    this.spells.forEach(s => {
      if (s.getIsRemove()) return;
      const idx = s.getCellIndex();
      if (!idx) return;
      for (let r = 0; r < s.heightCells; r++) {
        for (let c = 0; c < s.widthCells; c++) {
          const targetI = idx.i + r;
          const targetJ = idx.j + c;
          if (targetI >= 0 && targetI < GameBoard.NUM_ROWS && targetJ >= 0 && targetJ < GameBoard.NUM_COLS) {
            const cell = gameBoard.getCellAt({ i: targetI, j: targetJ });
            if (cell) cell.setSpell(s);
          }
        }
      }
    });
  }

  public combineSpellsMaximally(gameBoard: GameBoard): void {
    combineSpellsMaximally(this.spells);
    this.setCellsFromSpells(gameBoard);
  }
}
