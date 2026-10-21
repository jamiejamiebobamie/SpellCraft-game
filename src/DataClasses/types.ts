import { Phlegm, Quicken, Ether, GyreUp, GyreDown } from './PlacedSpells/Spell';
import { Player } from './Player/Player';
import { UniqueId } from './UniqueId/UniqeId';
import { Spell } from './PlacedSpells/Spell';

// types
export type CellIndex = {
  i: number; // Row index
  j: number; // Column index
};

export type SpellPropertyName = 'speedDirection' | 'dmgHealth' | 'rowShift' | 'consumedEthers' | 'consumedPhlegms' | 'consumedQuickens' | 'widthCells' | 'heightCells';

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
  type?: 'smoke' | 'droplet' | 'windLine' | 'windCurl' | 'healCross' | 'electricShock' | 'windTrail' | 'etherFlame' | 'lightningArc' | 'fireballOrb' | 'bloodDroplets'; // Optional tag to apply unique custom behaviors
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
  // Where it's drawn (easing toward its place on the board), once placed
  visualX: number;
  visualY: number;
  initialized: boolean;
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
  clockGeometricSparkles: { x: number; y: number; size: number; alpha: number; rate: number; phase: number; maxAlpha: number; color: string; isStar?: boolean }[] = [];
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

export type SoundEffectName =
  'clock-chime'
  | 'spell-GyreUp-1'
  | 'spell-GyreDown-1'
  | 'spell-Ether-1' | 'spell-Ether-4' | 'spell-Ether-9'
  | 'spell-Phlegm-1'
  | 'spell-Quicken-1'
  | 'wizard-Grunt-0'
  | 'wizard-Grunt-1'
  | 'wizard-Grunt-2'
  | 'wizard-Grunt-3'
  | 'wizard-Grunt-4'
  | 'wizard-Grunt-5'
  | 'wizard-Death-Cry'
  | 'wizard-Heal'
  ;

export const SFX_REGISTRY: Record<SoundEffectName, string> = {
  'clock-chime': './Audio/Effects/Clock/805325__designerschoice__clockchim-samsung-galaxy-smartphone-cu_grandfather-clock-third-quarter-chimes_nicholas-judy_tdc.m4a',
  'spell-GyreUp-1': './Audio/Effects/Spells/Gyre/711441__f3ather__a-gust-of-wind-blowing-some-leaves.wav',
  'spell-GyreDown-1': './Audio/Effects/Spells/Gyre/711441__f3ather__a-gust-of-wind-blowing-some-leaves.wav',
  'spell-Ether-1': './Audio/Effects/Spells/Ether/77691__joelaudio__sfx_magic_fireball_001.m4a',
  'spell-Ether-4': './Audio/Effects/Spells/Ether/671309__gregorquendel__fire-swooshes-wind-05.wav',
  'spell-Ether-9': './Audio/Effects/Spells/Ether/671312__gregorquendel__fire-impacts-complex-20.wav',
  'spell-Phlegm-1': './Audio/Effects/Spells/Phlegm/485796__univ_lyon3__reynas_fanny_2019_2020_water.wav',
  'spell-Quicken-1': './Audio/Effects/Spells/Quicken/19487__halleck__jacobsladdersingle2.flac',
  'wizard-Grunt-0': './Audio/Effects/Wizard-Grunts/727827__abraksil__male-grunts-0.m4a',
  'wizard-Grunt-1': './Audio/Effects/Wizard-Grunts/727827__abraksil__male-grunts-1.m4a',
  'wizard-Grunt-2': './Audio/Effects/Wizard-Grunts/727827__abraksil__male-grunts-2.m4a',
  'wizard-Grunt-3': './Audio/Effects/Wizard-Grunts/727827__abraksil__male-grunts-3.m4a',
  'wizard-Grunt-4': './Audio/Effects/Wizard-Grunts/727827__abraksil__male-grunts-4.m4a',
  'wizard-Grunt-5': './Audio/Effects/Wizard-Grunts/338145__artordie__scream-ugh.wav',
  'wizard-Death-Cry': './Audio/Effects/Wizard-Death-Cry/695386__fmaudio__male-death-cry-3.wav',
  'wizard-Heal': './Audio/Effects/Wizard-Heal/853303__tommasomotteran__magic-healing-spell-sfx-fantasy-rpg-restore-effect.wav'
};

export type AudioType = 'fx' | 'music';


export const GameOverStatus = {
  BothDead: 0,
  PlayerWon: 1,
  NpcWon: 2,
  TimesUp: 3,
} as const;

// Create a type out of the object if needed
export type GameOver = typeof GameOverStatus[keyof typeof GameOverStatus]; // "UP" | "DOWN"