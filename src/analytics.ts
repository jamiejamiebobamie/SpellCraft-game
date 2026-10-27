// analytics.ts
// Site metrics, with Umami (cloud.umami.is: cookieless, so no consent banner). Umami itself counts
// unique visitors, visit length, and where they're from; these events add the rest: the visitor's
// local time of day, the duel they chose, each game's length and result, and their time on the site.

/**
 * websiteId: the site's id from Umami's dashboard (Settings, Websites); empty: nothing is loaded or
 * sent. domains: the only ones counted (so playing locally never is).
 */
export const ANALYTICS = {
  websiteId: '91f779c4-490c-4675-85d5-6cce24a4ba88',
  scriptUrl: 'https://cloud.umami.is/script.js',
  domains: ['spellcraft-game.netlify.app'],
};

type EventData = Record<string, string | number | boolean>;
type Umami = { track: (name: string, data?: EventData) => void };

const getIsOn = (): boolean => !!ANALYTICS.websiteId && ANALYTICS.domains.includes(window.location.hostname);
/** Events sent before Umami's script has loaded wait here. */
const queued: Array<[string, EventData | undefined]> = [];
const getUmami = (): Umami | undefined => (window as unknown as { umami?: Umami }).umami;

/** Sends an event (a no-op unless analytics is on). */
export const trackEvent = (name: string, data?: EventData): void => {
  if (!getIsOn()) return;
  const umami = getUmami();
  if (umami) umami.track(name, data);
  else queued.push([name, data]);
};

/** Loads Umami's script, and sends the visit's local time and, when the tab is left, the time on the site. */
export const initAnalytics = (): void => {
  if (!getIsOn()) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = ANALYTICS.scriptUrl;
  script.dataset.websiteId = ANALYTICS.websiteId;
  script.dataset.domains = ANALYTICS.domains.join(',');
  script.onload = () => { queued.splice(0).forEach(([name, data]) => getUmami()?.track(name, data)); };
  document.head.appendChild(script);

  // (6) What time it was for them: Umami's own reports use the dashboard's time zone
  const now = new Date();
  trackEvent('visit', { localHour: now.getHours(), weekday: now.toLocaleDateString('en-US', { weekday: 'long' }) });

  // (2) Time on the site, sent when they leave (or switch away from) the tab: Umami's visit length only
  // counts up to the last event, which could be early in a long game
  const loadedAt = performance.now();
  let lastSentSeconds = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    const seconds = Math.round((performance.now() - loadedAt) / 1000);
    if (seconds - lastSentSeconds < 5) return;
    lastSentSeconds = seconds;
    trackEvent('leave', { secondsOnSite: seconds });
  });
};
