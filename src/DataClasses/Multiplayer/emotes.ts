// emotes.ts
// The emoji a 2-player match's players can send each other (EmojiReactionsComponent). Only these are
// ever shown: a received one not on the list is ignored. EMOTE_CLEAR: sent instead of one, no reaction
// (the last one taken down).
export const EMOTES = ['👋', '😄', '😮', '🤔', '😠', '😭', '🔥'];
export const EMOTE_CLEAR = 'clear';

/**
 * How long an emoji shows over a wizard's head (0: it stays, as a status, until the next), and the wait
 * before sending another (seconds).
 */
export const EMOTE_TIMING = { showSeconds: 0, cooldownSeconds: 2 };
