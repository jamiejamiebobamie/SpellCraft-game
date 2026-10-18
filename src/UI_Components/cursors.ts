// cursors.ts
// The game's cursor:
// - 'arrow':      the browser's regular arrow
// - 'wand':       the wand image as a CSS cursor (fixed 32px size)
// - 'canvasWand': the wand drawn on the game canvas, so it scales with the game; the CSS wand is
//                 used elsewhere, and until its image loads
export const CURSOR_MODE: 'arrow' | 'wand' | 'canvasWand' = 'arrow' as 'arrow' | 'wand' | 'canvasWand';

/** The game canvas's normal cursor (not over buttons or while placing a spell). */
export const getDefaultCursor = (isCanvasWandReady: boolean): string => {
  if (CURSOR_MODE === 'arrow') return 'default';
  return CURSOR_MODE === 'canvasWand' && isCanvasWandReady ? 'canvasWand' : 'wand';
};

/**
 * CSS declarations for the wand cursor, each overriding the last where the browser supports it.
 * The hotspot (1 2) is the wand's tip, in pixels from the top-left of the 32x32 image; the 64x64
 * image is used on high-DPI screens.
 */
export const WAND_CURSOR_CSS = `
  cursor: url('cursors/wand.png') 1 2, auto;
  cursor: -webkit-image-set(url('cursors/wand.png') 1x, url('cursors/wand@2x.png') 2x) 1 2, auto;
  cursor: image-set(url('cursors/wand.png') 1x, url('cursors/wand@2x.png') 2x) 1 2, auto;
`;

/** Image drawn as the canvas wand (use a larger export here to keep it sharp at big sizes). */
export const CANVAS_WAND_SRC = 'cursors/wand@2x.png';

/** Canvas wand width, as a fraction of the game's width. Tune to match the avatar's wand. */
export const CANVAS_WAND_WIDTH_FRACTION = 0.05;

/** The wand's tip, as a fraction of the image's size (pixel (1, 2) of the 32x32 image). */
export const WAND_HOTSPOT = { x: 1 / 32, y: 2 / 32 };
