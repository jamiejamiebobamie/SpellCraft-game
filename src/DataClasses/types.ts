import { Phlegm, Quicken, Ether, GyreUp, GyreDown } from './PlacedSpells/Spell';
import { Player } from './Player/Player';
import { UniqueId } from './UniqeId';
import { Spell } from './PlacedSpells/Spell';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};

export type SpellPropertyName = /*'upDown' | */ 'speedDirection' | 'dmgHealth' | 'rowShift' /* |/* 'updateOrder' |*/ /* 'gyreLives' | 'empoweredPng'*/ /*| 'empoweredSpeedDirection' | 'empoweredDmgHealth' */ | 'consumedEthers' | 'consumedPhlegms' | 'consumedQuickens' | 'widthCells' | 'heightCells';

export type Direction = 1 | -1 | 0; // 0 = not valid value

export type NpcDifficulty = 'Normal' | 'Hard' | 'Brutal';

export type SpellInstance = Quicken | Ether | Phlegm | GyreUp | GyreDown;

// This defines what the Class itself looks like, including its static properties
export interface SpellClassBlueprint {
  readonly spellName: string;
  new(caster: Player): SpellInstance;
}

// Update this to use your new blueprint type wherever you store your list of spells
export type SpellConstructor = SpellClassBlueprint;

export type InferenceString = 'line' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square' | 'squiggle' | 'SKIP'; // 'SKIP' for NPC AI

export type GameStateProgressionPath = 'HappyPath' | 'UnHappyPath' | 'AltPath' | 'Esc' | null;

export type BadgeValues = {
  dmgHealth: number;
  speedDirection: number;
  // gyreLives: number;
  // updateOrder: number;
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
  vx?: number;             // Horizontal velocity (pixels per second)
  vy?: number;             // Vertical velocity (pixels per second)
  alpha: number;          // Transparency layer factor (1.0 down to 0.0)
  size: number;           // Radius/diameter of circles, or width of wind lines
  color: string;          // Hex, rgb, or rgba string color format
  shadowColor?: string;   // Optional drop shadow color styling for magic glows
  rotation?: number;      // Optional current angle orientation (in radians)
  vRotation?: number;     // Optional rotational speed (radians per second)
  life: number;           // Remaining lifetime index tracking (starts at 1.0)
  decay: number;          // How quickly life ticks down to 0 per second
  type?: 'smoke' | 'droplet' | 'windLine' | 'windCurl' | 'healCross' | 'electricShock' | 'windTrail' | 'etherFlame' | 'lightningArc' | 'fireballOrb'; // Optional tag to apply unique custom behaviors
  radius?: number;        // Size of Fireball (for Ether)
  initialX?: number;              // Current X position on the canvas
  initialY?: number;              // Current Y position on the canvas

  // --- ADDED EXTRA TARGET VECTORS FOR LIGHTNING AND GEOMETRY SNAP PATHS ---
  targetX?: number;       // Terminal X target coordinate destination point
  targetY?: number;       // Terminal Y target coordinate destination point
}

export interface SpellAnimTracker {
  spawnProgress: number;
  deathProgress: number;
  hasSpawnedParticles: boolean;
  particles: GameParticle[]; // Handles ANY style of destruction particles
}

export type CollisionResult = {
  winner: Spell | null;
  loser: Spell | null;
}

export interface PlacedSpellsProps {
  gridOverlayRef: React.RefObject<HTMLDivElement | null>;
}

export interface DustParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  isStar: boolean;
  text?: string;
  life?: number;
  type?: string;
}

export interface BookSparkleParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
  decay: number;
  color: string;
}

export class SymbolDrawingState {
  progress: number = 0;
  particles: DustParticle[] = [];
  loopTimeout: any = null;
}

export class CanvasScrollUI {
  trayProgress: number = 0;
  hoveredSpellName: string | null = null;
  currentMousePos: { x: number; y: number } = { x: -1000, y: -1000 };
  symbolStates: Map<string, SymbolDrawingState> = new Map();
  bookSparkles: BookSparkleParticle[] = [];

  // Loop timer variables for sizing sequence animation
  sizeCycleTime: number = 0;
  currentSizeIdx: number = 0; // 0=small, 1=medium, 2=large

  // Local storage array tracking blinking pixie dust highlights
  floatingTextSparkles: { x: number; y: number; size: number; alpha: number; maxAlpha: number; rate: number; color: string }[] = [];
  clockGeometricSparkles: { x: number; y: number; size: number; alpha: number; rate: number; phase: number; maxAlpha: number; color: string }[] = [];
  config = {
    startXOffset: 0.1,
    startYOffset: 0.04,
    maxScrollWidth: 0.35,
    scrollTrayHeight: 0.085,
    paddingX: 0.03,
    zigZagOffset: 7,
    symbolDrawSpeed: 0.55
  };
  getSymbolState(name: string): SymbolDrawingState {
    if (!this.symbolStates.has(name)) {
      this.symbolStates.set(name, new SymbolDrawingState());
    }
    return this.symbolStates.get(name)!;
  }

  cleanup() {
    this.symbolStates.forEach(s => {
      if (s.loopTimeout) {
        clearTimeout(s.loopTimeout);
        s.loopTimeout = null;
      }
    });
    this.bookSparkles = [];
    this.sizeCycleTime = 0;
    this.currentSizeIdx = 0;
    this.floatingTextSparkles = [];
    this.clockGeometricSparkles = [];
  }
}