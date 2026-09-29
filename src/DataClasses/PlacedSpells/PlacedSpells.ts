// PlacedSpells.ts — PART 1
import { Spell, Phlegm, Ether, Gyre, GyreUp, GyreDown, Quicken } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex } from '../types';
import { proxy } from 'valtio';

export class PlacedSpells {
  spells: Array<Spell> = proxy([]);
  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 100; // for micro steps
  static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 1000; // for entire spell movement turn (time it takes for all spells to finish all moves)


  getTop = (): Spell | null => {
    return this.spells[this.spells.length - 1];
  };

  addSpell = (spell: Spell): void => {
    if (!this.spells.includes(spell)) {
      this.spells.push(spell);
      this.reindexUpdateOrder();
    }
  };

  reset = (): void => {
    this.spells.splice(0);
  };

  reindexUpdateOrder = (): void => {
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
      if (i !== -1) this.spells.splice(i, 1);
    });
    this.reindexUpdateOrder();
  };

  static async* timedIterator<T>(items: T[], delayTime: number): AsyncGenerator<T, void, unknown> {
    const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    for (const item of items) {
      await wait(delayTime);
      yield item;
    }
  }

  static getRangedArray = (range: number): Array<number> => {
    return Array(range).fill(0).map((_, i) => i);
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

  // PlacedSpells.ts — PART 2
  updateSpells = async (gameBoard: GameBoard, forceUpdate: Function, decrementPlayerHealth: Function): Promise<void> => {
    this.spells.forEach(s => {
      if (!s.isRemove) {
        const moves = Math.abs(s.getPropertyValue('empoweredSpeedDirection'));
        s.remainingMoves = moves;
        s.recordedMovesCount = 0;
      }
    });

    let currentMicroStep = 1;

    while (true) {
      // DECOUPLED TRACKER: Incorporate vertical gyre momentum limits alongside horizontal bounds
      let maxMovesNeeded = 0;
      this.spells.forEach(s => {
        if (!s.isRemove) {
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

      const anySpellMoved = this.executeSynchronousMicroSteps(gameBoard, decrementPlayerHealth);
      if (!anySpellMoved) break;

      this.handleMidStepTunnelingSwaps(positionCache);

      forceUpdate();
      await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));

      await this.resolveGridCollisions(gameBoard, forceUpdate);
      currentMicroStep++;
    }

    this.spells.forEach(s => {
      s.consumedGyres = 0;
      s.consumedPhlegms = 0;
      s.isBeingConsumed = false;
    });

    this.combineSpellsMaximally(gameBoard);
    gameBoard.setEmpoweredSpells();
    forceUpdate();
    await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_TURN_DELAY_MILLI));
    this.removeInvalidSpells();
    forceUpdate();
  };

  private cachePositions = (): Map<string, CellIndex> => {
    const positionCache = new Map<string, CellIndex>();
    this.spells.forEach(s => {
      if (s.isRemove) return;
      const idx = s.getCellIndex();
      if (idx) {
        positionCache.set(s.key, { i: idx.i, j: idx.j });
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

        if (spellA.isRemove || spellB.isRemove || spellA.isBeingConsumed || spellB.isBeingConsumed) continue;

        const posA = spellA.getCellIndex();
        const posB = spellB.getCellIndex();
        if (!posA || !posB) continue;

        const nextJA = posA.j + Math.sign(spellA.getPropertyValue('empoweredSpeedDirection')) * (spellA.remainingMoves > 0 ? 1 : 0);
        const nextJB = posB.j + Math.sign(spellB.getPropertyValue('empoweredSpeedDirection')) * (spellB.remainingMoves > 0 ? 1 : 0);

        const futurePosA = { i: posA.i, j: nextJA };
        const futurePosB = { i: posB.i, j: nextJB };

        const wA = spellA.widthCells;
        const hA = spellA.heightCells;
        const wB = spellB.widthCells;
        const hB = spellB.heightCells;

        const willSwap =
          this.checkBoundingBoxOverlap(futurePosA, wA, hA, posB, wB, hB) &&
          this.checkBoundingBoxOverlap(futurePosB, wB, hB, posA, wA, hA);

        if (willSwap) {
          const pairKey = [spellA.key, spellB.key].sort().join('-');
          if (resolvedLookAheads.has(pairKey)) continue;
          resolvedLookAheads.add(pairKey);

          this.processCollisionPair(spellA, spellB, positionCache, true);
        }
      }
    }
  };

  private clearGridFootprints = (gameBoard: GameBoard): void => {
    this.spells.forEach(s => {
      if (s.isRemove) return;
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

  private executeSynchronousMicroSteps = (gameBoard: GameBoard, decrementPlayerHealth: Function): boolean => {
    let anySpellMoved = false;

    for (const spell of this.spells) {
      if (spell.isRemove || spell.isBeingConsumed) continue;
      // Terminate stepping if BOTH horizontal movement and vertical climbing states are spent
      if (spell.remainingMoves <= 0 && (!spell.consumedGyres || spell.consumedGyres === 0)) continue;

      anySpellMoved = true;
      spell.recordedMovesCount++;

      // Only deduct a horizontal turn if the spell isn't actively climbing/descending a vertical line
      if (!spell.consumedGyres || spell.consumedGyres === 0) {
        spell.remainingMoves--;
      }

      spell.executeSingleMicroStep();

      const nextCellIndex = spell.getCellIndex();
      if (!nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: nextCellIndex.j })) {
        if (nextCellIndex) {
          const isLeftExit = nextCellIndex.j < 0;
          const isRightExit = nextCellIndex.j >= GameBoard.NUM_COLS;
          if (isLeftExit || isRightExit) {
            const dmg = spell.getPropertyValue('empoweredDmgHealth');
            const playerIndex = isLeftExit ? 0 : 1;

            spell.hitDamageAmount = dmg;
            if (isLeftExit) {
              spell.isPlayerHitImpact = true;
            } else {
              spell.isOpponentHitImpact = true;
            }

            decrementPlayerHealth(playerIndex, dmg);
          }
        }
        spell.markSpellForRemoval();
      }
    }
    return anySpellMoved;
  };

  private handleMidStepTunnelingSwaps = (positionCache: Map<string, CellIndex>): void => {
    const resolvedSwaps = new Set<string>();

    for (let i = 0; i < this.spells.length; i++) {
      for (let j = i + 1; j < this.spells.length; j++) {
        const spellA = this.spells[i];
        const spellB = this.spells[j];

        if (spellA.isRemove || spellB.isRemove || spellA.isBeingConsumed || spellB.isBeingConsumed) continue;

        const startA = positionCache.get(spellA.key);
        const startB = positionCache.get(spellB.key);
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
          const boxesSwapped =
            this.checkBoundingBoxOverlap(endA, wA, hA, startB, wB, hB) &&
            this.checkBoundingBoxOverlap(endB, wB, hB, startA, wA, hA);

          if (boxesSwapped) {
            const pairKey = [spellA.key, spellB.key].sort().join('-');
            if (resolvedSwaps.has(pairKey)) continue;
            resolvedSwaps.add(pairKey);

            this.processCollisionPair(spellA, spellB, positionCache, false);
          }
        }
      }
    }
  };

  private processCollisionPair = (spellA: Spell, spellB: Spell, positionCache: Map<string, CellIndex>, isLookAhead: boolean): void => {
    const dmgA = spellA.getPropertyValue('empoweredDmgHealth');
    const dmgB = spellB.getPropertyValue('empoweredDmgHealth');

    let winner = spellA;
    let loser = spellB;

    if (dmgA === dmgB) {
      if (Math.random() < 0.5) {
        winner = spellA;
        loser = spellB;
      } else {
        winner = spellB;
        loser = spellA;
      }
    } else if (spellA instanceof Phlegm && spellB instanceof Phlegm) {
      if (dmgA > dmgB) { winner = spellB; loser = spellA; }
    } else {
      if (dmgB > dmgA) { winner = spellB; loser = spellA; }
    }

    loser.isBeingConsumed = true;
    winner.resolveSpellCollision(loser);

    if (loser instanceof Phlegm) {
      const phlegmDmg = loser.getPropertyValue('empoweredDmgHealth');
      const winnerDmg = winner.getPropertyValue('empoweredDmgHealth');
      const absoluteDiff = Math.abs(phlegmDmg) - Math.abs(winnerDmg);
      const extraMoves = Math.max(Math.floor(absoluteDiff / 5), 1);
      if (extraMoves > 0) {
        winner.remainingMoves += extraMoves;
      }
    }

    if (winner.widthCells > 1 || winner.heightCells > 1) {
      if (loser instanceof Phlegm || loser instanceof Gyre) {
        this.shatterSpellIntoFragments(winner, loser instanceof Gyre ? loser : undefined);
      }
    } else if (loser instanceof Gyre) {
      // const sign = loser instanceof GyreUp ? - 1 : 1;
      // winner.consumedGyres = sign * loser.rowShift * loser.heightCells;
      winner.consumedGyres = loser.rowShift * loser.heightCells;
    }

    if (isLookAhead) {
      loser.remainingMoves = 0;
    } else {
      const startOrigin = winner === spellA ? positionCache.get(spellA.key) : positionCache.get(spellB.key);
      if (startOrigin) loser.setCellIndex({ i: startOrigin.i, j: startOrigin.j });
    }
  };

  private resolveGridCollisions = async (gameBoard: GameBoard, forceUpdate: Function): Promise<void> => {
    const resolvedPairs = new Set<string>();

    while (true) {
      let structuralCollisionFoundThisPass = false;
      const activeSpells = this.spells.filter(s => !s.isRemove);

      for (let i = 0; i < activeSpells.length; i++) {
        for (let j = i + 1; j < activeSpells.length; j++) {
          const spellA = activeSpells[i];
          const spellB = activeSpells[j];

          if (spellA.isRemove || spellB.isRemove) continue;

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
            const pairKey = [spellA.key, spellB.key].sort().join('-');
            if (resolvedPairs.has(pairKey)) continue;
            resolvedPairs.add(pairKey);

            structuralCollisionFoundThisPass = true;

            const dmgA = spellA.getPropertyValue('empoweredDmgHealth');
            const dmgB = spellB.getPropertyValue('empoweredDmgHealth');

            let winner = spellA;
            let loser = spellB;

            if (dmgA === dmgB) {
              if (Math.random() < 0.5) { winner = spellA; loser = spellB; }
              else { winner = spellB; loser = spellA; }
            } else if (spellA instanceof Phlegm && spellB instanceof Phlegm) {
              if (dmgA > dmgB) { winner = spellB; loser = spellA; }
            } else {
              if (dmgB >= dmgA) { winner = spellB; loser = spellA; }
            }

            const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
            const isCollisionWithTerrain = loser instanceof Phlegm || loser instanceof Gyre;

            // removed for 1x1 collisions to register...
            // if (!isWinnerSized && isCollisionWithTerrain) {
            //   continue;
            // }

            loser.isBeingConsumed = true;
            winner.resolveSpellCollision(loser);

            if (loser instanceof Phlegm) {
              const phlegmDmg = loser.getPropertyValue('empoweredDmgHealth');
              const winnerDmg = winner.getPropertyValue('empoweredDmgHealth');
              const absoluteDiff = Math.abs(phlegmDmg) - Math.abs(winnerDmg);
              const extraMoves = Math.max(Math.floor(absoluteDiff / 5), 1);
              if (extraMoves > 0) {
                winner.remainingMoves += extraMoves;
              }
            }

            if (isWinnerSized && isCollisionWithTerrain) {
              this.shatterSpellIntoFragments(winner, loser instanceof Gyre ? loser : undefined);
            } else if (loser instanceof Gyre) {
              // const sign = loser instanceof GyreUp ? - 1 : 1;
              // winner.consumedGyres = sign * loser.rowShift * loser.heightCells;
              winner.consumedGyres = loser.rowShift * loser.heightCells;
            }
            break;
          }
        }
        if (structuralCollisionFoundThisPass) break;
      }

      if (!structuralCollisionFoundThisPass) break;
    }

    this.spells.forEach(spell => {
      if (spell.isRemove) return;
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

  private shatterSpellIntoFragments = (parent: Spell, gyreHit?: Gyre): void => {
    parent.markSpellForRemoval();

    for (let r = 0; r < parent.heightCells; r++) {
      for (let c = 0; c < parent.widthCells; c++) {
        const fragI = parent.cellIndex.i + r;
        const fragJ = parent.cellIndex.j + c;

        const frag = new (parent.constructor as any)(parent.caster);
        frag.widthCells = 1;
        frag.heightCells = 1;
        frag.setCellIndex({ i: fragI, j: fragJ });

        frag.consumedEthers = parent.consumedEthers;
        frag.consumedQuickens = parent.consumedQuickens;
        frag.isPlaced = true;
        frag.recordedMovesCount = parent.recordedMovesCount;

        if (gyreHit) {
          const gyreRoot = gyreHit.getCellIndex();
          const isOverlappingGyreColumn = gyreRoot && fragJ === gyreRoot.j;

          if (isOverlappingGyreColumn && gyreRoot) {
            if (gyreHit instanceof GyreUp) {
              const gyreBottomRow = gyreRoot.i + gyreHit.heightCells - 1;
              const relativeEntryFromBottom = gyreBottomRow - fragI;
              frag.consumedGyres = -(gyreHit.heightCells - relativeEntryFromBottom + 1);
            } else if (gyreHit instanceof GyreDown) {
              const relativeEntryFromTop = fragI - gyreRoot.i;
              frag.consumedGyres = (gyreHit.heightCells - relativeEntryFromTop + 1);
            }

            // DECOUPLED TRACKER FIX: Retain clean remaining moves without adding ghost horizontal actions
            frag.remainingMoves = parent.remainingMoves;
          } else {
            frag.consumedGyres = 0;
            frag.remainingMoves = parent.remainingMoves;
          }
        } else {
          frag.consumedGyres = 0;
          frag.remainingMoves = parent.remainingMoves;
        }

        this.spells.push(frag);
      }
    }
    this.reindexUpdateOrder();
  };

  public combineSpellsMaximally = (gameBoard: GameBoard): void => {
    const MAX_COLS = GameBoard.NUM_COLS;
    const MAX_ROWS = GameBoard.NUM_ROWS;

    // 1. Initialize a full board lookup matrix
    const matrix: Array<Array<Spell | null>> = Array(MAX_ROWS).fill(null).map(() => Array(MAX_COLS).fill(null));

    // POPULATION FIX: Map EVERY cell covered by a sized spell's footprint into the matrix
    this.spells.forEach(s => {
      if (s.isRemove) return;
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
      if (!a || !b || a.isRemove || b.isRemove) return false;
      if (processed.has(a.key) || processed.has(b.key)) return false;
      const sameType = typeof a.constructor === typeof b.constructor;
      const sameDir = Math.sign(a.getPropertyValue('speedDirection')) === Math.sign(b.getPropertyValue('speedDirection'));
      return sameType && sameDir;
    };

    // --- PASS 1: Reassemble Horizontal Chains for Quickens ---
    for (let i = 0; i < MAX_ROWS; i++) {
      for (let j = 0; j < MAX_COLS; j++) {
        const root = matrix[i][j];
        if (root && root instanceof Quicken && !processed.has(root.key)) {
          let chainWidth = root.widthCells;
          const matchesToMerge: Spell[] = [];

          while (j + chainWidth < MAX_COLS && chainWidth < GameBoard.NUM_COLS) {
            const neighbor = matrix[i][j + chainWidth];
            if (componentsMatch(root, neighbor) && neighbor instanceof Quicken) {
              matchesToMerge.push(neighbor);
              chainWidth += neighbor.widthCells;
            } else {
              break;
            }
          }

          if (matchesToMerge.length > 0) {
            processed.add(root.key);
            matchesToMerge.forEach(m => {
              processed.add(m.key);
              root.consumedQuickens += m.consumedQuickens;
              root.consumedEthers += m.consumedEthers;
              m.markSpellForRemoval();
            });
            root.widthCells = chainWidth;
            root.heightCells = 1;
          }
        }
      }
    }

    // --- PASS 2: Reassemble Vertical Stacks for Gyres ---
    for (let j = 0; j < MAX_COLS; j++) {
      for (let i = 0; i < MAX_ROWS; i++) {
        const root = matrix[i][j];
        if (root && root instanceof Gyre && !processed.has(root.key)) {
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
            processed.add(root.key);
            matchesToMerge.forEach(m => {
              processed.add(m.key);
              m.markSpellForRemoval();
            });
            root.widthCells = 1;
            root.heightCells = stackHeight;
          }
        }
      }
    }

    // --- PASS 3: Reassemble Square Structures for Phlegms and Ethers ---
    const attemptSquareMerge = (rootI: number, rootJ: number, targetSize: number): boolean => {
      const root = matrix[rootI][rootJ];
      if (!root || processed.has(root.key)) return false;
      if (!(root instanceof Phlegm || root instanceof Ether)) return false;

      const targetCluster = new Set<Spell>();

      for (let r = 0; r < targetSize; r++) {
        for (let c = 0; c < targetSize; c++) {
          const checkI = rootI + r;
          const checkJ = rootJ + c;

          if (checkI >= MAX_ROWS || checkJ >= MAX_COLS) return false;

          const candidate = matrix[checkI][checkJ];
          if (candidate === root) continue; // It's our own multi-cell body chunk

          if (componentsMatch(root, candidate)) {
            targetCluster.add(candidate!);
          } else {
            return false;
          }
        }
      }

      processed.add(root.key);
      targetCluster.forEach(m => {
        processed.add(m.key);
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

    // FOOTPRINT SYNCHRONIZATION FIX: Map EVERY cell covered by the newly sized spells back to the gameBoard
    this.spells.forEach(s => {
      if (!s.isRemove) {
        const idx = s.getCellIndex();
        if (idx) {
          for (let r = 0; r < s.heightCells; r++) {
            for (let c = 0; c < s.widthCells; c++) {
              const cell = gameBoard.getCellAt({ i: idx.i + r, j: idx.j + c });
              if (cell) cell.setSpell(s);
            }
          }
        }
      }
    });
  };

}