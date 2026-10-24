// canvasResolution.ts
// How sharp the canvases are drawn: at the screen's pixel density (window.devicePixelRatio: 2 or 3 on phones
// and tablets), but no more than these. The canvases are redrawn every frame, so their pixels are the game's
// biggest cost: on an iPad (a game 1180 points wide, at 2x) the drawing layer and the clock's halo were about
// 34 MB of pixels a frame, slowing it and, past Safari's limit, crashing the page. Their soft, glowing spells,
// sparkles and rays look nearly the same at a lower density. (1.5: a little over half the pixels of 2x; 1: a quarter.)

export const CANVAS_RESOLUTION = {
  maxDensity: 1.5, // the drawing layer (spells, drawings, sparkles, the Spell Book) and the logo
  haloMaxDensity: 1, // the clock's halo (soft rays and ribbons over a canvas nearly the game's width, square)
};

/** The pixel density to draw a canvas at: the screen's, capped (CANVAS_RESOLUTION). */
export const getCanvasDensity = (max: number = CANVAS_RESOLUTION.maxDensity): number => Math.min(window.devicePixelRatio || 1, max);
