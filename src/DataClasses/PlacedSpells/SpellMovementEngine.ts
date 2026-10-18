// SpellMovementEngine.ts
// Pure, synchronous spell-movement rules engine: no timers, rendering, React, or valtio.
// Runs a full spell-movement turn on a cloned copy of the placed spells and returns a log of
// frames for the UI to replay (see PlacedSpells.updateSpells).
//
// STEP 1 OF THE REBUILD: the rules below are moved verbatim from PlacedSpells.ts so the game
// plays the same. Known bugs are intentionally preserved (see spell-movement-requirements.md,
// "Known bugs") and will be replaced as the rebuild progresses.
import { Spell, Phlegm, Ether, Gyre, GyreUp, GyreDown, Quicken } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex, CollisionResult } from '../types';

/**
 * 'step':    shown after each micro-step
 * 'breakup': shown when a sized spell breaks into pieces, before the pieces move
 * 'turnEnd': shown after all moves, before removed spells are cleared
 * 'final':   the board state at the end of the turn
 */
export type SpellTurnFrameKind = 'step' | 'breakup' | 'turnEnd' | 'final';

export type HealthEvent = { playerIndex: number; dmg: number };

export type SpellTurnFrame = {
  kind: SpellTurnFrameKind;
  spells: Array<Spell>; // deep copies, safe to keep
  healthEvents: Array<HealthEvent>; // applied when this frame is shown
};

export type SpellTurnLog = {
  frames: Array<SpellTurnFrame>;
};

// Max micro-steps per turn, guarding against infinite loops
const MAX_MICRO_STEPS = 50;

// --- Spell copying ---------------------------------------------------------------------------

// Fields that are not copied as plain data
const SKIPPED_SPELL_KEYS = new Set(['id', 'caster', 'limits', 'consumedSpellRef']);

const copySpellData = (src: Spell, dst: Spell): void => {
  Object.keys(src).forEach(key => {
    if (SKIPPED_SPELL_KEYS.has(key)) return;
    const value = (src as any)[key];
    if (typeof value === 'function') return;
    if (value instanceof Set) (dst as any)[key] = new Set(value);
    else if (value && typeof value === 'object') (dst as any)[key] = { ...value };
    else (dst as any)[key] = value;
  });
};

const instantiateLike = (src: Spell): Spell => {
  const spell: Spell = new (src.constructor as any)(src.caster);
  spell.id = src.id;
  return spell;
};

/**
 * Copies the state of `spells` (including spells they reference via consumedSpellRef) onto the
 * spells in `targets`, matched by id. Spells missing from `targets` are created and added to it.
 * Returns the targets matching `spells`, in order.
 */
export const copySpellGraph = (spells: Array<Spell>, targets: Map<string, Spell> = new Map()): Array<Spell> => {
  const visited = new Set<string>();
  const sync = (src: Spell): Spell => {
    let dst = targets.get(src.id);
    if (!dst) {
      dst = instantiateLike(src);
      targets.set(src.id, dst);
    }
    if (visited.has(src.id)) return dst;
    visited.add(src.id);
    copySpellData(src, dst);
    dst.consumedSpellRef = src.consumedSpellRef ? sync(src.consumedSpellRef) : null;
    return dst;
  };
  return spells.map(sync);
};

/** Adds `spells` and every spell they reference via consumedSpellRef to `index`, by id. */
export const indexSpellGraph = (spells: Array<Spell>, index: Map<string, Spell>): void => {
  const visit = (spell: Spell | null): void => {
    if (!spell || index.has(spell.id)) return;
    index.set(spell.id, spell);
    visit(spell.consumedSpellRef);
  };
  spells.forEach(visit);
};

/** Pieces broken off the same spell never collide with each other. */
const isSameSpellPieces = (a: Spell, b: Spell): boolean => !!a.fragmentGroupId && a.fragmentGroupId === b.fragmentGroupId;

const overlapsBoundingBox = (
  posA: CellIndex, wA: number, hA: number,
  posB: CellIndex, wB: number, hB: number
): boolean => {
  return (
    posA.j < posB.j + wB &&
    posA.j + wA > posB.j &&
    posA.i < posB.i + hB &&
    posA.i + hA > posB.i
  );
};

