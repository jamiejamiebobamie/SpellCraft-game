// logoConfig.ts
// Everything adjustable about the loading screen's logo (LogoComponent). Positions are in "logo
// units": 100 units = the logo's width (x to the right, y down), laid out from the mock-up
// (public/mockup/Logo-mockup.png, 2000 px wide = 100 units).

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
};

export const LOGO_CONFIG = {
  /** The logo's height, in logo units (its width is 100). */
  height: 66,

  /** The clock behind everything. */
  clock: {
    variant: 'face' as 'body' | 'face', // the whole clock, or just its face (e.g. oversized)
    transform: { x: 50, y: 29, scale: 3.6, rotation: 0 } as GroupTransform, // anchored at the face's center (the face is 9 units wide at scale 1)
    brightness: 0.4, // dimmer than the duel and the title, so they read first
    startTime: { hours: 12, minutes: 0, seconds: 0 }, // the hands then tick forward, one tick a second
  },

  /** The symbols and spells (all five move together). Anchored at the logo's center. */
  spells: {
    transform: { x: 0, y: 0, scale: 1, rotation: 0 } as GroupTransform,
    symbolOpacity: 0.85, // dimmer than the duel and the title
    symbolLineWidth: 0.03, // the symbols' stroke, as a fraction of their box's smaller side (was 0.05)
    spellOpacity: 0.85,
    // Where each symbol turns into its spell, as fractions of the way from the outside (0) to the
    // inside (1): the symbol fades out, then the spell fades in (overlapping if the ranges do)
    fade: {
      symbolOut: { start: 0.3, end: 0.5 },
      spellIn: { start: 0.5, end: 0.7 },
      radialCenter: null as { x: number; y: number } | null, // null: below the duelists
    },
    pixieDustPerSecond: 14, // per symbol
    list: [
      { spellName: 'Quicken', symbol: 'line', x: 30.5, y: 32.5, rotation: 33, w: 22, h: 6, cells: { w: 3, h: 1 }, cellSize: 7.2, direction: 1, fade: 'towardWands' },
      { spellName: 'Phlegm', symbol: 'star', x: 49.8, y: 25, rotation: 0, w: 13.5, h: 13.5, cells: { w: 1, h: 1 }, cellSize: 11, direction: 1, fade: 'vertical', spellOffset: { x: 0, y: 3 } },
      { spellName: 'Ether', symbol: 'circle', x: 70.3, y: 30.3, rotation: 0, w: 14.5, h: 14.5, cells: { w: 1, h: 1 }, cellSize: 12, direction: -1, fade: 'towardWands', flipX: true },
      { spellName: 'GyreDown', symbol: 'triangle', x: 41.5, y: 42, rotation: 0, w: 15, h: 24, cells: { w: 1, h: 3 }, cellSize: 8, direction: 1, fade: 'vertical' },
      { spellName: 'GyreUp', symbol: 'diamond', x: 58.5, y: 42, rotation: 0, w: 15, h: 24, cells: { w: 1, h: 3 }, cellSize: 8, direction: -1, fade: 'vertical' },
    ] as Array<LogoSpell>,
  },

  /** The two duelists. Anchored on the line between them, level with the tops of their frames. */
  avatars: {
    transform: { x: 50, y: 30.5, scale: 2.08, rotation: 0 } as GroupTransform,
    // In the avatars' own units (the game's avatar parts, before scaling):
    spacing: 8, // from the center line to each avatar's middle
    wrist: { x: -2.9, y: 6.9 }, // the player's wand hand at rest, from the center line (the opponent's is mirrored)
    wandTilt: 25, // degrees from upright, leaning in toward the other wand
    // Below the waist, the avatars fade out behind the title (fractions of the logo's height)
    fadeOut: { start: 0.72, end: 0.9 },
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
    x: 50, y: 56, // its center
    size: 14, // font size, in logo units
    color: '#f7d774',
    outline: '#5a3d0c',
    glow: 'rgba(255, 220, 120, 0.55)',
  },
};
