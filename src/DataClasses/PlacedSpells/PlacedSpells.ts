// PlacedSpells.ts — PART 1
import { Spell, Phlegm, Ether, Gyre, GyreUp, GyreDown, Quicken } from './Spell';
import { GameBoard } from '../GameBoard/GameBoard';
import { CellIndex, CollisionResult } from '../types';
import { proxy } from 'valtio';

export class PlacedSpells {
  spells: Array<Spell> = proxy([]);
  static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 100; // for micro steps
  static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 1000; // for entire spell movement turn (time it takes for all spells to finish all moves)

  // static readonly SPELL_MOVEMENT_DELAY_MILLI: number = 2000; // for micro steps
  // static readonly SPELL_MOVEMENT_TURN_DELAY_MILLI: number = 3000; // for entire spell movement turn (time it takes for all spells to finish all moves)

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
    const markedForRemoval = this.spells.filter(spell => spell.getIsRemove());
    markedForRemoval.forEach(s => {
      const idx = this.spells.indexOf(s);
      if (idx !== -1) {
        const cellIndex = s.getCellIndex();
        const width = s.widthCells, height = s.heightCells;
        const dir = Math.sign(s.getPropertyValue('speedDirection'));
        if (cellIndex) {
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const cell = gameBoard.getCellAt({ i: cellIndex.i + i, j: cellIndex.j + j * dir });
              if (cell) {
                const spell = cell.getSpell(); // need to clear sized spells cells too
                if (spell && spell.id == s.id) cell.setSpell(null);
              }
            }
          }
        }
        this.spells.splice(idx, 1);
      }
    });
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

      /*
        2x2 Ether colliding with 1x3 GyreUp -> 
          ISSUES:
            - spawns 4 1x1 Ether INSIDE GYRE COLUMN
            - 1 1x1 Ether who was not impacted by GYRE COLUMN moves 3 spaces(???)
            - 1 1x1 Ether who was not impacted by GYRE COLUMN stays in place and is in then destroyed at end of turn...
      */

      const positionCache = this.cachePositions();
      this.handleLookAheadCollisions(positionCache, gameBoard);
      this.clearGridFootprints(gameBoard);

      const anySpellMoved = this.executeSynchronousMicroSteps(gameBoard, forceUpdate, decrementPlayerHealth);
      if (!anySpellMoved) break;

      this.handleMidStepCollisions(positionCache, gameBoard);

      forceUpdate();
      await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));

      await this.resolveGridCollisions(gameBoard, forceUpdate);
      currentMicroStep++;
    }

    this.spells.forEach(s => {
      s.consumedGyres = 0;
      s.consumedPhlegms = 0;
    });

    this.combineSpellsMaximally(gameBoard);
    this.removeConsumed();
    forceUpdate();
    await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_TURN_DELAY_MILLI));
    this.removeInvalidSpells(gameBoard);
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

  private handleLookAheadCollisions = (positionCache: Map<string, CellIndex>, gameBoard: GameBoard): void => {
    const resolvedLookAheads = new Set<string>();

    for (let i = 0; i < this.spells.length; i++) {
      for (let j = i + 1; j < this.spells.length; j++) {
        const spellA = this.spells[i];
        const spellB = this.spells[j];

        // if (spellA.isRemove || spellB.isRemove || spellA.isBeingConsumed || spellB.isBeingConsumed) continue;
        if (spellA.getIsRemove() || spellB.getIsRemove() || spellA.getIsBeingConsumed(spellB) || spellB.getIsBeingConsumed(spellA)) continue;

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
          this.checkBoundingBoxOverlap(futurePosA, wA, hA, posB, wB, hB) &&
          this.checkBoundingBoxOverlap(futurePosB, wB, hB, posA, wA, hA);

        if (willCollide) {
          const pairKey = [spellA.id, spellB.id].sort().join('_');
          if (resolvedLookAheads.has(pairKey)) continue;
          resolvedLookAheads.add(pairKey);

          this.processCollisionPair(spellA, spellB, positionCache, true, gameBoard);
        }
      }
    }
  };

  private clearGridFootprints = (gameBoard: GameBoard): void => {
    this.spells.forEach(s => {
      // if (s.isRemove) return;
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

      // Terminate stepping if BOTH horizontal movement and vertical climbing states are spent
      if (spell.remainingMoves <= 0 && (!spell.consumedGyres || spell.consumedGyres === 0)) continue;

      anySpellMoved = true;
      spell.recordedMovesCount++;

      // Only deduct a horizontal turn if the spell isn't actively climbing/descending a vertical line
      if (!spell.consumedGyres || spell.consumedGyres === 0) {
        spell.remainingMoves--;
      }

      spell.executeSingleMicroStep();
      forceUpdate();

      const nextCellIndex = spell.getCellIndex();
      const headColumn = nextCellIndex.j + (spell.widthCells - 1) * Math.sign(spell.getPropertyValue('speedDirection'));
      if (!nextCellIndex || gameBoard.getIsOffBoardAt({ i: nextCellIndex.i, j: headColumn })) {
        const isLeftExit = headColumn < 0;
        const isRightExit = headColumn >= GameBoard.NUM_COLS;
        if (isLeftExit || isRightExit) {
          const dmg = spell.getPropertyValue('dmgHealth');
          const playerIndex = isLeftExit ? 0 : 1;

          spell.hitDamageAmount = dmg;
          if (isLeftExit) {
            spell.isPlayerHitImpact = true;
          } else {
            spell.isOpponentHitImpact = true;
          }

          decrementPlayerHealth(playerIndex, dmg);
        }
        spell.markSpellForRemoval();
      }
    }
    return anySpellMoved;
  };

  private handleMidStepCollisions = (positionCache: Map<string, CellIndex>, gameBoard: GameBoard): void => {
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

            this.processCollisionPair(spellA, spellB, positionCache, false, gameBoard);
          }
        }
      }
    }
  };

  private processCollisionPair = async (spellA: Spell, spellB: Spell, positionCache: Map<string, CellIndex>, isLookAhead: boolean, gameBoard: GameBoard): Promise<void> => {
    const { winner, loser } = await this.doCollision(spellA, spellB, gameBoard);
    if (winner && loser) {
      if (isLookAhead) {
        loser.remainingMoves = 0;
      } else {
        const startOrigin = winner === spellA ? positionCache.get(spellA.id) : positionCache.get(spellB.id);
        if (startOrigin) loser.setCellIndex({ i: startOrigin.i, j: startOrigin.j });
      }
    }
  };

  private doCollision = async (spellA: Spell, spellB: Spell, gameBoard: GameBoard): Promise<CollisionResult> => {
    const dmgA = spellA.getPropertyValue('dmgHealth');
    const dmgB = spellB.getPropertyValue('dmgHealth');

    let winner = spellA;
    let loser = spellB;

    if (
      // !(spellA instanceof Gyre && spellB instanceof Gyre) &&
      dmgA === dmgB) {
      spellA.markSpellForRemoval();
      spellB.markSpellForRemoval();
      return { winner: null, loser: null };
    }
    else if (dmgB > dmgA) { winner = spellB; loser = spellA; }
    else if (dmgA > dmgB) { winner = spellA; loser = spellB; }

    const isWinnerSized = winner.widthCells > 1 || winner.heightCells > 1;
    const isCollisionWithTerrain = loser instanceof Phlegm || loser instanceof Gyre;

    // removed for 1x1 collisions to register...
    // if (!isWinnerSized && isCollisionWithTerrain) {
    //   continue;
    // }

    winner.resolveSpellCollision(loser);

    let extraMoves = 0;
    if (loser instanceof Phlegm) {
      const phlegmDmg = loser.getPropertyValue('dmgHealth');
      const winnerDmg = winner.getPropertyValue('dmgHealth');
      const absoluteDiff = Math.abs(phlegmDmg) - Math.abs(winnerDmg);
      extraMoves = Math.max(Math.floor(absoluteDiff / 5), 1);
    }

    if (isWinnerSized && isCollisionWithTerrain) {
      const [fragments, remainingMoves] = await this.shatterSpellIntoFragments(winner, loser);
      // await new Promise(r => setTimeout(r, PlacedSpells.SPELL_MOVEMENT_DELAY_MILLI));
      // fragments.forEach(s => s.remainingMoves = remainingMoves + extraMoves);
      // this.combineSpellsMaximally(gameBoard);
    } else if (loser instanceof Gyre) {
      const rowShifts = loser instanceof GyreDown ? loser.cellIndex.i + loser.heightCells : loser.cellIndex.i - 1 - winner.cellIndex.i;
      winner.consumedGyres = rowShifts;
    } else if (loser instanceof Phlegm && extraMoves > 0) {
      winner.remainingMoves += extraMoves;
    }

    return { winner, loser };
  }

  private resolveGridCollisions = async (gameBoard: GameBoard, forceUpdate: Function): Promise<void> => {
    const resolvedPairs = new Set<string>();

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
            this.doCollision(spellA, spellB, gameBoard);
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

    const hitMinRow = hit.getCellIndex().i
    const hitMaxRow = hit.getCellIndex().i + (hit.heightCells - 1)

    const remainingMoves = Math.max(0, parent.widthCells - Math.abs(hitColumn - parent.cellIndex.j) + (parent.consumedQuickens > 0 ? 1 : 0));//Math.max(0, parent.remainingMoves - parent.widthCells);

    // if (!(parent instanceof Gyre && hit instanceof Gyre)) {
    if (parent instanceof Gyre) {
      // hit is Phlegm, get lowest point on Phlegm
      if (parent instanceof GyreUp) {
        // lowest point is root on GyreUp
        const gyreRoot = parent.cellIndex.i + parent.heightCells - 1;
        const lowestPoint = hit.cellIndex.i + hit.heightCells - 1

        if (gyreRoot == lowestPoint) {
          // do not split, just flip direction of Gyre 
          // parent.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          hit.conferModifierTo(parent);
          return [[], remainingMoves]
        } else {
          // split Gyre in two, lowestPoint up is one Gyre w/ flipped direction

          // FLIPPED DIRECTION
          let frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = parent.heightCells - (gyreRoot - lowestPoint);
          let i = lowestPoint;
          let j = hitColumn
          frag.setCellIndex({ i, j });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          let newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

          // NON-FLIPPED DIRECTION
          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = gyreRoot - lowestPoint;
          i = gyreRoot;
          j = hitColumn
          frag.setCellIndex({ i, j });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);
        }
      }
      else if (parent instanceof GyreDown) {
        // highest point is root on GyreDown
        const gyreRoot = parent.cellIndex.i;
        const lowestPoint = hit.cellIndex.i;
        if (gyreRoot == lowestPoint) {
          // do not split, just flip direction of Gyre 
          hit.conferModifierTo(parent);
          return [[], remainingMoves]
        } else {
          // split Gyre in two, lowestPoint down is one Gyre w/ flipped direction

          // FLIPPED DIRECTION
          let frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = parent.heightCells - (lowestPoint - gyreRoot);
          let i = lowestPoint;
          let j = hitColumn
          frag.setCellIndex({ i, j });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          frag.updatePropertyValue('speedDirection', parent.getPropertyValue('speedDirection') * -1);
          let newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);

          // NON-FLIPPED DIRECTION
          frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = lowestPoint - gyreRoot;
          i = gyreRoot;
          j = hitColumn
          frag.setCellIndex({ i, j });
          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;
          newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);
        }
      }
    } else {
      for (let r = 0; r < parent.heightCells; r++) {
        for (let c = 0; c < parent.widthCells; c++) {
          const i = parent.cellIndex.i + r;
          const j = parent.cellIndex.j + c * dir;

          const frag = new (parent.constructor as any)(parent.caster);
          frag.widthCells = 1;
          frag.heightCells = 1;
          frag.setCellIndex({ i, j });

          frag.consumedEthers = parent.consumedEthers;
          frag.consumedQuickens = parent.consumedQuickens;
          frag.recordedMovesCount = parent.recordedMovesCount;

          const isOverlappingColumn = j === hitColumn;
          const isOverlappingRow = i >= hitMinRow && i <= hitMaxRow

          if (isOverlappingColumn && isOverlappingRow) {
            hit.consumingSpellIds.add(frag);
            frag.resolveSpellCollision(hit);
          }

          const newFragment = proxy(frag);
          this.spells.push(newFragment);
          fragments.push(newFragment);
        }
      }
      // }

    }

    parent.markSpellForRemoval();



    return [fragments, remainingMoves];
  };

  public combineSpellsMaximally = (gameBoard: GameBoard): void => {
    const MAX_COLS = GameBoard.NUM_COLS;
    const MAX_ROWS = GameBoard.NUM_ROWS;

    // 1. Initialize a full board lookup matrix
    const matrix: Array<Array<Spell | null>> = Array(MAX_ROWS).fill(null).map(() => Array(MAX_COLS).fill(null));

    const consumerIds = this.spells.reduce((acc, item) => [...acc, ...item.consumingSpellIds], new Array<string>())

    // POPULATION FIX: Map EVERY cell covered by a sized spell's footprint into the matrix
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

          // Skip the entire width of this piece to prevent bugged evaluations on sub-cells
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

          // Skip the entire height of this stack to prevent bugged vertical evaluations
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
          if (candidate === root) continue; // It's our own multi-cell body chunk

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

    // FOOTPRINT SYNCHRONIZATION FIX: Map EVERY cell covered by the newly sized spells back to the gameBoard
    this.spells.forEach(s => {
      if (!s.getIsRemove()) {
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