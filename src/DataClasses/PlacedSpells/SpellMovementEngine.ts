// SpellMovementEngine.ts
// Pure, synchronous spell-movement rules engine: no timers, rendering, React, or valtio.
// Runs a full spell-movement turn on a cloned copy of the placed spells and returns a log of
// frames for the UI to replay (see PlacedSpells.updateSpells).
//
// The rules follow spell-movement-requirements.md (numbers in comments refer to its sections);
// tunable rules live in spellRules.ts. Saved scenarios: SpellMovementEngine.test.ts (npm test).
import { Spell, Phlegm, Ether, Gyre, GyreUp, Quicken } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex } from '../types';
import { PHLEGM_RULES, GYRE_RULES } from './spellRules';

/**
 * 'step':    shown after each micro-step
 * 'turnEnd': shown after all moves, before removed spells are cleared
 * 'final':   the board state at the end of the turn
 */
export type SpellTurnFrameKind = 'step' | 'turnEnd' | 'final';

export type HealthEvent = { playerIndex: number; dmg: number };

/**
 * A spell interaction, for statistics and training rewards (the combos the game is about).
 * Sides: 0 = the left player, 1 = the NPC (whoever cast the spell).
 */
export type InteractionEvent =
  | { kind: 'reflect'; spellSide: number; phlegmSide: number; isPhlegmSpell: boolean } // a Phlegm sent a spell back
  | { kind: 'lift'; spellSide: number; gyreSide: number } // a Gyre started moving a spell to another row
  | { kind: 'liftEnd'; spellSide: number; gyreSide: number; isSurvived: boolean } // ...and finished: on the board, or pushed off it
  | { kind: 'buff'; buff: 'fire' | 'electric'; consumerSide: number; consumedSide: number }; // a spell absorbed an Ether/Quicken

export const getSpellSide = (spell: Spell): number => spell.caster.getDirection() === 1 ? 0 : 1;

