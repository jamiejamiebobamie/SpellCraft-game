// teacherCatchConfig.ts
// The timing of the teacher's visits at dawn (TeacherCatch.tsx; Game runs them). Kept apart from the
// components so the game logic can read it without importing the store's components.

/**
 * A risky turn nobody was caught on: the weaker wizard's "phew" (as "Pass": delay from the turn's end, and
 * how long it's kept; seconds), and, if isLightOn, a lantern's light passing their doorway first.
 */
export const LANTERN_PASS = { isLightOn: false, seconds: 2.8, phewDelaySeconds: 0.8, phewSeconds: 2, phewText: 'phew…' };

/**
 * A catch, in order (seconds): the light floods through the caught wizard's doorway (the hall shaking as
 * it peaks), the caught wizard is dragged out through it while the other slips away through theirs, then
 * "Caught!" stamps on, and then the game over card.
 */
export const CATCH_SCENE = { floodSeconds: 1.3, dragSeconds: 1.9, slipDelaySeconds: 0.5, stampSeconds: 1.5, stampText: 'Caught!' };
export const CATCH_SCENE_TOTAL_SECONDS = CATCH_SCENE.floodSeconds + CATCH_SCENE.dragSeconds + CATCH_SCENE.stampSeconds;

/** First light (the risky turns begin): a card after the turn's own (delay: seconds after it begins). */
export const DAWN_CARD = { delaySeconds: 2.6, title: 'First Light', text: 'Dawn nears and teachers awake!' };
