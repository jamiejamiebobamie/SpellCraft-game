/**
 * Whether the page runs in WebKit, Safari's engine: Safari on a Mac, and every browser on an iPad or iPhone
 * (Chrome and Firefox there are WebKit too). Some effects are much costlier in it, so a few have a cheaper
 * version there. (An iPad's Safari says it's a Mac: it's still WebKit, and not Chrome or Edge's Blink.)
 */
export const isWebKit: boolean = typeof navigator !== 'undefined'
  && /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent);