export type SpellTurnFrame = {
  kind: SpellTurnFrameKind;
  spells: Array<Spell>; // deep copies, safe to keep
  healthEvents: Array<HealthEvent>; // applied when this frame is shown
  interactionEvents: Array<InteractionEvent>; // what happened since the previous frame
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

/**
 * Pieces broken off the same original spell, moving the same direction, never collide with each
 * other or share a cell (they queue instead), even when split into separate parts (e.g.
 * '<id>:bounce' / '<id>:pass', which reassemble separately). Pieces moving toward each other
 * (e.g. one reflected by a Phlegm) collide like any other spells.
 */
const getFragmentFamily = (spell: Spell): string => spell.fragmentGroupId.split(':')[0];
const isSameSpellPieces = (a: Spell, b: Spell): boolean =>
  !!a.fragmentGroupId && getFragmentFamily(a) === getFragmentFamily(b) && Math.sign(a.speedDirection) === Math.sign(b.speedDirection);

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

type CollisionPair = { a: Spell; b: Spell; isSwap: boolean };

type CollisionDecision =
  | { kind: 'tie' }
  | { kind: 'win'; winner: Spell; loser: Spell };

// Max collision passes per micro-step (pieces created by a break-up can overlap other spells)
const MAX_COLLISION_PASSES = 10;

/** Allowed sized-spell shapes (requirement 14). */
const isAllowedShape = (spell: Spell, width: number, height: number): boolean => {
  if (spell instanceof Phlegm || spell instanceof Ether) return width === height && width <= 3;
  if (spell instanceof Quicken) return height === 1 && width <= GameBoard.NUM_COLS;
  if (spell instanceof Gyre) return width === 1 && height <= GYRE_RULES.maxHeight;
  return false;
};

type CellRect = { i: number; j: number; w: number; h: number };

/**
 * Bonus moves a spell gets when a Phlegm reflects it, as if shot outward (7b). `attackerPower` is
 * the spell's power before it broke apart, if it did.
 */
const getReflectBonusMoves = (attackerPower: number, phlegm: Phlegm): number => {
  if (PHLEGM_RULES.reflectBonusMode === 'none') return 0;
  if (PHLEGM_RULES.reflectBonusMode === 'size') return phlegm.widthCells;
  return Math.max(1, Math.floor(Math.abs(attackerPower - phlegm.getPower()) / 5));
};

const getIsBouncing = (spell: Spell): boolean => spell.phlegmEntryStepsRemaining > 0 || spell.phlegmDwellStepsRemaining > 0;

const getIsTerrain = (spell: Spell): boolean => spell instanceof Phlegm || spell instanceof Gyre;

/** Orbiting or bouncing in a Phlegm, or being lifted by a Gyre. */
const getIsInTransit = (spell: Spell): boolean => spell.isInPhlegmField || getIsBouncing(spell) || spell.consumedGyres !== 0;

/**
 * Siblings that must not move into each other's cells: same direction, or either in transit (an
 * orbiting piece only reverses at the end of the step it exits, so its direction can't be trusted).
 */
const getIsQueueingSiblings = (a: Spell, b: Spell): boolean =>
  !!a.fragmentGroupId && getFragmentFamily(a) === getFragmentFamily(b) &&
  (Math.sign(a.speedDirection) === Math.sign(b.speedDirection) || getIsInTransit(a) || getIsInTransit(b));

/**
 * A Phlegm's capacity (7c): how many spells ('count') or how much power ('power') it can take
 * before it is used up. A 1x1 Phlegm always takes exactly one spell.
 */
const getPhlegmCapacity = (phlegm: Phlegm): number => {
  const cells = phlegm.widthCells * phlegm.heightCells;
  if (cells === 1) return 1;
  if (PHLEGM_RULES.capacityMode === 'unlimited') return Infinity;
  return cells * (PHLEGM_RULES.capacityMode === 'power' ? PHLEGM_RULES.powerCapacityPerCell : PHLEGM_RULES.capacityPerCell);
};

/** Capacity used when a spell enters `phlegm`: one spell, or its power in 'power' mode. */
const getPhlegmCapacityUse = (phlegm: Phlegm, entering: Spell): number => {
  const isPowerMode = PHLEGM_RULES.capacityMode === 'power' && phlegm.widthCells * phlegm.heightCells > 1;
  return isPowerMode ? entering.getPower() : 1;
};

const getIsPhlegmFull = (spell: Spell): boolean => spell instanceof Phlegm && spell.capacityUsed >= getPhlegmCapacity(spell);

// --- Fairness ----------------------------------------------------------------------------------
// The board must play the same for both sides: any scan order or rounding is done from the left
// player's point of view (spells moving right), and mirrored for spells moving left.

/** A shape's column, mirrored left-right across the board. */
const mirrorColumn = (j: number, width: number): number => GameBoard.NUM_COLS - j - width;

/** Mirrors every spell's position left-right across the board (in place). */
const mirrorBoardColumns = (spells: Array<Spell>): void => {
  spells.forEach(s => { if (s.cellIndex) s.setCellIndex({ i: s.cellIndex.i, j: mirrorColumn(s.cellIndex.j, s.widthCells) }); });
};

/**
 * Steps a block bouncing off a Phlegm slides in first: until centered on the Phlegm if it fits
 * (rounding toward the side it came from), otherwise until its front edge reaches the far side.
 */
const getBounceEntrySteps = (blockJ: number, blockWidth: number, dir: number, phlegm: Phlegm): number => {
  const phlegmWidth = phlegm.widthCells;
  const centeredOffset = (phlegmWidth - blockWidth) / 2;
  const targetJ = blockWidth <= phlegmWidth
    ? phlegm.cellIndex.j + (dir > 0 ? Math.floor(centeredOffset) : Math.ceil(centeredOffset))
    : (dir < 0 ? phlegm.cellIndex.j : phlegm.cellIndex.j + phlegmWidth - blockWidth);
  return Math.max(0, (targetJ - blockJ) * dir);
};

const getFootprintCells = (spell: Spell): Array<CellIndex> => {
  const cells: Array<CellIndex> = [];
  for (let r = 0; r < spell.heightCells; r++) {
    for (let c = 0; c < spell.widthCells; c++) cells.push({ i: spell.cellIndex.i + r, j: spell.cellIndex.j + c });
  }
  return cells;
};

/**
 * Splits `cells` into the largest allowed shapes for `spell`'s type (requirement 13a), scanning
 * from the top-left (mirrored for spells moving left) so the result is deterministic and fair.
 */
const splitIntoAllowedShapes = (spell: Spell, cells: Array<CellIndex>): Array<CellRect> => {
  if (Math.sign(spell.speedDirection) < 0) {
    return splitIntoAllowedShapesFromLeft(spell, cells.map(c => ({ i: c.i, j: mirrorColumn(c.j, 1) })))
      .map(rect => ({ ...rect, j: mirrorColumn(rect.j, rect.w) }));
  }
  return splitIntoAllowedShapesFromLeft(spell, cells);
};

const splitIntoAllowedShapesFromLeft = (spell: Spell, cells: Array<CellIndex>): Array<CellRect> => {
  const remaining = new Set(cells.map(c => `${c.i},${c.j}`));
  const has = (i: number, j: number) => remaining.has(`${i},${j}`);
  const fits = (i: number, j: number, w: number, h: number) => {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (!has(i + r, j + c)) return false;
    return true;
  };
  const sorted = [...cells].sort((a, b) => a.i - b.i || a.j - b.j);
  const rects: Array<CellRect> = [];

  sorted.forEach(({ i, j }) => {
    if (!has(i, j)) return;
    let w = 1, h = 1;
    if (spell instanceof Quicken) {
      while (w < GameBoard.NUM_COLS && has(i, j + w)) w++;
    } else if (spell instanceof Gyre) {
      while (h < GYRE_RULES.maxHeight && has(i + h, j)) h++;
    } else {
      const size = [3, 2, 1].find(s => fits(i, j, s, s))!;
      w = h = size;
    }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) remaining.delete(`${i + r},${j + c}`);
    rects.push({ i, j, w, h });
  });
  return rects;
};

const toPairKey = (a: Spell, b: Spell): string => [a.id, b.id].sort().join('_');

/** Phlegms/Gyres configured to always lose against other spell types. */
const isAlwaysLoserAgainst = (spell: Spell, other: Spell): boolean => {
  if (spell instanceof Phlegm && !(other instanceof Phlegm)) return PHLEGM_RULES.collisionMode === 'alwaysLoses';
  if (spell instanceof Gyre && !(other instanceof Gyre)) return GYRE_RULES.collisionMode === 'alwaysLoses';
  return false;
};

export class SpellMovementEngine {
  spells: Array<Spell>;

  private frames: Array<SpellTurnFrame> = [];
  private pendingHealthEvents: Array<HealthEvent> = [];
  private pendingInteractionEvents: Array<InteractionEvent> = [];

  constructor(spells: Array<Spell>) {
    this.spells = copySpellGraph(spells);
  }

