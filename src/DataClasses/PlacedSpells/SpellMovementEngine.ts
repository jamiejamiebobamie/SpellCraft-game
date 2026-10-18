// SpellMovementEngine.ts
// Pure, synchronous spell-movement rules engine: no timers, rendering, React, or valtio.
// Runs a full spell-movement turn on a cloned copy of the placed spells and returns a log of
// frames for the UI to replay (see PlacedSpells.updateSpells).
//
// The rules are being rebuilt step by step against spell-movement-requirements.md. Collisions
// follow requirements 1-2; the rest still follow the original rules (see "Known bugs" there).
import { Spell, Phlegm, Ether, Gyre, GyreUp, GyreDown, Quicken } from './Spell';
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

const getIsBouncing = (spell: Spell): boolean => spell.phlegmEntryStepsRemaining > 0 || spell.phlegmDwellStepsRemaining > 0;

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

/**
 * Steps a block bouncing off a Phlegm slides in first: until centered on the Phlegm if it fits,
 * otherwise until its front edge reaches the Phlegm's far side.
 */
const getBounceEntrySteps = (blockJ: number, blockWidth: number, dir: number, phlegm: Phlegm): number => {
  const phlegmWidth = phlegm.widthCells;
  const targetJ = blockWidth <= phlegmWidth
    ? phlegm.cellIndex.j + Math.floor((phlegmWidth - blockWidth) / 2)
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
 * from the top-left so the result is deterministic.
 */
const splitIntoAllowedShapes = (spell: Spell, cells: Array<CellIndex>): Array<CellRect> => {
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

  constructor(spells: Array<Spell>) {
    this.spells = copySpellGraph(spells);
  }

  simulateTurn = (): SpellTurnLog => {
    this.frames = [];

    if (PHLEGM_RULES.capacityResetsEachTurn) {
      this.spells.forEach(s => { if (s instanceof Phlegm) s.capacityUsed = 0; });
    }

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
    });
    combineSpellsMaximally(this.spells);
    this.captureFrame('final');

    return { frames: this.frames };
  };

  private captureFrame = (kind: SpellTurnFrameKind): void => {
    this.frames.push({ kind, spells: copySpellGraph(this.spells), healthEvents: this.pendingHealthEvents });
    this.pendingHealthEvents = [];
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
        if (sibling === piece || sibling.getIsRemove() || !isSameSpellPieces(piece, sibling)) return false;
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
      spell.recordedMovesCount++;

      const isGyreMove = !!spell.consumedGyres && spell.consumedGyres !== 0;

      // A blocked piece stays put: it either waits (keeping its move) or gives the move up
      if (blockedPieces.has(spell)) {
        const isWaiting = blockedPieces.get(spell);
        if (!isWaiting && !isGyreMove) spell.remainingMoves--;
        continue;
      }

      if (!isGyreMove) {
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

  // --- Reassembly ----------------------------------------------------------------------------

  /**
   * Once every piece of a broken-up spell is out of the Phlegm/Gyre that broke it (none inside
   * it, orbiting, or being lifted), the pieces immediately reassemble into one spell that stops
   * for the rest of the turn. Pieces only reassemble into a complete, allowed shape; otherwise
   * they wait for the end-of-turn merge.
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
      root.remainingMoves = 0;
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
    if (a.isInPhlegmField && b instanceof Phlegm) return false; // orbiting spells pass over Phlegms
    if (b.isInPhlegmField && a instanceof Phlegm) return false;
    if (getIsBouncing(a) && b instanceof Phlegm) return false; // bouncing blocks too
    if (getIsBouncing(b) && a instanceof Phlegm) return false;
    if (getIsPhlegmFull(a) || getIsPhlegmFull(b)) return false; // used-up Phlegms are passed through (7c)
    return true;
  };

  private resolvePair = ({ a, b, isSwap }: CollisionPair, positionCache: Map<string, CellIndex>): void => {
    // An earlier collision this step may have changed either spell (1b)
    if (!this.getCanCollide(a, b)) return;

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
    // (sized spells use capacity per cell, in breakUpAtPhlegm)
    const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
    if (loser instanceof Phlegm && !isWinnerSized) loser.capacityUsed += getPhlegmCapacityUse(loser, winner);
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

    winner.resolveSpellCollision(loser);

    let extraMoves = 0;
    if (loser instanceof Phlegm) {
      const phlegmDmg = loser.getPropertyValue('dmgHealth');
      const winnerDmg = winner.getPropertyValue('dmgHealth');
      const absoluteDiff = Math.abs(phlegmDmg) - Math.abs(winnerDmg);
      extraMoves = Math.max(Math.floor(absoluteDiff / 5), 1);
    }

    if (isWinnerSized && isCollisionWithTerrain) {
      // Only apply direct shortcuts if the WINNER is also a native Gyre.
      // If a sized Quicken or Ether hits a Gyre, it MUST shatter first so its fragments are individual objects!
      if (loser instanceof Gyre && winner instanceof Gyre) {
        const rowShifts = loser instanceof GyreDown ? loser.cellIndex.i + loser.heightCells : loser.cellIndex.i - 1 - winner.cellIndex.i;
        winner.consumedGyres = rowShifts;
      } else {
        this.shatterSpellIntoFragments(winner, loser, winnerRemainingMoves);
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
      this.startPhlegmBounce(parent, phlegm, entrySteps);
      return;
    }

    // The two parts reassemble separately (they now travel in opposite directions)
    splitIntoAllowedShapes(parent, bounceCells)
      .forEach(rect => this.startPhlegmBounce(this.createPiece(parent, phlegm, rect, parentRemainingMoves, `${groupId}:bounce`), phlegm, entrySteps));
    splitIntoAllowedShapes(parent, passCells)
      .forEach(rect => this.createPiece(parent, phlegm, rect, parentRemainingMoves, `${groupId}:pass`));
    this.removeShatteredParent(parent, phlegm);
  };

  /**
   * The spell slides into the Phlegm, swirls in place for its orbit's duration, then reverses (13).
   * Neither the slide nor the swirl uses up the spell's own moves.
   */
  private startPhlegmBounce = (spell: Spell, phlegm: Phlegm, entrySteps: number): void => {
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

  private shatterSpellIntoFragments = (parent: Spell, hit: Spell, parentRemainingMoves: number): [Array<Spell>, number] => {
    const fragments: Array<Spell> = [];

    const hitDir = Math.sign(hit.getPropertyValue('speedDirection'));
    // The hit spell's leading column (cellIndex is always its left-most column)
    const hitColumn = hitDir > 0 ? hit.getCellIndex().j + hit.widthCells - 1 : hit.getCellIndex().j;
    const hitMinColumn = hit.getCellIndex().j;
    const hitMaxColumn = hit.getCellIndex().j + (hit.widthCells - 1);

    const hitMinRow = hit.getCellIndex().i;
    const hitMaxRow = hit.getCellIndex().i + (hit.heightCells - 1);

    // Pieces move at the parent's speed for the rest of the turn (13b)
    const remainingMoves = parentRemainingMoves;

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
          frag.consumedPhlegms = parent.consumedPhlegms;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;
          frag.fragmentBreakerId = hit.id;

          this.spells.push(frag);
          fragments.push(frag);

          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = gyreRoot - lowestPoint;
          frag.setCellIndex({ i: gyreRoot, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.consumedPhlegms = parent.consumedPhlegms;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;
          frag.fragmentBreakerId = hit.id;

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
          frag.consumedPhlegms = parent.consumedPhlegms;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.remainingMoves = remainingMoves;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;
          frag.fragmentBreakerId = hit.id;

          this.spells.push(frag);
          fragments.push(frag);

          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = lowestPoint - gyreRoot;
          frag.setCellIndex({ i: gyreRoot, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.consumedPhlegms = parent.consumedPhlegms;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;
          frag.fragmentGroupId = parent.fragmentGroupId || parent.id;
          frag.fragmentBreakerId = hit.id;

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
        frag.consumedPhlegms = parent.consumedPhlegms;
        frag.recordedMovesCount = parent.recordedMovesCount;
        frag.remainingMoves = remainingMoves;

        frag.consumingSpellIds = new Set();
        frag.consumedSpellRef = null;
        frag.fragmentGroupId = parent.fragmentGroupId || parent.id;
        frag.fragmentBreakerId = hit.id;

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