// --- Engine ----------------------------------------------------------------------------------

type CollisionOutcome = CollisionResult & {
  // The old async doCollision awaited one extra microtask when it shattered a spell
  isShattered: boolean;
};

export class SpellMovementEngine {
  spells: Array<Spell>;

  private frames: Array<SpellTurnFrame> = [];
  private pendingHealthEvents: Array<HealthEvent> = [];

  /**
   * Collision results the old async implementation applied late (after the micro-step's moves).
   * Preserved to keep behavior identical; ticks = microtask depth, flushed in that order.
   */
  private deferred: Array<{ ticks: 1 | 2; apply: () => void }> = [];

  // Set when a sized spell breaks apart, so the break-up gets its own frame
  private isShatteredSinceLastFrame: boolean = false;

  constructor(spells: Array<Spell>) {
    this.spells = copySpellGraph(spells);
  }

  simulateTurn = (): SpellTurnLog => {
    this.frames = [];

    this.spells.forEach(s => {
      if (!s.getIsRemove()) {
        const moves = Math.abs(s.getPropertyValue('speedDirection'));
        s.remainingMoves = moves;
        s.recordedMovesCount = 0;
      }
    });

    let currentMicroStep = 1;

    while (true) {
      let maxMovesNeeded = 0;
      this.spells.forEach(s => {
        if (!s.getIsRemove()) {
          const totalSpellSteps = s.recordedMovesCount + s.remainingMoves + Math.abs(s.consumedGyres || 0);
          if (totalSpellSteps > maxMovesNeeded) {
            maxMovesNeeded = totalSpellSteps;
          }
        }
      });

      if (currentMicroStep > maxMovesNeeded || maxMovesNeeded === 0) {
        break;
      }

      const positionCache = this.cachePositions();
      this.handleLookAheadCollisions(positionCache);
      this.captureBreakupFrame();

      const anySpellMoved = this.executeSynchronousMicroSteps();
      if (!anySpellMoved) break;

      this.handleMidStepCollisions(positionCache);
      this.captureFrame('step');

      this.resolveGridCollisions();
      this.captureBreakupFrame();
      currentMicroStep++;

      if (currentMicroStep > MAX_MICRO_STEPS) {
        break;
      }
    }

    this.spells.forEach(s => {
      s.consumedGyres = 0;
      s.consumedPhlegms = 0;
    });

    this.removeConsumed();
    this.captureFrame('turnEnd');

    this.removeInvalidSpells();
    this.spells.forEach(s => { s.fragmentGroupId = ''; }); // pieces only stay grouped for the turn they broke apart
    combineSpellsMaximally(this.spells);
    this.captureFrame('final');

    return { frames: this.frames };
  };

  private captureFrame = (kind: SpellTurnFrameKind): void => {
    this.flushDeferred();
    this.frames.push({ kind, spells: copySpellGraph(this.spells), healthEvents: this.pendingHealthEvents });
    this.pendingHealthEvents = [];
    this.isShatteredSinceLastFrame = false;
  };

  /**
   * Shows spells that just broke apart, in place, before their pieces move.
   * Display only: unlike captureFrame, it does not apply deferred collision results.
   */
  private captureBreakupFrame = (): void => {
    if (!this.isShatteredSinceLastFrame) return;
    this.frames.push({ kind: 'breakup', spells: copySpellGraph(this.spells), healthEvents: this.pendingHealthEvents });
    this.pendingHealthEvents = [];
    this.isShatteredSinceLastFrame = false;
  };

  private flushDeferred = (): void => {
    const pending = this.deferred;
    this.deferred = [];
    pending.filter(d => d.ticks === 1).forEach(d => d.apply());
    pending.filter(d => d.ticks === 2).forEach(d => d.apply());
  };

  private removeConsumed = (): void => {
    this.spells.filter(spell => !!spell.consumingSpellIds.size).forEach(s => s.markSpellForRemoval());
  };

  private removeInvalidSpells = (): void => {
    this.spells = this.spells.filter(spell => !spell.getIsRemove());
  };