  simulateTurn = (): SpellTurnLog => {
    this.frames = [];

    this.spells.forEach(s => {
      s.isBloodMagic = false; // a casting effect, already shown; otherwise it hides the spell's destruction effect
      if (s instanceof Phlegm && PHLEGM_RULES.capacityResetsEachTurn) s.capacityUsed = 0;
      if (s instanceof Gyre && GYRE_RULES.capacityResetsEachTurn) s.capacityUsed = 0;
    });

    this.spells.forEach(s => {
      if (!s.getIsRemove()) {
        const moves = Math.abs(s.getPropertyValue('speedDirection'));
        s.remainingMoves = moves;
        s.recordedMovesCount = 0;
      }
    });

    let currentMicroStep = 1;

    // Step until no spell has moves left. (Spells can gain moves mid-turn, e.g. when a Phlegm
    // hits a spell that had already stopped, so this can't be worked out up front.)
    while (this.spells.some(s => this.getIsMovingThisStep(s))) {
      const positionCache = this.cachePositions();

      const anySpellMoved = this.executeSynchronousMicroSteps();
      if (!anySpellMoved) break;

      this.resolveCollisions(positionCache);
      this.reassembleExitedPieces();
      this.captureFrame('step');
      currentMicroStep++;

      if (currentMicroStep > MAX_MICRO_STEPS) {
        break;
      }
    }

    // consumedPhlegms persists (empowered Phlegms); only per-turn Gyre movement resets
    this.spells.forEach(s => {
      s.consumedGyres = 0;
    });

    this.removeConsumed();
    this.captureFrame('turnEnd');

    this.removeInvalidSpells();
    // Pieces only stay grouped for the turn they broke apart
    this.spells.forEach(s => {
      s.fragmentGroupId = '';
      s.fragmentBreakerId = '';
      s.exitedPhlegmId = '';
    });
    combineSpellsMaximally(this.spells);
    this.captureFrame('final');

    return { frames: this.frames };
  };

  private captureFrame = (kind: SpellTurnFrameKind): void => {
    this.frames.push({ kind, spells: copySpellGraph(this.spells), healthEvents: this.pendingHealthEvents, interactionEvents: this.pendingInteractionEvents });
    this.pendingHealthEvents = [];
    this.pendingInteractionEvents = [];
  };

  /** Runs one step of `spell`, recording a reflection if it left a Phlegm reversed. */
  private stepSpell = (spell: Spell, step: () => void): void => {
    const phlegm = spell.consumedSpellRef instanceof Phlegm ? spell.consumedSpellRef : null;
    const direction = Math.sign(spell.speedDirection);
    step();
    if (phlegm && Math.sign(spell.speedDirection) !== direction) {
      this.pendingInteractionEvents.push({ kind: 'reflect', spellSide: getSpellSide(spell), phlegmSide: getSpellSide(phlegm), isPhlegmSpell: spell instanceof Phlegm });
    }
  };

  private recordLift = (spell: Spell, gyre: Gyre): void => {
    if (spell.consumedSpellRef === gyre && spell.consumedGyres !== 0) {
      this.pendingInteractionEvents.push({ kind: 'lift', spellSide: getSpellSide(spell), gyreSide: getSpellSide(gyre) });
    }
  };

