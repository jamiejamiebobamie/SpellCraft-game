// GameBoard/PlacedSpells.ts
import { Spell, Phlegm, Ether, Gyre, GyreUp, GyreDown, Quicken } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex, CollisionResult } from '../types';
import { proxy } from 'valtio';

export class PlacedSpells {
  spells: Array<Spell> = proxy([]);
  // static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 100; // for micro steps
  // static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 1000; // for entire spell movement turn (time it takes for all spells to finish all moves)

  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 1000; // for micro steps
  static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 3000; // for entire spell movement turn (time it takes for all spells to finish all moves)

  addSpell = (spell: Spell): void => {
    if (!this.spells.includes(spell)) {
      this.spells.push(spell);
    }
  };

  reset = (): void => {
    this.spells.splice(0);
  };

  removeConsumed = (): void => {
    this.spells.filter(spell => !!spell.consumingSpellIds.size).forEach(s => s.markSpellForRemoval());
  }

  removeInvalidSpells = (gameBoard: GameBoard): void => {
    const validSpellIds = this.spells.filter(spell => !spell.getIsRemove() && !!spell.cellIndex).map(s => s.id);
    gameBoard.cells.forEach(c => {
      if (c.spell && !validSpellIds.includes(c.spell.id)) {
        c.setSpell(null);
      }
    });

    // FIX 1: Safe Valtio filter assignment instead of destructive inline splicing
    this.spells = proxy(this.spells.filter(spell => !spell.getIsRemove()));
  };

  private checkBoundingBoxOverlap = (
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

  updateSpells = async (gameBoard: GameBoard, forceUpdate: Function, decrementPlayerHealth: Function): Promise<void> => {
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
      this.clearGridFootprints(gameBoard);

      const anySpellMoved = this.executeSynchronousMicroSteps(gameBoard, forceUpdate, decrementPlayerHealth);
      if (!anySpellMoved) break;

      this.handleMidStepCollisions(positionCache);

      forceUpdate();
      await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));

      await this.resolveGridCollisions(gameBoard, forceUpdate);
      currentMicroStep++;

