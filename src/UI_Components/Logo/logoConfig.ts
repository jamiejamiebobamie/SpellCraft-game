// logoConfig.ts
// Everything adjustable about the loading screen's logo (LogoComponent). Positions are in "logo
// units": 100 units = the logo's width (x to the right, y down), laid out from the mock-up
// (public/mockup/Logo-mockup.png, 2000 px wide = 100 units).

// In development, a change here reloads the whole page: the logo's animation loop keeps the config it
// started with, so a partial (hot) update would move some parts and not others
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

/** Move, scale and rotate a whole group (rotation in degrees, about the group's anchor). */
export type GroupTransform = { x: number; y: number; scale: number; rotation: number };

/** How a symbol fades into its spell (the symbol on the outside, the spell on the inside). */
export type FadeMode =
  | 'towardWands' // along the line from the element to where the wands cross
  | 'vertical' // the symbol at the top, the spell at the bottom
  | 'radial'; // outward from fade.radialCenter (the general rule; the spells below override it)

export type LogoSpell = {
  spellName: 'Quicken' | 'Ether' | 'Phlegm' | 'GyreUp' | 'GyreDown';
  symbol: 'line' | 'circle' | 'star' | 'diamond' | 'triangle'; // the game's symbol for the spell
  x: number; y: number; // center
  rotation: number; // degrees
  w: number; h: number; // the box the symbol is drawn in, and the spell is centered in
  cells: { w: number; h: number }; // the spell's size in cells (e.g. a 1x3 Quicken)
  cellSize: number; // in logo units
  direction: 1 | -1; // which way the spell travels (for the Gyres)
  fade: FadeMode;
  flipX?: boolean; // mirror the spell left to right (e.g. so the fireball faces inward)
  spellOffset?: { x: number; y: number }; // move the spell from the box's center (the symbol stays)
  // Optional, per spell (otherwise the spells group's settings below):
  symbolOpacity?: number; // this symbol's maximum opacity
  spellOpacity?: number; // this spell's maximum opacity
  spellBoost?: number; // draws a faint spell this many times over (e.g. 2), so it shows up more
  fadeSpell?: boolean; // false: the spell is shown in full (only the symbol fades), e.g. so a long tail isn't cut off
  hidden?: boolean; // true: hides this spell and its symbol (for testing)
  fadeRanges?: { symbolOut: FadeRange; spellIn: FadeRange }; // this spell's own fade.symbolOut / fade.spellIn
};

/**
 * A glow around an element's outline (CSS drop-shadows, following its shape): a thin outline first
 * (rgb color at its opacity, size in logo units), then `layers` more, each `growth` times wider and
 * `falloff` times as opaque as the one before, fading outward. null: none.
 */
export type Aura = { rgb: string; opacity: number; size: number; layers: number; growth: number; falloff: number } | null;

/** Fractions of the way from the outside (0) to the inside (1). */
export type FadeRange = { start: number; end: number };