  /**
   * End of turn: Phlegms and Gyres that took any spell are cleared (10b). With
   * GYRE_RULES.persistsAfterUse, a Gyre instead lets go of what it carries and survives until full.
   */
  private removeConsumed = (): void => {
    this.spells.filter(spell => !!spell.consumingSpellIds.size).forEach(s => {
      if (!(s instanceof Gyre)) {
        s.markSpellForRemoval();
        return;
      }
      this.spells.forEach(carried => { if (carried.consumedSpellRef === s) carried.consumedSpellRef = null; });
      s.consumingSpellIds.clear();
      if (s.getIsUsedUp()) s.markSpellForRemoval();
    });
    // A used Gyre that is no longer carrying anything is cleared too
    this.spells.forEach(s => {
      if (s instanceof Gyre && s.capacityUsed > 0 && s.getIsUsedUp() && !s.getIsRemove()) s.markSpellForRemoval();
    });
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

  private getIsMovingThisStep = (spell: Spell): boolean =>
    !spell.getIsRemove() && !spell.getIsBeingConsumed() && (spell.remainingMoves > 0 || (!!spell.consumedGyres && spell.consumedGyres !== 0));

  /**
   * Pieces of the same spell never share a cell: a piece is blocked if its next cell holds a
   * sibling that is not moving away this step, or a sibling earlier in the list is moving into it.
   * Returns each blocked piece mapped to whether it waits (blocked by a sibling still moving this
   * turn, so it keeps its move) or stops (blocked by a sibling that has stopped, so it gives the move up).
   */
  private findBlockedPieces = (): Map<Spell, boolean> => {
    const blocked = new Map<Spell, boolean>();
    const movers = this.spells.filter(s => this.getIsMovingThisStep(s));
    const targets = new Map(movers.map(s => [s, s.peekNextCellIndex()]));

    const findBlockers = (piece: Spell, pieceOrder: number): Array<Spell> => {
      const target = targets.get(piece)!;
      return this.spells.filter(sibling => {
        if (sibling === piece || sibling.getIsRemove() || !getIsQueueingSiblings(piece, sibling)) return false;
        const isSiblingMoving = targets.has(sibling) && !blocked.has(sibling);
        const siblingCell = isSiblingMoving ? targets.get(sibling)! : sibling.cellIndex;
        if (!overlapsBoundingBox(target, piece.widthCells, piece.heightCells, siblingCell, sibling.widthCells, sibling.heightCells)) return false;
        // Two siblings moving into the same cell: the one earlier in the list goes first
        return !isSiblingMoving || movers.indexOf(sibling) < pieceOrder;
      });
    };

    let isChanged = true;
    while (isChanged) {
      isChanged = false;
      movers.forEach((piece, pieceOrder) => {
        if (!piece.fragmentGroupId || blocked.has(piece)) return;
        if (findBlockers(piece, pieceOrder).length) {
          blocked.set(piece, false);
          isChanged = true;
        }
      });
    }

    // A piece only waits if a blocker will actually move this step. Blocked by stuck siblings
    // only (including each other, e.g. head-on), it gives the move up, so waits can't loop forever.
    blocked.forEach((_, piece) => {
      const blockers = findBlockers(piece, movers.indexOf(piece));
      blocked.set(piece, blockers.some(sibling => targets.has(sibling) && !blocked.has(sibling)));
    });
    return blocked;
  };

  private executeSynchronousMicroSteps = (): boolean => {
    let anySpellMoved = false;
    const blockedPieces = this.findBlockedPieces();

    for (const spell of this.spells) {
      if (!this.getIsMovingThisStep(spell)) continue;
      anySpellMoved = true;

      // A lift ends when the spell is one cell past the Gyre, or pushed off the board (4a, 4b)
      const liftingGyre = spell.consumedGyres !== 0 && spell.consumedSpellRef instanceof Gyre ? spell.consumedSpellRef : null;
      this.moveSpell(spell, blockedPieces);
      if (liftingGyre && (spell.consumedGyres === 0 || spell.getIsRemove())) {
        this.pendingInteractionEvents.push({ kind: 'liftEnd', spellSide: getSpellSide(spell), gyreSide: getSpellSide(liftingGyre), isSurvived: !spell.getIsRemove() });
      }
    }
    return anySpellMoved;
  };

  /** Moves one spell one step: horizontally, along a Gyre lift or Phlegm orbit, or not at all if blocked. */
  private moveSpell = (spell: Spell, blockedPieces: Map<Spell, boolean>): void => {
    spell.recordedMovesCount++;

    const isGyreMove = !!spell.consumedGyres && spell.consumedGyres !== 0;

    // A blocked piece stays put: it either waits (keeping its move) or gives the move up
    if (blockedPieces.has(spell)) {
      if (!blockedPieces.get(spell)) this.stepSpell(spell, spell.forfeitStep); // stuck behind a sibling: give the step up
      return;
    }

    if (!isGyreMove) {
      spell.remainingMoves--;
    }

    this.stepSpell(spell, spell.executeSingleMicroStep);

    const nextCellIndex = spell.getCellIndex();
    if (!nextCellIndex) return;

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
      return;
    }

    // Pushed above or below the board by a Gyre (4b)
    if (minI < 0 || maxI >= GameBoard.NUM_ROWS) {
      if (GYRE_RULES.offBoardMode === 'clamp') {
        spell.setCellIndex({ i: Math.min(GameBoard.NUM_ROWS - spell.heightCells, Math.max(0, minI)), j: nextCellIndex.j });
        spell.consumedGyres = 0;
        spell.movesOutOfConsumed = Math.max(1, spell.movesOutOfConsumed);
        spell.clearConsumedRef();
      } else {
        spell.markSpellForRemoval();
      }
    }
  };

  // --- Reassembly ----------------------------------------------------------------------------

  /**
   * Once every piece of a broken-up spell is out of the Phlegm/Gyre that broke it (none inside
   * it, orbiting, or being lifted), the pieces immediately reassemble into one spell, which keeps
   * its remaining (reflection bonus) moves (13d, 7b). Pieces only reassemble into a complete,
   * allowed shape; otherwise they wait for the end-of-turn merge.
   */
  private reassembleExitedPieces = (): void => {
    const groups = new Map<string, Array<Spell>>();
    this.spells.forEach(s => {
      if (s.getIsRemove() || !s.fragmentGroupId) return;
      groups.set(s.fragmentGroupId, [...(groups.get(s.fragmentGroupId) || []), s]);
    });

    groups.forEach(pieces => {
      if (pieces.length < 2) return;
      const [first] = pieces;
      const dir = Math.sign(first.speedDirection);
      const isStillAffected = pieces.some(p =>
        p.isInPhlegmField || getIsBouncing(p) || p.consumedGyres !== 0 || p.getIsBeingConsumed() ||
        Math.sign(p.speedDirection) !== dir || p.getSpellName() !== first.getSpellName()
      );
      if (isStillAffected) return;

      const breaker = this.spells.find(s => s.id === first.fragmentBreakerId && !s.getIsRemove());
      const isOverlappingBreaker = !!breaker && pieces.some(p =>
        overlapsBoundingBox(p.cellIndex, p.widthCells, p.heightCells, breaker.cellIndex, breaker.widthCells, breaker.heightCells)
      );
      if (isOverlappingBreaker) return;

      // The pieces must exactly fill their bounding rectangle
      const minI = Math.min(...pieces.map(p => p.cellIndex.i));
      const minJ = Math.min(...pieces.map(p => p.cellIndex.j));
      const maxI = Math.max(...pieces.map(p => p.cellIndex.i + p.heightCells - 1));
      const maxJ = Math.max(...pieces.map(p => p.cellIndex.j + p.widthCells - 1));
      const width = maxJ - minJ + 1;
      const height = maxI - minI + 1;
      const cells = new Set<string>();
      pieces.forEach(p => {
        for (let r = 0; r < p.heightCells; r++) for (let c = 0; c < p.widthCells; c++) cells.add(`${p.cellIndex.i + r},${p.cellIndex.j + c}`);
      });
      const area = pieces.reduce((acc, p) => acc + p.widthCells * p.heightCells, 0);
      if (cells.size !== area || area !== width * height || !isAllowedShape(first, width, height)) return;

      const root = pieces.find(p => p.cellIndex.i === minI && p.cellIndex.j === minJ);
      if (!root) return;

      pieces.forEach(p => {
        if (p === root) return;
        root.consumedEthers += p.consumedEthers;
        root.consumedQuickens += p.consumedQuickens;
        root.consumedPhlegms += p.consumedPhlegms;
        p.markSpellForRemoval();
      });
      root.widthCells = width;
      root.heightCells = height;
      root.remainingMoves = Math.max(...pieces.map(p => p.remainingMoves)); // keeps reflection bonus moves (7b)
      root.fragmentGroupId = '';
      root.fragmentBreakerId = '';
    });
  };

