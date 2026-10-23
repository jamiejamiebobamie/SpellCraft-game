// layers.ts
// The game's canvas and the buttons around its edges, in stacking order (z-index). The canvas draws the
// full-screen overlays (the keyboard controls, the Spell Book's pages); while one shows, the canvas rises
// above a button that drops beneath it, so the overlay's darkening really covers it.

export const LAYERS = {
  canvas: 29, // the game's canvas, normally
  buttonUnderOverlay: 30, // a button while an overlay is up (the clock body stays at 31, beneath it too)
  canvasWithOverlay: 32, // the canvas while an overlay is up (or a spell is being placed, or a symbol hovered)
  button: 35, // the buttons (the Spell Book, the difficulty mask or emoji, the settings)
};
