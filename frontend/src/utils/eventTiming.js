// Free community events have no gate on them — a run club doesn't sell out,
// and "50 spots left" on a session anyone can turn up to is noise dressed as
// urgency. What actually decides whether a reader acts is how soon it is, so
// the free cards show a countdown where the paid ones show remaining spots.
//
// Shared by EventCard.jsx and feed/FeedEventBanner.jsx so the two cannot
// disagree about what "free" or "3 days left" means.

/** An event is free when it carries no price. `null`/`undefined`/`0` all mean
 * the same thing here: nothing to pay, so nothing to RSVP and pay for. */
export function isFreeEvent(event) {
  return !event?.price_etb;
}

/** Whole days between `now` and the event start, floored — the same day is 0.
 * Returns null when there is no parseable start. */
export function daysUntil(startsAt, now = new Date()) {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  // Compare calendar days, not 24-hour blocks: an event at 06:00 tomorrow is
  // "Tomorrow" whether it's read at 23:00 tonight or 07:00 this morning.
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startDay - nowDay) / 86400000);
}

/** Stand-in for i18next's `t` when a caller has none. It interpolates, so a
 * component that forgets to pass a translator renders "3 days left" rather
 * than the raw "{{count}} days left" key. */
const passthrough = (key, vars = {}) =>
  key.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

/**
 * Countdown label for a free event, e.g. "Today", "Tomorrow", "3 days left".
 * `t` is i18next's translator; passing it keeps this file free of an i18n
 * import and testable without one.
 *
 * Returns null for an event that has already started — a past session gets
 * no countdown, and the recap card (FeedPastEventCard) owns that state.
 */
export function daysLeftLabel(startsAt, t = passthrough, now = new Date()) {
  const days = daysUntil(startsAt, now);
  if (days === null || days < 0) return null;
  if (days === 0) return t('Today');
  if (days === 1) return t('Tomorrow');
  return t('{{count}} days left', { count: days });
}
