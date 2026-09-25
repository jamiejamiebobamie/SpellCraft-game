import { Phlegm, Quicken, Ether, GyreUp, GyreDown } from './PlacedSpells/Spell';
import { Player } from './Player/Player';
import { UniqueId } from './UniqeId';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};

export type SpellPropertyName = 'upDown' | 'speedDirection' | 'dmgHealth' | 'rowShift' | 'updateOrder' | 'gyreLives' | 'empoweredPng' | 'empoweredSpeedDirection' | 'empoweredDmgHealth' | 'consumedEthers' | 'consumedPhlegms' | 'consumedQuickens' | 'widthCells' | 'heightCells';

export type Direction = 1 | -1 | 0; // 0 = not valid value

export type NpcDifficulty = 'Normal' | 'Hard' | 'Brutal';

// export type EmpoweredPng = 'Singular' | 'Beginning' | 'Middle' | 'End';
// export type EmpoweredPng = 0 | 1 | 2 | 3;

export type SpellConstructor = new (caster: Player) => Quicken | Ether | Phlegm | GyreUp | GyreDown;

export type InferenceString = 'line' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square' | 'squiggle' | 'SKIP'; // 'SKIP' for NPC AI

export type GameStateProgressionPath = 'HappyPath' | 'UnHappyPath' | 'AltPath' | 'Esc' | null;

export type BadgeValues = {
  dmgHealth: number;
  speedDirection: number;
  gyreLives: number;
  updateOrder: number;
}

export interface Point {
  x: number;
  y: number;
}

export type DivRefDimensions = {
  left: number; top: number; width: number; height: number;
}

export class NPCMoveData extends UniqueId {

  inferenceString!: InferenceString;
  // normalized vector that is multiplied by the GameWrapper's width and height
  translationNorm!: Point;
  scale!: Point;
  rotation!: number; // degrees
  storedSpell?: Function;
  speed?: number; // 1.2/scale.x

  constructor(inferenceString: InferenceString, translationNorm: Point, scale: Point, rotation: number) {
    super();
    this.inferenceString = inferenceString;
    this.translationNorm = translationNorm;
    this.scale = scale;
    this.rotation = rotation;
  }

};

export interface GameParticle {
  x: number;              // Current X position on the canvas
  y: number;              // Current Y position on the canvas
  vx: number;             // Horizontal velocity (pixels per second)
  vy: number;             // Vertical velocity (pixels per second)
  alpha: number;          // Transparency layer factor (1.0 down to 0.0)
  size: number;           // Radius/diameter of circles, or width of wind lines
  color: string;          // Hex, rgb, or rgba string color format
  shadowColor?: string;   // Optional drop shadow color styling for magic glows
  rotation?: number;      // Optional current angle orientation (in radians)
  vRotation?: number;     // Optional rotational speed (radians per second)
  life: number;           // Remaining lifetime index tracking (starts at 1.0)
  decay: number;          // How quickly life ticks down to 0 per second
  type?: 'smoke' | 'droplet' | 'windLine' | 'windCurl' | 'healCross' | 'electricShock' | 'windTrail'; // Optional tag to apply unique custom behaviors
}

export interface SpellAnimTracker {
  spawnProgress: number;
  deathProgress: number;
  hasSpawnedParticles: boolean;
  particles: GameParticle[]; // Handles ANY style of destruction particles
}