      // Guard check to prevent extreme edge case canvas freeze locks
      if (currentMicroStep > 50) {
        break;
      }
    }

    this.spells.forEach(s => {
      s.consumedGyres = 0;
      s.consumedPhlegms = 0;
    });

    this.removeConsumed();
    forceUpdate();
    await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_TURN_DELAY_MILLI));
    this.removeInvalidSpells(gameBoard);
    gameBoard.cells.forEach(c => {
      if (c.spell && c.spell.getIsRemove()) {
        c.setSpell(null);
      }
    });
    this.combineSpellsMaximally(gameBoard);
    forceUpdate();
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

        if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA)) continue;

        const posA = spellA.getCellIndex();
        const posB = spellB.getCellIndex();
        if (!posA || !posB) continue;

        // FIX 4: Sized Bounding Box Calculation for lookahead step vectors
        const nextJA = posA.j + Math.sign(spellA.getPropertyValue('speedDirection')) * (spellA.remainingMoves > 0 ? 1 : 0);
        const nextJB = posB.j + Math.sign(spellB.getPropertyValue('speedDirection')) * (spellB.remainingMoves > 0 ? 1 : 0);

        const futurePosA = { i: posA.i, j: nextJA };
        const futurePosB = { i: posB.i, j: nextJB };

        const wA = spellA.widthCells;
        const hA = spellA.heightCells;
        const wB = spellB.widthCells;
        const hB = spellB.heightCells;

        const willCollide =
          this.checkBoundingBoxOverlap(futurePosA, wA, hA, posB, wB, hB) &&
          this.checkBoundingBoxOverlap(futurePosB, wB, hB, posA, wA, hA);

        if (willCollide) {
          const pairKey = [spellA.id, spellB.id].sort().join('_');
          if (resolvedLookAheads.has(pairKey)) continue;
          resolvedLookAheads.add(pairKey);

          this.processCollisionPair(spellA, spellB, positionCache, true);
        }
      }
    }
  };

  private clearGridFootprints = (gameBoard: GameBoard): void => {
    this.spells.forEach(s => {
      if (s.getIsRemove()) return;
      const currentCellIndex = s.getCellIndex();
      if (currentCellIndex) {
        for (let r = 0; r < s.heightCells; r++) {
          for (let c = 0; c < s.widthCells; c++) {
            const targetI = currentCellIndex.i + r;
            const targetJ = currentCellIndex.j + c;
            if (targetI >= 0 && targetI < GameBoard.NUM_ROWS && targetJ >= 0 && targetJ < GameBoard.NUM_COLS) {
              const cell = gameBoard.getCellAt({ i: targetI, j: targetJ });
              if (cell && cell.getSpell() === s) {
                cell.setSpell(null);
              }
            }
          }
        }
      }
    });
  };

  private executeSynchronousMicroSteps = (gameBoard: GameBoard, forceUpdate: Function, decrementPlayerHealth: Function): boolean => {
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
      forceUpdate();

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

        spell.hitDamageAmount = dmg;
        if (isLeftExit) spell.isPlayerHitImpact = true;
        else spell.isOpponentHitImpact = true;

        decrementPlayerHealth(playerIndex, dmg);
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

        if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA)) continue;

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
            this.checkBoundingBoxOverlap(endA, wA, hA, startB, wB, hB) &&
            this.checkBoundingBoxOverlap(endB, wB, hB, startA, wA, hA);

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

  private processCollisionPair = async (spellA: Spell, spellB: Spell, positionCache: Map<string, CellIndex>, isLookAhead: boolean): Promise<void> => {
    const { winner, loser } = await this.doCollision(spellA, spellB);
    if (winner && loser) {
      if (isLookAhead) {
        loser.remainingMoves = 0;
      } else {
        const startOrigin = winner === spellA ? positionCache.get(spellA.id) : positionCache.get(spellB.id);
        if (startOrigin) loser.setCellIndex({ i: startOrigin.i, j: startOrigin.j });
      }
    }
  };

  private doCollision = async (spellA: Spell, spellB: Spell): Promise<CollisionResult> => {
    if (spellA.getIsRemove() || spellB.getIsRemove()) return { winner: null, loser: null };
    if (spellA.isInPhlegmField && spellB instanceof Phlegm) return { winner: null, loser: null };
    if (spellB.isInPhlegmField && spellA instanceof Phlegm) return { winner: null, loser: null };

    const dmgA = spellA.getPropertyValue('dmgHealth');
    const dmgB = spellB.getPropertyValue('dmgHealth');

    let winner = spellA;
    let loser = spellB;

    if (dmgA === dmgB) {
      spellA.markSpellForRemoval();
      spellB.markSpellForRemoval();
      return { winner: null, loser: null };
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

    if (isWinnerSized && isCollisionWithTerrain) {
      // FIX: Only apply direct shortcuts if the WINNER is also a native Gyre. 
      // If a sized Quicken or Ether hits a Gyre, it MUST shatter first so its fragments are individual objects!
      if (loser instanceof Gyre && winner instanceof Gyre) {
        const rowShifts = loser instanceof GyreDown ? loser.cellIndex.i + loser.heightCells : loser.cellIndex.i - 1 - winner.cellIndex.i;
        winner.consumedGyres = rowShifts;
      } else {
        await this.shatterSpellIntoFragments(winner, loser);
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

    return { winner, loser };
  }

  private resolveGridCollisions = async (gameBoard: GameBoard, forceUpdate: Function): Promise<void> => {
    const resolvedPairs = new Set();
    while (true) {
      let structuralCollisionFoundThisPass = false;
      const activeSpells = this.spells.filter(s => !s.getIsRemove());
      for (let i = 0; i < activeSpells.length; i++) {
        for (let j = i + 1; j < activeSpells.length; j++) {
          const spellA = activeSpells[i];
          const spellB = activeSpells[j];
          if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA)) continue;
          const idxA = spellA.getCellIndex();
          const idxB = spellB.getCellIndex();
          if (!idxA || !idxB) continue;
          const overlaps = (
            idxA.j < idxB.j + spellB.widthCells &&
            idxA.j + spellA.widthCells > idxB.j &&
            idxA.i < idxB.i + spellB.heightCells &&
            idxA.i + spellA.heightCells > idxB.i
          );
          if (overlaps) {
            const pairKey = [spellA.id, spellB.id].sort().join('_');
            if (resolvedPairs.has(pairKey)) continue;
            resolvedPairs.add(pairKey);
            structuralCollisionFoundThisPass = true;
            this.doCollision(spellA, spellB);
            forceUpdate();
            break;
          }
        }
        if (structuralCollisionFoundThisPass) break;
      }
      if (!structuralCollisionFoundThisPass) break;
    }
    this.spells.forEach(spell => {
      if (spell.getIsRemove()) return;
      const idx = spell.getCellIndex();
      if (!idx) return;
      for (let r = 0; r < spell.heightCells; r++) {
        for (let c = 0; c < spell.widthCells; c++) {
          const cell = gameBoard.getCellAt({ i: idx.i + r, j: idx.j + c });
          if (cell) cell.setSpell(spell);
        }
      }
    });
  };

  private shatterSpellIntoFragments = (parent: Spell, hit: Spell): [Array<Spell>, number] => {
    const fragments: Array<Spell> = [];

    const dir = Math.sign(parent.getPropertyValue('speedDirection'));
    const hitDir = Math.sign(hit.getPropertyValue('speedDirection'));
    const hitColumn = hit.getCellIndex().j + (hit.widthCells - 1) * hitDir;

    const hitMinRow = hit.getCellIndex().i;
    const hitMaxRow = hit.getCellIndex().i + (hit.heightCells - 1);

    const remainingMoves = Math.max(0, parent.widthCells - Math.abs(hitColumn - parent.cellIndex.j) + (parent.consumedQuickens > 0 ? 1 : 0));

    if (parent instanceof Gyre) {
      // FIX: Only trigger the row shortcut if hitting another Gyre. If hitting a Phlegm or Ether, bypass this and fall directly to shattering!
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

          let newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

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

          newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

          parent.markSpellForRemoval();
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

          let newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = lowestPoint - gyreRoot;
          frag.setCellIndex({ i: gyreRoot, j: hitColumn });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.consumingSpellIds = new Set();
          frag.consumedSpellRef = null;

          newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

          parent.markSpellForRemoval();
          return [fragments, remainingMoves];
        }
      }

      // FALLBACK BREAKDOWN FOR PHLEGM/TERRAIN: If it hits a Phlegm, let it fall through to the matrix loop below!
    }

    // This is your original structural fallback block for standard matrix fracturing
    for (let r = 0; r < parent.heightCells; r++) {
      for (let c = 0; c < parent.widthCells; c++) {
        const i = parent.cellIndex.i + r;
        const j = parent.cellIndex.j + c * dir;

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

        const isOverlappingColumn = j === hitColumn;
        const isOverlappingRow = i >= hitMinRow && i <= hitMaxRow;

        if (isOverlappingColumn && isOverlappingRow) {
          const wrappedFrag = proxy(frag);
          hit.consumingSpellIds.add(wrappedFrag.id);
          wrappedFrag.resolveSpellCollision(hit);
          this.spells.push(wrappedFrag);
          fragments.push(wrappedFrag);
        } else {
          const newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);
        }
      }
    }

    parent.markSpellForRemoval();
    return [fragments, remainingMoves];
  };

  public combineSpellsMaximally = (gameBoard: GameBoard): void => {
    const MAX_COLS = GameBoard.NUM_COLS;
    const MAX_ROWS = GameBoard.NUM_ROWS;

    const matrix: Array<Array<Spell | null>> = Array(MAX_ROWS).fill(null).map(() => Array(MAX_COLS).fill(null));
    const consumerIds = this.spells.reduce((acc, item) => [...acc, ...item.consumingSpellIds], new Array<string>())

    this.spells.forEach(s => {
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

      // FIX: If EITHER spell fragment is currently resolving a vertical rowShift track, block them from recombining!
      // This gives fragments time to safely drift away from each other before they are allowed to merge back into larger shapes.
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

          // FIX 1: Added explicit boundaries checking to prevent index modifications overflows
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

    this.spells.forEach(s => {
      if (!s.getIsRemove()) {
        const idx = s.getCellIndex();
        if (idx) {
          for (let r = 0; r < s.heightCells; r++) {
            for (let c = 0; c < s.widthCells; c++) {
              const targetI = idx.i + r;
              const targetJ = idx.j + c;
              if (targetI >= 0 && targetI < MAX_ROWS && targetJ >= 0 && targetJ < MAX_COLS) {
                const cell = gameBoard.getCellAt({ i: targetI, j: targetJ });
                if (cell) cell.setSpell(s);
              }
            }
          }
        }
      }
    });
  };

}