export const LOGO_CONFIG = {
  /** The logo's height, in logo units (its width is 100). */
  height: 72,

  /** How far the spell and spark canvases reach past the logo's box (logo units), so nothing near its edges is cut off. */
  canvasMargin: { x: 30, y: 12 },

  /**
   * The scene's own clock and its halo on the landing page, before Play (once you press Play, the
   * scene's lighting takes over, fading from these): their brightness, and whether its case shows.
   */
  landingClock: {
    bodyBrightness: 0.4, // the clock's case
    faceBrightness: .7, // its face
    haloBrightness: 1, // its halo
    showBody: true, // false: just the face and halo (no case, chimes or back)
  },

  /** The logo's own clock (in front of the scene's), behind everything else in the logo. */
  clock: {
    // 'scene': just the face, exactly over the background scene's clock (ignores transform); 'body': the
    // whole clock; 'face': just the face (e.g. oversized); 'none': no clock (the scene has its own)
    variant: 'none' as 'scene' | 'body' | 'face' | 'none',
    sceneWithBody: true, // 'scene' only: also draw the clock's body over the scene's (which is dark until Play), so it shows on the loading screen
    transform: { x: 50, y: 29, scale: 2.6, rotation: 0 } as GroupTransform, // anchored at the face's center (the face is 9 units wide at scale 1)
    brightness: 0.7, // dimmer than the duel and the title, so they read first
    startTime: { hours: 12, minutes: 0, seconds: 0 }, // the hands then tick forward, one tick a second
  },

  /** The symbols and spells (all five move together). Anchored at the logo's center. */
  spells: {
    transform: { x: 0, y: 5, scale: .75, rotation: 0 } as GroupTransform, // (y was 0: moved down 5 with the avatars and title)
    // transform.scale and spread move the spells' positions (toward or away from the logo's center);
    // their sizes stay the same. spread: e.g. x 1.2 moves them outward sideways, leaving the middle
    // clearer, without moving them up or down
    spread: { x: 2, y: 1 },
    itemScale: 1, // resizes every spell and symbol (1 = as set in the list below)
    // Which is in front of which, front first (anything left out goes behind)
    layerOrder: [
      ['Ether', 'spell'], ['Ether', 'symbol'],
      ['Quicken', 'spell'], ['Quicken', 'symbol'],
      ['GyreDown', 'spell'], ['GyreDown', 'symbol'],
      ['GyreUp', 'spell'], ['GyreUp', 'symbol'],
      ['Phlegm', 'symbol'], ['Phlegm', 'spell'],
    ] as Array<[LogoSpell['spellName'], 'spell' | 'symbol']>,
    symbolOpacity: 0.5, // the symbols' maximum opacity: dimmer than the duel and the title (was 0.85)
    symbolGlow: 0.05, // the symbols' glow, as a fraction of their box's smaller side (was 0.08)
    symbolLineWidth: 0.03, // the symbols' stroke, as a fraction of their box's smaller side (was 0.05)
    spellOpacity: 0.75,
    // Where each symbol turns into its spell, as fractions of the way from the outside (0) to the
    // inside (1): the symbol fades out, then the spell fades in (overlapping if the ranges do)
    fade: {
      symbolOut: { start: 0.1, end: 0.9 } as FadeRange,
      spellIn: { start: 0.0, end: 0.3 } as FadeRange,
      radialCenter: null as { x: number; y: number } | null, // null: below the duelists
    },
    // Pixie dust drifting down from the symbols (spawned only where a symbol is visible, then falling
    // freely). Speeds and sizes in logo units
    pixieDustPerSecond: 14, // per symbol
    show: { symbols: true, spells: true }, // turn all the symbols, or all the spells, off (for testing)
    list: [
      { spellName: 'Quicken', symbol: 'line', x: 27, y: 5.25, rotation: 15, w: 25, h: 15, cells: { w: 3, h: 1 }, cellSize: 14, direction: 1, fade: 'towardWands', spellOffset: { x: -1.13, y: 1.93 }, fadeRanges: { symbolOut: { start: 0.5, end: .99 }, spellIn: { start: 0.0, end: 0.1 } }, fadeSpell: false }, // mirrors the Ether (its offset: the Ether's, mirrored, in the line's 33-degree frame)
      { spellName: 'Phlegm', symbol: 'star', x: 50, y: 47, rotation: 0, w: 30, h: 30, cells: { w: 3, h: 3 }, cellSize: 13, direction: 1, fade: 'towardWands', spellOffset: { x: 0, y: -5 }, fadeRanges: { symbolOut: { start: 0.9, end: .99 }, spellIn: { start: 0.2, end: 0.5 } }, symbolOpacity: 0.5 },
      { spellName: 'Ether', symbol: 'circle', x: 70, y: 10.25, rotation: -10, w: 18, h: 18, cells: { w: 3, h: 3 }, cellSize: 11, direction: -1, fade: 'towardWands', flipX: true, spellOffset: { x: 3, y: 1 }, fadeRanges: { symbolOut: { start: 0.7, end: 0.99 }, spellIn: { start: 0.0, end: 0.1 } }, fadeSpell: false },
      { spellName: 'GyreDown', symbol: 'triangle', x: 16, y: 28, rotation: 0, w: 15, h: 33, cells: { w: 1, h: 3 }, cellSize: 13, direction: 1, fade: 'vertical', spellOffset: { x: 0, y: 1 }, symbolOpacity: 0.5, spellOpacity: 1, spellBoost: 2, fadeRanges: { symbolOut: { start: .8, end: .99 }, spellIn: { start: 0.0, end: 0.1 } }  },
      { spellName: 'GyreUp', symbol: 'diamond', x: 84, y: 25, rotation: 0, w: 15, h: 33, cells: { w: 1, h: 3 }, cellSize: 13, direction: -1, fade: 'vertical', spellOffset: { x: 0, y: 3 }, symbolOpacity: 0.5, spellOpacity: 1, spellBoost: 2, fadeRanges: { symbolOut: { start: 0.1, end: 0.9 }, spellIn: { start: 0.0, end: 0.1 } }  },
    ] as Array<LogoSpell>,
  },

  /** The two duelists. Anchored on the line between them, level with the tops of their frames. */
  avatars: {
    transform: { x: 50, y: 23, scale: 2.08, rotation: 0 } as GroupTransform, // (was 18: moved down 5 with the title and spells)
    // In the avatars' own units (the game's avatar parts, before scaling):
    spacing: 8, // from the center line to each avatar's middle
    wrist: { x: -2.9, y: 6.9 }, // the player's wand hand at rest, from the center line (the opponent's is mirrored)
    wandTilt: 25, // degrees from upright, leaning in toward the other wand
    // Below the waist, the avatars fade out behind the title (fractions of the logo's height)
    fadeOut: { start: 0.73, end: 0.77 }, // (was 0.595 to 0.655: down 5 units, with the avatars)
    aura: { rgb: '255, 244, 214', opacity: 0.55, size: 0.2, layers: 4, growth: 2, falloff: 0.5 } as Aura, // a cream outline, glowing outward // (was 0.72 to 0.9 at height 66) mostly gone above the title, so the two read separately
  },

  /** The push and shove. */
  struggle: {
    seesawSeconds: 6, // one full back-and-forth (about 3 s each way), slightly uneven
    reach: 0.9, // how far the crossed wands travel each way (avatar units)
    lean: 0.6, // how much of that travel comes from the duelists leaning (the rest is the arms)
    tremble: 0.05, // the constant strain at the crossing (avatar units)
    surgeEverySeconds: 11, // now and then, a sudden shove (alternating sides)
    surgeReach: 0.5,
    freeArmSwing: 1.5, // the free arm swings opposite the lean, this many times as much
    headTilt: 0.5, // the head tilts with the lean, this much of it
    sparksPerSecond: 10, // at the crossing (more during a surge)
  },

  /** "SpellCraft", in front of everything. */
  title: {
    text: 'SpellCraft',
    x: 50, y: 58.5, // its center (was 53.5: moved down 5 with the avatars and spells)
    size: 27, // font size, in logo units
    color: '#f7d774', // used if gradient is null
    // A still sheen over the letters, in shades of the title's color: darker at the edges, lighter
    // inside, along `angle` (CSS degrees: 180 = top to bottom; 135 = tilted -45, 120 = tilted -60).
    // endShade (0 to 1) darkens the word's far left and right ends. null: plain color
    gradient: {
      angle: 135,
      brightness: 0.88, // scales every color below by the same amount (1 = as written), keeping them relative to each other
      // Shades of the title's own color (#f7d774): a little darker at the edges, a little lighter inside
      stops: ['#d6b157 0%', '#f7d774 24%', '#fdeab0 47%', '#f7d774 68%', '#d2ab50 100%'],
      endShade: 0.15,
    } as { angle: number; brightness: number; stops: Array<string>; endShade: number } | null,
    outline: '#5a3d0c',
    glow: 'rgba(255, 220, 120, 0.55)',
    aura: { rgb: '255, 238, 190', opacity: 0.0, size: 0.25, layers: 3, growth: 2.2, falloff: 0.5 } as Aura, // a pale outline, glowing outward
  },
};
