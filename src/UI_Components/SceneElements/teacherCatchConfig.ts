// teacherCatchConfig.ts
// The timing of the teacher's visits at dawn (TeacherCatch.tsx; Game runs them). Kept apart from the
// components so the game logic can read it without importing the store's components.

/**
 * A risky turn nobody was caught on: the weaker wizard's relief (their status emoji relieved, STATUS_EMOJI:
 * delay from the turn's end, and how long; seconds), and, if isLightOn, a lantern's light passing their
 * doorway first.
 */
export const LANTERN_PASS = { isLightOn: false, seconds: 2.8, phewDelaySeconds: 0.8, phewSeconds: 2 };

/**
 * A catch, in order (seconds): the light floods through the caught wizard's doorway (the hall shaking as
 * it peaks); the caught wizard is lifted into the air (liftHeight: cqw) and struggles there (their wand arm
 * flailing, spells cast in a flurry: CAST_FLURRY), then is dragged out through the doorway, still aloft.
 * Meanwhile the other slips away through theirs (slipDelaySeconds after the flood), and once they're gone
 * "Caught!" stamps on, during the struggle (CATCH_TIMES.stamp); then the game over card.
 */
export const CATCH_SCENE = { floodSeconds: 1.3, liftSeconds: 0.9, struggleSeconds: 2.8, dragSeconds: 1.6, liftHeight: 7, slipDelaySeconds: 0.5, stampSeconds: 1.5, stampText: 'Caught!' };
/** When (seconds into the scene) the caught wizard is lifted, dragged off, and "Caught!" stamps on. */
export const CATCH_TIMES = {
  lift: CATCH_SCENE.floodSeconds,
  drag: CATCH_SCENE.floodSeconds + CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds,
  dragged: CATCH_SCENE.floodSeconds + CATCH_SCENE.liftSeconds + CATCH_SCENE.struggleSeconds + CATCH_SCENE.dragSeconds, // (gone)
  // ("Caught!" once the other wizard has slipped away: when they would have, if both were caught; during the struggle)
  stamp: CATCH_SCENE.floodSeconds + CATCH_SCENE.slipDelaySeconds + CATCH_SCENE.dragSeconds,
};
/**
 * Once the other wizard has got away (as "Caught!" stamps on: fromSeconds into the scene), the scene darkens
 * (opacity: the darkness over it, 0 none, 1 black; over fadeSeconds): everything but the caught wizard, their
 * flurry of spells, their doorway's red light and "Caught!" (CATCH_LAYERS). The caught wizard's health, focus,
 * status and spotlight darken with the rest.
 */
export const CATCH_DIM = { isOn: true, opacity: 0.75, fadeSeconds: 0.9, fromSeconds: CATCH_TIMES.stamp - 0.2 };
/** The catch's stacking (z-index): the darkness, the caught doorway's light over it, the caught wizard over that ("Caught!", 45, on top). */
export const CATCH_LAYERS = { dim: 42, doorway: 43, caught: 44 };

/** The scene's end (the game over card): the caught wizard gone and "Caught!" stamped on, whichever's later. */
export const CATCH_SCENE_TOTAL_SECONDS = Math.max(CATCH_TIMES.dragged, CATCH_TIMES.stamp + CATCH_SCENE.stampSeconds);

/**
 * The caught wizard's struggle in the air: spells cast in a flurry (perSecond), each symbol (the NPC's)
 * drawn by their wand in gold (drawSeconds: the wand tracing it), held a moment (holdSeconds), then fading
 * out (fadeSeconds); of every size, overlapping (size: [smallest, largest], % of the wizard's frame; turn: up
 * to so many degrees either way; area: where they may be drawn, as fractions of the game: across, from their edge
 * of the hall to a quarter onto their side of the board, and anywhere down the screen). And their wand arm (FLAIL: from the lift's middle into the drag): tracing
 * each symbol as it's drawn, flailing between (swings: each joint's [rest, sway, speed], degrees; frantic: the
 * flailing's speed, 2 twice as fast; wildness: its reach, 2 twice as wide).
 */
export const CAST_FLURRY = { perSecond: 1.8, drawSeconds: 0.3, holdSeconds: 0.7, fadeSeconds: 0.9, size: [25, 150], turn: 180, area: { self: [0.02, 0.36], rival: [0.64, 0.98], y: [0, 1] } };
export const FLAIL = {
  frantic: 1,
  wildness: 1,
  fromSeconds: CATCH_TIMES.lift + CATCH_SCENE.liftSeconds * 0.4,
  seconds: CATCH_SCENE.liftSeconds * 0.6 + CATCH_SCENE.struggleSeconds + CATCH_SCENE.dragSeconds * 0.6,
  swings: [[-15, 22, 9], [-25, 38, 13], [-30, 42, 17]],
};

