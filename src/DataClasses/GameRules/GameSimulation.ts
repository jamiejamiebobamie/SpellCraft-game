// GameSimulation.ts
// A headless, deterministic game of QuickCast: casting, focus, blood magic, health, the clock, and
// spell movement (via SpellMovementEngine), with no UI, timers, sound, or valtio. Uses the same
// rules as the game (gameRules.ts), for tests and for training an NPC.
//
// A turn: both players cast (any number of spells, in any order), then endTurn() moves the spells,
// applies damage, regenerates focus, advances the clock, and checks for game over.
import { CellIndex, GameOver, GameOverStatus } from '../types';
import { Spell, Phlegm, Ether, GyreUp, GyreDown, Quicken } from '../PlacedSpells/Spell';
import { Player } from '../Player/Player';
import { SpellMovementEngine, SpellTurnLog, combineSpellsMaximally } from '../PlacedSpells/SpellMovementEngine';
import { SpellClass, createPlacedSpells, getDeathGameOver, getIsTimeUp, getPlacementFocusCost, planSpellPlacement } from './gameRules';

export type SpellName = 'Phlegm' | 'Ether' | 'Quicken' | 'GyreUp' | 'GyreDown';

export const SPELL_CLASSES: Record<SpellName, SpellClass> = {
  Phlegm, Ether, Quicken, GyreUp, GyreDown,
};

/** Index of each side in `players` (and in spell-movement health events). */
export const PLAYER_INDEX = 0; // left side, moves right
export const NPC_INDEX = 1; // right side, moves left

export type CastResult = {
  placed: Array<Spell>;
  focusCost: number;
  bloodMagicCost: number; // health paid because focus ran short
};

export type SimulationOptions = {
  /** Random source for the game's chance elements (being caught near sunrise). Returns [0, 1). */
  random?: () => number;
};

export class GameSimulation {
  readonly players: [Player, Player];
  spells: Array<Spell> = [];
  turnsElapsed: number = 0;
  gameOver: GameOver | null = null;
  private readonly random: () => number;

  constructor({ random = Math.random }: SimulationOptions = {}) {
    this.players = [new Player(1, ''), new Player(-1, '')];
    this.random = random;
  }

  /** Whether a live spell covers `cell`. */
  getIsOccupied = (cell: CellIndex): boolean =>
    this.spells.some(s => !s.getIsRemove() &&
      cell.i >= s.cellIndex.i && cell.i < s.cellIndex.i + s.heightCells &&
      cell.j >= s.cellIndex.j && cell.j < s.cellIndex.j + s.widthCells);

  /**
   * Casts a spell for `playerIndex` as if drawn over `touchedCells` (cells outside the caster's
   * zone are ignored). Pays its focus cost, with blood magic covering any shortfall.
   */
  cast = (playerIndex: number, spellName: SpellName, touchedCells: Array<CellIndex>): CastResult => {
    const caster = this.players[playerIndex];
    const none: CastResult = { placed: [], focusCost: 0, bloodMagicCost: 0 };
    if (this.gameOver !== null || caster.getIsDead()) return none;

    const SpellType = SPELL_CLASSES[spellName];
    const rects = planSpellPlacement(SpellType, touchedCells, caster.getDirection(), this.getIsOccupied, this.spells);
    if (!rects.length) return none;

    const placed = createPlacedSpells(SpellType, rects, caster);
    this.spells.push(...placed);
    const focusCost = getPlacementFocusCost(SpellType, rects);
    const bloodMagicCost = caster.incurPlayerCostForSpell(focusCost);

    combineSpellsMaximally(this.spells);
    this.spells = this.spells.filter(s => !s.getIsRemove());
    // A spell cast onto an enemy spell collides at once
    const { frames } = new SpellMovementEngine(this.spells).resolveCastCollisions();
    if (frames.length) this.spells = frames[frames.length - 1].spells;
    this.gameOver = getDeathGameOver(this.players[PLAYER_INDEX], this.players[NPC_INDEX]);
    return { placed, focusCost, bloodMagicCost };
  };

  /**
   * Ends the turn: advances the clock, moves the spells, applies damage and healing, regenerates
   * focus, and checks for game over. Returns the spell-movement log (for replay or inspection),
   * or null if the game is already over.
   */
  endTurn = (): SpellTurnLog | null => {
    if (this.gameOver !== null) return null;

    this.turnsElapsed++;
    const log = new SpellMovementEngine(this.spells).simulateTurn();
    log.frames.forEach(frame => frame.healthEvents.forEach(({ playerIndex, dmg }) => {
      this.players[playerIndex].decrementHealth(dmg);
    }));
    this.spells = log.frames[log.frames.length - 1].spells;

    this.players.forEach(p => p.decrementFocus(p.getFocusRegenAmt()));

    this.gameOver = getDeathGameOver(this.players[PLAYER_INDEX], this.players[NPC_INDEX]) ??
      (getIsTimeUp(this.turnsElapsed, this.random) ? GameOverStatus.TimesUp : null);
    return log;
  };
}