  private cachePositions = (): Map<string, CellIndex> => {
    const positionCache = new Map<string, CellIndex>();
    this.spells.forEach(s => {
      if (s.getIsRemove()) return;
      const idx = s.getCellIndex();
      if (idx) {
        positionCache.set(s.id, { i: idx.i, j: idx.j });
      }
    });
    return positionCache;
  };

  private handleLookAheadCollisions = (positionCache: Map<string, CellIndex>): void => {
    const resolvedLookAheads = new Set<string>();

    for (let i = 0; i < this.spells.length; i++) {
      for (let j = i + 1; j < this.spells.length; j++) {
        const spellA = this.spells[i];
        const spellB = this.spells[j];

        if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA) || isSameSpellPieces(spellA, spellB)) continue;

        const posA = spellA.getCellIndex();
        const posB = spellB.getCellIndex();
        if (!posA || !posB) continue;

        const nextJA = posA.j + Math.sign(spellA.getPropertyValue('speedDirection')) * (spellA.remainingMoves > 0 ? 1 : 0);
        const nextJB = posB.j + Math.sign(spellB.getPropertyValue('speedDirection')) * (spellB.remainingMoves > 0 ? 1 : 0);

        const futurePosA = { i: posA.i, j: nextJA };
        const futurePosB = { i: posB.i, j: nextJB };

        const wA = spellA.widthCells;
        const hA = spellA.heightCells;
        const wB = spellB.widthCells;
        const hB = spellB.heightCells;

        const willCollide =
          overlapsBoundingBox(futurePosA, wA, hA, posB, wB, hB) &&
          overlapsBoundingBox(futurePosB, wB, hB, posA, wA, hA);

        if (willCollide) {
          const pairKey = [spellA.id, spellB.id].sort().join('_');
          if (resolvedLookAheads.has(pairKey)) continue;
          resolvedLookAheads.add(pairKey);

          this.processCollisionPair(spellA, spellB, positionCache, true);
        }
      }
    }
  };

  private executeSynchronousMicroSteps = (): boolean => {
    let anySpellMoved = false;

    for (const spell of this.spells) {
      if (spell.getIsRemove() || spell.getIsBeingConsumed()) continue;

      if (spell.remainingMoves <= 0 && (!spell.consumedGyres || spell.consumedGyres === 0)) continue;

      anySpellMoved = true;
      spell.recordedMovesCount++;

      if (!spell.consumedGyres || spell.consumedGyres === 0) {
        spell.remainingMoves--;
      }

      spell.executeSingleMicroStep();

      const nextCellIndex = spell.getCellIndex();
      if (!nextCellIndex) continue;

      const minI = nextCellIndex.i;
      const maxI = nextCellIndex.i + (spell.heightCells - 1);
      const minJ = nextCellIndex.j;
      const maxJ = nextCellIndex.j + (spell.widthCells - 1);

      if (minJ < 0 || maxJ >= GameBoard.NUM_COLS) {
        const isLeftExit = minJ < 0;
        const dmg = spell.getPropertyValue('dmgHealth');
        const playerIndex = isLeftExit ? 0 : 1;

        spell.flagHitImpact(isLeftExit, dmg);

        this.pendingHealthEvents.push({ playerIndex, dmg });
        spell.markSpellForRemoval();
        continue;
      }

      if (minI < 0 || maxI >= GameBoard.NUM_ROWS) {

        const validMinI = Math.max(0, minI);
        const validMaxI = Math.min(GameBoard.NUM_ROWS - 1, maxI);
        const newHeight = (validMaxI - validMinI) + 1;

        if (newHeight <= 0) {
          spell.markSpellForRemoval();
        } else {
          spell.heightCells = newHeight;
          spell.setCellIndex({ i: validMinI, j: nextCellIndex.j });

          spell.consumedGyres = 0;
        }
      }
    }
    return anySpellMoved;
  };

  private handleMidStepCollisions = (positionCache: Map<string, CellIndex>): void => {
    const resolvedCollisions = new Set<string>();

    for (let i = 0; i < this.spells.length; i++) {
      for (let j = i + 1; j < this.spells.length; j++) {
        const spellA = this.spells[i];
        const spellB = this.spells[j];

        if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA) || isSameSpellPieces(spellA, spellB)) continue;

        const startA = positionCache.get(spellA.id);
        const startB = positionCache.get(spellB.id);
        const endA = spellA.getCellIndex();
        const endB = spellB.getCellIndex();

        if (!startA || !startB || !endA || !endB) continue;

        const wA = spellA.widthCells;
        const hA = spellA.heightCells;
        const wB = spellB.widthCells;
        const hB = spellB.heightCells;

        const deltaJA = endA.j - startA.j;
        const deltaJB = endB.j - startB.j;

        const headingOpposed = Math.sign(deltaJA) !== Math.sign(deltaJB) && deltaJA !== 0;
        if (headingOpposed) {
          const boxesOverlapped =
            overlapsBoundingBox(endA, wA, hA, startB, wB, hB) &&
            overlapsBoundingBox(endB, wB, hB, startA, wA, hA);

          if (boxesOverlapped) {
            const pairKey = [spellA.id, spellB.id].sort().join('_');
            if (resolvedCollisions.has(pairKey)) continue;
            resolvedCollisions.add(pairKey);

            this.processCollisionPair(spellA, spellB, positionCache, false);
          }
        }
      }
    }
  };

  private processCollisionPair = (spellA: Spell, spellB: Spell, positionCache: Map<string, CellIndex>, isLookAhead: boolean): void => {
    const { winner, loser, isShattered } = this.doCollision(spellA, spellB);
    this.deferred.push({
      ticks: isShattered ? 2 : 1,
      apply: () => {
        if (winner && loser) {
          if (isLookAhead) {
            loser.remainingMoves = 0;
          } else {
            const startOrigin = winner === spellA ? positionCache.get(spellA.id) : positionCache.get(spellB.id);
            if (startOrigin) loser.setCellIndex({ i: startOrigin.i, j: startOrigin.j });
          }
        }
      }
    });
  };

  private doCollision = (spellA: Spell, spellB: Spell): CollisionOutcome => {
    const noResult = { winner: null, loser: null, isShattered: false };
    if (spellA.getIsRemove() || spellB.getIsRemove()) return noResult;
    if (spellA.isInPhlegmField && spellB instanceof Phlegm) return noResult;
    if (spellB.isInPhlegmField && spellA instanceof Phlegm) return noResult;

    const dmgA = spellA.getPropertyValue('dmgHealth');
    const dmgB = spellB.getPropertyValue('dmgHealth');

    let winner = spellA;
    let loser = spellB;

    if (dmgA === dmgB) {
      spellA.markSpellForRemoval();
      spellB.markSpellForRemoval();
      return noResult;
    }
    else if (dmgB > dmgA) { winner = spellB; loser = spellA; }
    else if (dmgA > dmgB) { winner = spellA; loser = spellB; }

    const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
    const isCollisionWithTerrain = loser instanceof Phlegm || loser instanceof Gyre;

    winner.resolveSpellCollision(loser);

    let extraMoves = 0;
    if (loser instanceof Phlegm) {
      const phlegmDmg = loser.getPropertyValue('dmgHealth');
      const winnerDmg = winner.getPropertyValue('dmgHealth');
      const absoluteDiff = Math.abs(phlegmDmg) - Math.abs(winnerDmg);
      extraMoves = Math.max(Math.floor(absoluteDiff / 5), 1);
    }

    let isShattered = false;
    if (isWinnerSized && isCollisionWithTerrain) {
      // Only apply direct shortcuts if the WINNER is also a native Gyre.
      // If a sized Quicken or Ether hits a Gyre, it MUST shatter first so its fragments are individual objects!
      if (loser instanceof Gyre && winner instanceof Gyre) {
        const rowShifts = loser instanceof GyreDown ? loser.cellIndex.i + loser.heightCells : loser.cellIndex.i - 1 - winner.cellIndex.i;
        winner.consumedGyres = rowShifts;
      } else {
        this.shatterSpellIntoFragments(winner, loser);
        isShattered = true;
        this.isShatteredSinceLastFrame = true;
      }
    } else if (loser instanceof Gyre) {
      const rowShifts = loser instanceof GyreDown ? loser.cellIndex.i + loser.heightCells : loser.cellIndex.i - 1 - winner.cellIndex.i;
      winner.consumedGyres = rowShifts;
      // Ensure the link is established so horizontal spells can execute moveVertically()
      winner.consumedSpellRef = loser;
      loser.consumingSpellIds.add(winner.id);
    } else if (loser instanceof Phlegm && extraMoves > 0) {
      winner.remainingMoves += extraMoves;
    }

    return { winner, loser, isShattered };
  };

  private resolveGridCollisions = (): void => {
    const resolvedPairs = new Set();
    while (true) {
      let structuralCollisionFoundThisPass = false;
      const activeSpells = this.spells.filter(s => !s.getIsRemove());
      for (let i = 0; i < activeSpells.length; i++) {
        for (let j = i + 1; j < activeSpells.length; j++) {
          const spellA = activeSpells[i];
          const spellB = activeSpells[j];
          if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA) || isSameSpellPieces(spellA, spellB)) continue;
          const idxA = spellA.getCellIndex();
          const idxB = spellB.getCellIndex();
          if (!idxA || !idxB) continue;
          const overlaps = overlapsBoundingBox(idxA, spellA.widthCells, spellA.heightCells, idxB, spellB.widthCells, spellB.heightCells);
          if (overlaps) {
            const pairKey = [spellA.id, spellB.id].sort().join('_');
            if (resolvedPairs.has(pairKey)) continue;
            resolvedPairs.add(pairKey);
            structuralCollisionFoundThisPass = true;
            this.doCollision(spellA, spellB);
            break;
          }
        }
        if (structuralCollisionFoundThisPass) break;
      }
      if (!structuralCollisionFoundThisPass) break;
    }
  };

  /**
   * Removes a spell that broke into pieces. It first stops counting as inside the Phlegm/Gyre it
   * hit; otherwise removing it would leave that Phlegm/Gyre with no consumers, removing it too.
   */
  private removeShatteredParent = (parent: Spell, hit: Spell): void => {
    hit.consumingSpellIds.delete(parent.id);
    if (parent.consumedSpellRef === hit) parent.consumedSpellRef = null;
    parent.markSpellForRemoval();
  };

  private shatterSpellIntoFragments = (parent: Spell, hit: Spell): [Array<Spell>, number] => {
    const fragments: Array<Spell> = [];

    const hitDir = Math.sign(hit.getPropertyValue('speedDirection'));
    // The hit spell's leading column (cellIndex is always its left-most column)
    const hitColumn = hitDir > 0 ? hit.getCellIndex().j + hit.widthCells - 1 : hit.getCellIndex().j;
    const hitMinColumn = hit.getCellIndex().j;
    const hitMaxColumn = hit.getCellIndex().j + (hit.widthCells - 1);

    const hitMinRow = hit.getCellIndex().i;
    const hitMaxRow = hit.getCellIndex().i + (hit.heightCells - 1);

    const remainingMoves = Math.max(0, parent.widthCells - Math.abs(hitColumn - parent.cellIndex.j) + (parent.consumedQuickens > 0 ? 1 : 0));

    if (parent instanceof Gyre) {
      // Only trigger the row shortcut if hitting another Gyre. If hitting a Phlegm or Ether, bypass this and fall directly to shattering!
      const isHittingAnotherGyre = hit instanceof Gyre;

      if (parent instanceof GyreUp && isHittingAnotherGyre) {
        const gyreRoot = parent.cellIndex.i + parent.heightCells - 1;
        const lowestPoint = hit.cellIndex.i + hit.heightCells - 1;

        if (gyreRoot === lowestPoint) {
          hit.conferModifierTo(parent);
          return [[], remainingMoves];
        } else {
          let frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = parent.heightCells - (gyreRoot - lowestPoint);
          frag.setCellIndex({ i: lowestPoint, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;

          this.spells.push(frag);
          fragments.push(frag);

          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = gyreRoot - lowestPoint;
          frag.setCellIndex({ i: gyreRoot, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;

          this.spells.push(frag);
          fragments.push(frag);

          this.removeShatteredParent(parent, hit);
          return [fragments, remainingMoves];
        }
      }
      else if (parent instanceof GyreDown && isHittingAnotherGyre) {
        const gyreRoot = parent.cellIndex.i;
        const lowestPoint = hit.cellIndex.i;
        if (gyreRoot === lowestPoint) {
          hit.conferModifierTo(parent);
          return [[], remainingMoves];
        } else {
          let frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = parent.heightCells - (lowestPoint - gyreRoot);
          frag.setCellIndex({ i: lowestPoint, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;

          this.spells.push(frag);
          fragments.push(frag);

          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = lowestPoint - gyreRoot;
          frag.setCellIndex({ i: gyreRoot, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;

          this.spells.push(frag);
          fragments.push(frag);

          this.removeShatteredParent(parent, hit);
          return [fragments, remainingMoves];
        }
      }

      // FALLBACK BREAKDOWN FOR PHLEGM/TERRAIN: If it hits a Phlegm, let it fall through to the matrix loop below!
    }

    // Standard matrix fracturing: every piece stays on its own cell of the parent's footprint
    for (let r = 0; r < parent.heightCells; r++) {
      for (let c = 0; c < parent.widthCells; c++) {
        const i = parent.cellIndex.i + r;
        const j = parent.cellIndex.j + c;

        let frag = new (parent.constructor as any)(parent.caster);
        frag.widthCells = 1;
        frag.heightCells = 1;
        frag.setCellIndex({ i, j });

        frag.consumedEthers = parent.consumedEthers;
        frag.consumedQuickens = parent.consumedQuickens;
        frag.recordedMovesCount = parent.recordedMovesCount;
        frag.remainingMoves = remainingMoves;

        frag.consumingSpellIds = new Set();
        frag.consumedSpellRef = null;
        frag.fragmentGroupId = parent.fragmentGroupId || parent.id;

        // Pieces already inside the hit spell are consumed by it; the rest keep moving and collide later
        const isOverlappingColumn = j >= hitMinColumn && j <= hitMaxColumn;
        const isOverlappingRow = i >= hitMinRow && i <= hitMaxRow;

        if (isOverlappingColumn && isOverlappingRow) {
          hit.consumingSpellIds.add(frag.id);
          frag.resolveSpellCollision(hit);
        }
        this.spells.push(frag);
        fragments.push(frag);
      }
    }

    this.removeShatteredParent(parent, hit);
    return [fragments, remainingMoves];
  };
}

// --- Combining -------------------------------------------------------------------------------

/** Reassembles adjacent compatible spells into the largest allowed shapes. Mutates `spells`' members. */
export const combineSpellsMaximally = (spells: Array<Spell>): void => {
  const MAX_COLS = GameBoard.NUM_COLS;
  const MAX_ROWS = GameBoard.NUM_ROWS;

  const matrix: Array<Array<Spell | null>> = Array(MAX_ROWS).fill(null).map(() => Array(MAX_COLS).fill(null));
  const consumerIds = spells.reduce((acc, item) => [...acc, ...item.consumingSpellIds], new Array<string>());

  spells.forEach(s => {
    if (s.getIsRemove() || consumerIds.includes(s.id)) return;
    const idx = s.getCellIndex();
    if (idx) {
      for (let r = 0; r < s.heightCells; r++) {
        for (let c = 0; c < s.widthCells; c++) {
          const targetI = idx.i + r;
          const targetJ = idx.j + c;
          if (targetI >= 0 && targetI < MAX_ROWS && targetJ >= 0 && targetJ < MAX_COLS) {
            matrix[targetI][targetJ] = s;
          }
        }
      }
    }
  });

  const processed = new Set<string>();

  const componentsMatch = (a: Spell | null, b: Spell | null): boolean => {
    if (!a || !b || a.getIsRemove() || b.getIsRemove()) return false;
    if (processed.has(a.id) || processed.has(b.id)) return false;

    // If EITHER spell fragment is currently resolving a vertical rowShift track, block them from recombining!
    if (a.consumedGyres !== 0 || b.consumedGyres !== 0) return false;
    if (a.isInPhlegmField || b.isInPhlegmField) return false;

    const sameType = a.getSpellName() === b.getSpellName();
    const sameDir = Math.sign(a.getPropertyValue('speedDirection')) === Math.sign(b.getPropertyValue('speedDirection'));
    return sameType && sameDir;
  };

  // --- PASS 1: Reassemble Horizontal Chains for Quickens ---
  for (let i = 0; i < MAX_ROWS; i++) {
    for (let j = 0; j < MAX_COLS;) {
      const root = matrix[i][j];
      if (root && root instanceof Quicken && !processed.has(root.id)) {
        let chainWidth = root.widthCells;
        const matchesToMerge: Spell[] = [];

        while (j + chainWidth < GameBoard.NUM_COLS) {
          const neighbor = matrix[i][j + chainWidth];
          if (componentsMatch(root, neighbor) && neighbor instanceof Quicken) {
            matchesToMerge.push(neighbor);
            chainWidth += neighbor.widthCells;
          } else {
            break;
          }
        }

        if (matchesToMerge.length > 0) {
          processed.add(root.id);
          matchesToMerge.forEach(m => {
            processed.add(m.id);
            root.consumedQuickens += m.consumedQuickens;
            root.consumedEthers += m.consumedEthers;
            m.markSpellForRemoval();
          });
          root.widthCells = chainWidth;
          root.heightCells = 1;
        }

        for (let c = 0; c < chainWidth; c++) {
          if (j + c < MAX_COLS) {
            matrix[i][j + c] = root;
          }
        }

        j += chainWidth;
      } else {
        j++;
      }
    }
  }

  // --- PASS 2: Reassemble Vertical Stacks for Gyres ---
  for (let j = 0; j < MAX_COLS; j++) {
    for (let i = 0; i < MAX_ROWS;) {
      const root = matrix[i][j];
      if (root && root instanceof Gyre && !processed.has(root.id)) {
        let stackHeight = root.heightCells;
        const matchesToMerge: Spell[] = [];

        while (i + stackHeight < MAX_ROWS && stackHeight < GameBoard.NUM_ROWS) {
          const neighbor = matrix[i + stackHeight][j];
          if (componentsMatch(root, neighbor) && neighbor instanceof Gyre) {
            matchesToMerge.push(neighbor);
            stackHeight += neighbor.heightCells;
          } else {
            break;
          }
        }

        if (matchesToMerge.length > 0) {
          processed.add(root.id);
          matchesToMerge.forEach(m => {
            processed.add(m.id);
            m.markSpellForRemoval();
          });
          root.widthCells = 1;
          root.heightCells = stackHeight;
        }

        for (let r = 0; r < stackHeight; r++) {
          const targetI = i + r;
          if (targetI < MAX_ROWS && matrix[targetI]) {
            matrix[targetI][j] = root;
          }
        }

        i += stackHeight;
      } else {
        i++;
      }
    }
  }

  // --- PASS 3: Reassemble Square Structures for Phlegms and Ethers ---
  const attemptSquareMerge = (rootI: number, rootJ: number, targetSize: number): boolean => {
    const root = matrix[rootI][rootJ];
    if (!root || processed.has(root.id)) return false;
    if (!(root instanceof Phlegm || root instanceof Ether)) return false;

    const targetCluster = new Set<Spell>();

    for (let r = 0; r < targetSize; r++) {
      for (let c = 0; c < targetSize; c++) {
        const checkI = rootI + r;
        const checkJ = rootJ + c;

        if (checkI >= MAX_ROWS || checkJ >= MAX_COLS) return false;

        const candidate = matrix[checkI][checkJ];
        if (candidate === root) continue;

        if (componentsMatch(root, candidate)) {
          targetCluster.add(candidate!);
        } else {
          return false;
        }
      }
    }

    processed.add(root.id);
    targetCluster.forEach(m => {
      processed.add(m.id);
      root.consumedQuickens += m.consumedQuickens;
      root.consumedEthers += m.consumedEthers;
      m.markSpellForRemoval();
    });

    root.widthCells = targetSize;
    root.heightCells = targetSize;
    return true;
  };

  for (let i = 0; i < MAX_ROWS; i++) {
    for (let j = 0; j < MAX_COLS; j++) {
      if (attemptSquareMerge(i, j, 3)) continue;
      attemptSquareMerge(i, j, 2);
    }
  }
};
