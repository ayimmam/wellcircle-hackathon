import { describe, it, expect } from 'vitest';
import { isFreeEvent, daysUntil, daysLeftLabel } from '../utils/eventTiming';

// The free/paid split decides whether a card shows a countdown or a spots
// pill, and whether it gets an RSVP button at all — so what counts as "free"
// has to be unambiguous.
describe('isFreeEvent', () => {
  it('treats a zero price as free', () => {
    expect(isFreeEvent({ price_etb: 0 })).toBe(true);
  });

  it('treats a missing price as free', () => {
    expect(isFreeEvent({})).toBe(true);
    expect(isFreeEvent({ price_etb: null })).toBe(true);
    expect(isFreeEvent(undefined)).toBe(true);
  });

  it('treats any positive price as paid', () => {
    expect(isFreeEvent({ price_etb: 1 })).toBe(false);
    expect(isFreeEvent({ price_etb: 29000 })).toBe(false);
  });
});

// The countdown is about the reader's own calendar, so these are built in
// local time — a UTC-framed fixture would assert a different day than the
// user sees anywhere east or west of Greenwich.
const NOW = new Date(2026, 8, 23, 9, 0);          // Sep 23, 09:00 local
const localDay = (dayOfMonth, hour = 9) => new Date(2026, 8, dayOfMonth, hour, 0).toISOString();

describe('daysUntil', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    // 06:00 tomorrow is 21 hours away but is still "1 day".
    expect(daysUntil(localDay(24, 6), NOW)).toBe(1);
    // 23:00 tonight is 14 hours away and is still "0 days".
    expect(daysUntil(localDay(23, 23), NOW)).toBe(0);
  });

  it('goes negative for an event that has passed', () => {
    expect(daysUntil(localDay(21), NOW)).toBe(-2);
  });

  it('returns null for a missing or unparseable date', () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('not a date', NOW)).toBeNull();
  });
});

describe('daysLeftLabel', () => {
  it('names today and tomorrow rather than counting them', () => {
    expect(daysLeftLabel(localDay(23, 18), undefined, NOW)).toBe('Today');
    expect(daysLeftLabel(localDay(24, 6), undefined, NOW)).toBe('Tomorrow');
  });

  it('counts anything further out', () => {
    expect(daysLeftLabel(localDay(26, 6), undefined, NOW)).toBe('3 days left');
  });

  it('gives a past event no countdown — the recap card owns that state', () => {
    expect(daysLeftLabel(localDay(22, 6), undefined, NOW)).toBeNull();
  });

  it('interpolates even without a translator, so a forgotten `t` is visible', () => {
    expect(daysLeftLabel(localDay(26, 6), undefined, NOW)).not.toContain('{{');
  });

  it('uses the translator it is given', () => {
    const t = (key, vars) => (vars ? `TR:${key}:${vars.count}` : `TR:${key}`);
    expect(daysLeftLabel(localDay(26, 6), t, NOW)).toBe('TR:{{count}} days left:3');
    expect(daysLeftLabel(localDay(23, 18), t, NOW)).toBe('TR:Today');
  });
});