  // --- Collisions (requirements 1a-1c) -------------------------------------------------------

  /**
   * Finds and resolves this micro-step's collisions, weakest participant first. Repeats while
   * resolving creates new overlaps (e.g. pieces of a broken-up spell landing on another spell).
   */
  private resolveCollisions = (positionCache: Map<string, CellIndex>): void => {
    const resolvedPairKeys = new Set<string>();

    for (let pass = 0; pass < MAX_COLLISION_PASSES; pass++) {
      const pairs = this.detectCollisionPairs(positionCache, pass === 0, resolvedPairKeys);
      if (!pairs.length) break;

      const weakest = (p: CollisionPair) => Math.min(p.a.getPower(), p.b.getPower());
      const strongest = (p: CollisionPair) => Math.max(p.a.getPower(), p.b.getPower());
      pairs.sort((p, q) => weakest(p) - weakest(q) || strongest(p) - strongest(q));

      pairs.forEach(pair => {
        resolvedPairKeys.add(toPairKey(pair.a, pair.b));
        this.resolvePair(pair, positionCache);
      });
    }
  };

  /**
   * A pair collides if their footprints overlap after moving, or (first pass only) if they
   * swapped places: A's new footprint overlaps B's old one and B's new overlaps A's old one.
   */
  private detectCollisionPairs = (positionCache: Map<string, CellIndex>, isCheckingSwaps: boolean, resolvedPairKeys: Set<string>): Array<CollisionPair> => {
    const pairs: Array<CollisionPair> = [];
    const active = this.spells.filter(s => !s.getIsRemove() && !!s.getCellIndex());

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (!this.getCanCollide(a, b) || resolvedPairKeys.has(toPairKey(a, b))) continue;

        const endA = a.getCellIndex();
        const endB = b.getCellIndex();
        const isOverlap = overlapsBoundingBox(endA, a.widthCells, a.heightCells, endB, b.widthCells, b.heightCells);

        let isSwap = false;
        const startA = positionCache.get(a.id);
        const startB = positionCache.get(b.id);
        if (!isOverlap && isCheckingSwaps && startA && startB) {
          isSwap =
            overlapsBoundingBox(endA, a.widthCells, a.heightCells, startB, b.widthCells, b.heightCells) &&
            overlapsBoundingBox(endB, b.widthCells, b.heightCells, startA, a.widthCells, a.heightCells);
        }

        if (isOverlap || isSwap) pairs.push({ a, b, isSwap });
      }
    }
    return pairs;
  };

  private getCanCollide = (a: Spell, b: Spell): boolean => {
    if (a.getIsRemove() || b.getIsRemove()) return false;
    if (a.getIsBeingConsumed(b) || b.getIsBeingConsumed(a)) return false; // already inside the other
    if (isSameSpellPieces(a, b)) return false;
    if (a.exitedPhlegmId === b.id || b.exitedPhlegmId === a.id) return false; // just left it
    if (a.isInPhlegmField && b instanceof Phlegm) return false; // orbiting spells pass over Phlegms
    if (b.isInPhlegmField && a instanceof Phlegm) return false;
    if (getIsBouncing(a) && b instanceof Phlegm) return false; // bouncing blocks too
    if (getIsBouncing(b) && a instanceof Phlegm) return false;
    // A spell in transit (inside a Phlegm or being lifted by a Gyre) can't enter another Phlegm or
    // Gyre until it is out, and a Phlegm/Gyre that is itself in transit can't take in other spells
    if (getIsInTransit(a) && getIsTerrain(b)) return false;
    if (getIsInTransit(b) && getIsTerrain(a)) return false;
    if ((getIsTerrain(a) && getIsInTransit(a)) || (getIsTerrain(b) && getIsInTransit(b))) return false;
    if (getIsPhlegmFull(a) || getIsPhlegmFull(b)) return false; // used-up Phlegms are passed through (7c)
    // Used-up Gyres are passed through by other spells (4c), but still merge with Gyres (5d)
    const isGyreMeeting = a instanceof Gyre && b instanceof Gyre;
    if (!isGyreMeeting && ((a instanceof Gyre && a.getIsFull()) || (b instanceof Gyre && b.getIsFull()))) return false;
    return true;
  };

  private resolvePair = ({ a, b, isSwap }: CollisionPair, positionCache: Map<string, CellIndex>): void => {
    // An earlier collision this step may have changed either spell (1b)
    if (!this.getCanCollide(a, b)) return;

    if (a instanceof Gyre && b instanceof Gyre) {
      this.resolveGyreMeeting(a, b);
      return;
    }

    const decision = this.decideCollision(a, b);

    if (decision.kind === 'tie') {
      if (isSwap) {
        this.revertMove(a, positionCache);
        this.revertMove(b, positionCache);
      }
      a.markSpellForRemoval();
      b.markSpellForRemoval();
      return;
    }

    const { winner, loser } = decision;
    // (sized spells use capacity per cell, in breakUpAtPhlegm / breakUpAtGyre)
    const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
    if (loser instanceof Phlegm && !isWinnerSized) loser.capacityUsed += getPhlegmCapacityUse(loser, winner);
    if (loser instanceof Gyre && !isWinnerSized) loser.capacityUsed += loser.getCapacityUse(winner);
    // Spells that swapped places meet in the loser's cell, so the winner ends up inside it
    if (isSwap && !loser.getIsBeingConsumed()) this.revertMove(loser, positionCache);
    this.applyCollision(winner, loser);
  };

  private revertMove = (spell: Spell, positionCache: Map<string, CellIndex>): void => {
    const start = positionCache.get(spell.id);
    if (start) spell.setCellIndex(start);
  };

  /** Decides the winner by power, applying the Phlegm/Gyre collision rules (2b). */
  private decideCollision = (a: Spell, b: Spell): CollisionDecision => {
    const win = (winner: Spell, loser: Spell): CollisionDecision => ({ kind: 'win', winner, loser });

    // A Phlegm/Gyre that already has spells inside it can only be entered (1c)
    const isAConsumed = a.getIsBeingConsumed();
    const isBConsumed = b.getIsBeingConsumed();
    if (isAConsumed !== isBConsumed) return isAConsumed ? win(b, a) : win(a, b);

    const isAAlwaysLoser = isAlwaysLoserAgainst(a, b);
    const isBAlwaysLoser = isAlwaysLoserAgainst(b, a);
    if (isAAlwaysLoser !== isBAlwaysLoser) return isAAlwaysLoser ? win(b, a) : win(a, b);

    const powerA = a.getPower();
    const powerB = b.getPower();
    if (powerA === powerB) return { kind: 'tie' };

    // In 'alwaysLoses' mode the smaller Phlegm consumes the larger (enables the self-heal combo)
    const isSmallerWinner = a instanceof Phlegm && b instanceof Phlegm && PHLEGM_RULES.collisionMode === 'alwaysLoses';
    const isAWinner = isSmallerWinner ? powerA < powerB : powerA > powerB;
    return isAWinner ? win(a, b) : win(b, a);
  };

  private applyCollision = (winner: Spell, loser: Spell): void => {
    if (PHLEGM_RULES.absorbCostsPower && winner instanceof Phlegm && !(loser instanceof Phlegm)) {
      winner.powerModifier -= loser.getPower();
    }

    const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
    const isCollisionWithTerrain = loser instanceof Phlegm || loser instanceof Gyre;

    // The winner inherits bonuses the loser picked up earlier (1b). Ethers and Quickens already
    // pass on their own type's bonus in conferModifierTo.
    if (!isCollisionWithTerrain) {
      if (!(loser instanceof Quicken)) winner.consumedQuickens += loser.consumedQuickens;
      if (!(loser instanceof Ether)) winner.consumedEthers += loser.consumedEthers;
    }

    // Pieces of a spell that breaks apart keep its remaining moves (from before entering the loser)
    const winnerRemainingMoves = winner.remainingMoves;

    if (isWinnerSized && loser instanceof Phlegm) {
      this.breakUpAtPhlegm(winner, loser, winnerRemainingMoves);
      return;
    }
    if (isWinnerSized && loser instanceof Gyre) {
      this.breakUpAtGyre(winner, loser, winnerRemainingMoves);
      return;
    }

    const winnerPower = winner.getPower();

    // Phlegm: orbit. Gyre: lift (Gyre.conferModifierTo). Ether/Quicken: their bonus.
    winner.resolveSpellCollision(loser);

    if (loser instanceof Phlegm) winner.phlegmBonusMoves = getReflectBonusMoves(winnerPower, loser);
    if (loser instanceof Gyre) this.recordLift(winner, loser);
    if (loser instanceof Ether || loser instanceof Quicken) {
      this.pendingInteractionEvents.push({ kind: 'buff', buff: loser instanceof Ether ? 'fire' : 'electric', consumerSide: getSpellSide(winner), consumedSide: getSpellSide(loser) });
    }
  };

  /**
   * Two Gyres meet (5). Equal power: both are destroyed. Otherwise, same direction: the stronger
   * grows by the other's height; opposite directions: the stronger shrinks by the other's height.
   * The absorbed Gyre is destroyed immediately.
   */
  private resolveGyreMeeting = (a: Gyre, b: Gyre): void => {
    const isSameDirection = (a instanceof GyreUp) === (b instanceof GyreUp);
    const [winner, loser] = a.getPower() >= b.getPower() ? [a, b] : [b, a];

    if (a.getPower() === b.getPower()) {
      a.markSpellForRemoval();
      b.markSpellForRemoval();
      return;
    }

    this.resizeGyre(winner, isSameDirection ? winner.heightCells + loser.heightCells : winner.heightCells - loser.heightCells);
    winner.capacityUsed += loser.capacityUsed; // spent capacity carries over (5d)
    winner.consumedEthers += loser.consumedEthers;
    winner.consumedQuickens += loser.consumedQuickens;
    loser.markSpellForRemoval();
  };

  /**
   * Sets a Gyre's height with its base fixed (5b): a GyreUp's bottom cell, a GyreDown's top cell.
   * Height is capped by GYRE_RULES.maxHeight and the board edge in its growth direction (5c).
   */
  private resizeGyre = (gyre: Gyre, height: number): void => {
    if (height <= 0) {
      gyre.markSpellForRemoval();
      return;
    }
    const top = gyre.cellIndex.i;
    if (gyre instanceof GyreUp) {
      const bottom = top + gyre.heightCells - 1;
      gyre.heightCells = Math.min(height, GYRE_RULES.maxHeight, bottom + 1);
      gyre.setCellIndex({ i: bottom - gyre.heightCells + 1, j: gyre.cellIndex.j });
    } else {
      gyre.heightCells = Math.min(height, GYRE_RULES.maxHeight, GameBoard.NUM_ROWS - top);
    }
  };

  /**
   * A sized spell hitting a Gyre (13a): its cells inside the Gyre break off as 1x1 pieces and are
   * lifted, as many as the Gyre's capacity allows (leading cells first). The rest keep going.
   */
  private breakUpAtGyre = (parent: Spell, gyre: Gyre, parentRemainingMoves: number): void => {
    const isInsideGyre = (cell: CellIndex) => overlapsBoundingBox(cell, 1, 1, gyre.cellIndex, gyre.widthCells, gyre.heightCells);
    const cells = getFootprintCells(parent);
    const groupId = parent.fragmentGroupId || parent.id;

    const cellCost = gyre.getCapacityUse(parent) === 1 ? 1 : parent.baseCellDmg;
    const capacityLeft = Math.floor((gyre.getCapacity() - gyre.capacityUsed) / cellCost);
    const dir = Math.sign(parent.speedDirection) || 1;
    const byLeadingColumn = (a: CellIndex, b: CellIndex) => (b.j - a.j) * dir || a.i - b.i;
    const lifted = cells.filter(isInsideGyre).sort(byLeadingColumn).slice(0, Math.max(0, capacityLeft));
    if (!lifted.length) return; // nothing inside, or no capacity left: the spell passes through

    gyre.capacityUsed += lifted.length * cellCost;
    lifted.forEach(cell => {
      const piece = this.createPiece(parent, gyre, { ...cell, w: 1, h: 1 }, parentRemainingMoves, groupId);
      piece.resolveSpellCollision(gyre); // lift
      this.recordLift(piece, gyre);
    });
    const isLifted = (c: CellIndex) => lifted.some(l => l.i === c.i && l.j === c.j);
    splitIntoAllowedShapes(parent, cells.filter(c => !isLifted(c)))
      .forEach(rect => this.createPiece(parent, gyre, rect, parentRemainingMoves, groupId));
    this.removeShatteredParent(parent, gyre);
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

  /**
   * A sized spell hitting a Phlegm (requirement 13, as revised):
   * - Single-row spells (Quicken chains) enter cell by cell: cells inside the Phlegm break off as
   *   1x1 pieces that orbit it in single file; the rest stays chained behind and enters later.
   * - Taller spells split by rows: the rows touching the Phlegm bounce off it as a block (swirl in
   *   place, then reverse); the other rows keep going. If every row touches, the whole spell bounces.
   */
  private breakUpAtPhlegm = (parent: Spell, phlegm: Phlegm, parentRemainingMoves: number): void => {
    // Pieces get the reflection bonus of the whole spell (13b)
    const reflectBonusMoves = getReflectBonusMoves(parent.getPower(), phlegm);
    const isInsidePhlegm = (cell: CellIndex) => overlapsBoundingBox(cell, 1, 1, phlegm.cellIndex, phlegm.widthCells, phlegm.heightCells);
    const isTouchingRow = (i: number) => i >= phlegm.cellIndex.i && i < phlegm.cellIndex.i + phlegm.heightCells;
    const cells = getFootprintCells(parent);
    const groupId = parent.fragmentGroupId || parent.id;

    // The Phlegm only takes as many cells as its capacity allows (7c), leading cells first
    const cellCost = getPhlegmCapacityUse(phlegm, parent) === 1 ? 1 : parent.baseCellDmg;
    let capacityLeft = Math.floor((getPhlegmCapacity(phlegm) - phlegm.capacityUsed) / cellCost);
    const dir = Math.sign(parent.speedDirection) || 1;
    const byLeadingColumn = (a: CellIndex, b: CellIndex) => (b.j - a.j) * dir || a.i - b.i;
    const isIn = (list: Array<CellIndex>) => (c: CellIndex) => list.some(l => l.i === c.i && l.j === c.j);
    if (capacityLeft <= 0) return; // not enough capacity left for even one cell: the spell passes through

    if (parent.heightCells === 1) {
      const captured = cells.filter(isInsidePhlegm).sort(byLeadingColumn).slice(0, capacityLeft);
      phlegm.capacityUsed += captured.length * cellCost;
      capacityLeft -= captured.length;
      captured.forEach(cell => {
        const piece = this.createPiece(parent, phlegm, { ...cell, w: 1, h: 1 }, parentRemainingMoves, groupId);
        phlegm.consumingSpellIds.add(piece.id);
        piece.resolveSpellCollision(phlegm); // orbit
        piece.phlegmBonusMoves = reflectBonusMoves;
      });
      // The rest stays chained and follows in single file, unless the Phlegm is now used up:
      // then it passes through as a separate spell
      const restGroupId = capacityLeft > 0 ? groupId : `${groupId}:pass`;
      splitIntoAllowedShapes(parent, cells.filter(c => !isIn(captured)(c)))
        .forEach(rect => this.createPiece(parent, phlegm, rect, parentRemainingMoves, restGroupId));
      this.removeShatteredParent(parent, phlegm);
      return;
    }

    // Taller spells: whole leading columns of the touching rows bounce, as many as capacity allows
    const touchingCells = cells.filter(c => isTouchingRow(c.i));
    const numTouchingRows = new Set(touchingCells.map(c => c.i)).size;
    const columnsLeadingFirst = [...new Set([...touchingCells].sort(byLeadingColumn).map(c => c.j))];
    const numBounceColumns = Math.floor(capacityLeft / numTouchingRows);
    const bounceCells = numBounceColumns > 0
      ? touchingCells.filter(c => columnsLeadingFirst.indexOf(c.j) < numBounceColumns)
      : touchingCells.filter(c => c.j === columnsLeadingFirst[0]).sort((a, b) => a.i - b.i).slice(0, capacityLeft);
    const passCells = cells.filter(c => !isIn(bounceCells)(c));
    phlegm.capacityUsed += bounceCells.length * cellCost;

    // Every bouncing piece slides in together, keeping its formation
    const bounceMinJ = Math.min(...bounceCells.map(c => c.j));
    const bounceWidth = Math.max(...bounceCells.map(c => c.j)) - bounceMinJ + 1;
    const entrySteps = getBounceEntrySteps(bounceMinJ, bounceWidth, dir, phlegm);
    if (!passCells.length) {
      this.startPhlegmBounce(parent, phlegm, entrySteps, reflectBonusMoves);
      return;
    }

    // The two parts reassemble separately (they now travel in opposite directions)
    splitIntoAllowedShapes(parent, bounceCells)
      .forEach(rect => this.startPhlegmBounce(this.createPiece(parent, phlegm, rect, parentRemainingMoves, `${groupId}:bounce`), phlegm, entrySteps, reflectBonusMoves));
    splitIntoAllowedShapes(parent, passCells)
      .forEach(rect => this.createPiece(parent, phlegm, rect, parentRemainingMoves, `${groupId}:pass`));
    this.removeShatteredParent(parent, phlegm);
  };

  /**
   * The spell slides into the Phlegm, swirls in place for its orbit's duration, then reverses (13).
   * Neither the slide nor the swirl uses up the spell's own moves.
   */
  private startPhlegmBounce = (spell: Spell, phlegm: Phlegm, entrySteps: number, reflectBonusMoves: number): void => {
    spell.phlegmBonusMoves = reflectBonusMoves;
    const dwellSteps = Math.max(1, 4 * (phlegm.widthCells - 1));
    spell.consumedSpellRef = phlegm;
    phlegm.consumingSpellIds.add(spell.id);
    spell.phlegmEntryStepsRemaining = entrySteps;
    spell.phlegmDwellStepsRemaining = dwellSteps;
    spell.remainingMoves += entrySteps + dwellSteps;
    if (spell instanceof Phlegm) {
      // Same empowerment as a Phlegm orbiting a Phlegm (Phlegm.conferModifierTo)
      phlegm.consumedPhlegms++;
      spell.consumedPhlegms += phlegm.consumedPhlegms;
    }
  };

  /** Adds a piece of `parent` covering `rect`, keeping the parent's bonuses and remaining moves. */
  private createPiece = (parent: Spell, breaker: Spell, rect: CellRect, remainingMoves: number, groupId: string): Spell => {
    const piece: Spell = new (parent.constructor as any)(parent.caster);
    piece.widthCells = rect.w;
    piece.heightCells = rect.h;
    piece.setCellIndex({ i: rect.i, j: rect.j });
    piece.speedDirection = parent.speedDirection;
    piece.consumedEthers = parent.consumedEthers;
    piece.consumedQuickens = parent.consumedQuickens;
    piece.consumedPhlegms = parent.consumedPhlegms;
    piece.recordedMovesCount = parent.recordedMovesCount;
    piece.remainingMoves = remainingMoves;
    piece.fragmentGroupId = groupId;
    piece.fragmentBreakerId = breaker.id;
    this.spells.push(piece);
    return piece;
  };
}

