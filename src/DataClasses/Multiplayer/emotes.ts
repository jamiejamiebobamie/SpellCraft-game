// emotes.ts
// The emoji a 2-player match's players can send each other (EmojiReactionsComponent). Only these are
// ever shown: a received one not on the list is ignored.
export const EMOTES = ['👋', '😄', '😮', '🤔', '😠', '😭', '🔥', '🤝'];

/** How long an emoji shows over a wizard's head, and the wait before sending another (seconds). */
export const EMOTE_TIMING = { showSeconds: 2.2, cooldownSeconds: 2 };