// --- Combining -------------------------------------------------------------------------------

/**
 * Reassembles adjacent compatible spells into the largest allowed shapes. Mutates `spells`' members.
 * Spells moving left are combined on a mirrored board, so both sides combine the same way.
 */
export const combineSpellsMaximally = (spells: Array<Spell>): void => {
  combineSpellsMovingIn(spells, 1);
  mirrorBoardColumns(spells);
  combineSpellsMovingIn(spells, -1);
  mirrorBoardColumns(spells);
};

/**
 * Combines the spells moving in `direction` (1: right, -1: left), scanning from the top-left.
 * (Called on a mirrored board for spells moving left.)
 */
const combineSpellsMovingIn = (spells: Array<Spell>, direction: number): void => {
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
    const isMovingInDirection = (s: Spell) => Math.sign(s.getPropertyValue('speedDirection')) === direction;
    return sameType && isMovingInDirection(a) && isMovingInDirection(b);
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
            root.consumedPhlegms += m.consumedPhlegms;
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

        while (i + stackHeight < MAX_ROWS) {
          const neighbor = matrix[i + stackHeight][j];
          const isStackable = componentsMatch(root, neighbor) && neighbor instanceof Gyre &&
            stackHeight + neighbor.heightCells <= GYRE_RULES.maxHeight;
          if (isStackable) {
            matchesToMerge.push(neighbor!);
            stackHeight += neighbor!.heightCells;
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
            root.capacityUsed += m.capacityUsed;
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

    // Only spells lying entirely inside the square can merge into it, starting from its top-left
    const isInsideSquare = (s: Spell) =>
      s.cellIndex.i >= rootI && s.cellIndex.j >= rootJ &&
      s.cellIndex.i + s.heightCells <= rootI + targetSize && s.cellIndex.j + s.widthCells <= rootJ + targetSize;
    const isRootAnchored = root.cellIndex.i === rootI && root.cellIndex.j === rootJ;
    if (!isRootAnchored || !isInsideSquare(root)) return false;

    const targetCluster = new Set<Spell>();

    for (let r = 0; r < targetSize; r++) {
      for (let c = 0; c < targetSize; c++) {
        const checkI = rootI + r;
        const checkJ = rootJ + c;

        if (checkI >= MAX_ROWS || checkJ >= MAX_COLS) return false;

        const candidate = matrix[checkI][checkJ];
        if (candidate === root) continue;

        if (componentsMatch(root, candidate) && isInsideSquare(candidate!)) {
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
      root.consumedPhlegms += m.consumedPhlegms;
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
