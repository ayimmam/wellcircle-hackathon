import { describe, it, expect } from 'vitest';
import { MOCK_FOR_YOU_FEED, MOCK_PROVIDERS } from '../data/mock';

// The For You feed is laid out in four sections — this week's events, member
// posts, coming-soon events, then provider content. This file pins that order
// against the mock builder, which mirrors
// backend/app/services/feed_service.py::_order_feed; the backend's own
// ordering is covered by app/tests/test_for_you_feed.py.
const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');
const types = MOCK_FOR_YOU_FEED.map(i => i.type);
const PROVIDER_TYPES = ['service', 'provider', 'past_event'];
const WEEK_MS = 7 * 86400000;

const firstIndexOf = (pred) => types.findIndex(pred);
const lastIndexOf = (pred) => types.length - 1 - [...types].reverse().findIndex(pred);

const firstPost = firstIndexOf(t => t === 'post');
const lastPost = lastIndexOf(t => t === 'post');
const startsAt = (item) => new Date(item.event.starts_at).getTime();

describe('For You feed order', () => {
  it('opens with events, above everything else', () => {
    expect(types[0]).toBe('event');
    const firstNonEvent = firstIndexOf(t => t !== 'event');
    expect(firstNonEvent).toBeGreaterThan(0);
  });

  it('leads with this week’s events only', () => {
    const lead = MOCK_FOR_YOU_FEED.slice(0, firstIndexOf(t => t !== 'event'));
    expect(lead.length).toBeGreaterThan(0);
    lead.forEach(item => {
      expect(item.type).toBe('event');
      expect(item.event.is_past).toBeFalsy();
      expect(startsAt(item)).toBeGreaterThan(Date.now());
      expect(startsAt(item)).toBeLessThanOrEqual(Date.now() + WEEK_MS);
    });
  });

  it('puts member posts after the lead events and before any provider content', () => {
    const firstProvider = firstIndexOf(t => PROVIDER_TYPES.includes(t));
    expect(firstPost).toBeGreaterThan(0);
    expect(firstProvider).toBeGreaterThan(firstPost);
    expect(MOCK_FOR_YOU_FEED.filter(i => i.type === 'post').length).toBeGreaterThan(4);
  });

  it('puts events further out than this week below the post stream', () => {
    const comingSoon = MOCK_FOR_YOU_FEED
      .map((item, i) => ({ item, i }))
      .filter(({ item, i }) => item.type === 'event' && i > lastPost);
    expect(comingSoon.length).toBeGreaterThan(0);
    comingSoon.forEach(({ item }) => {
      expect(startsAt(item)).toBeGreaterThan(Date.now() + WEEK_MS);
    });
  });

  it('closes with the provider block, no posts interleaved into it', () => {
    const tail = types.slice(lastPost + 1);
    expect(tail.length).toBeGreaterThan(0);
    // The tail is the coming-soon events followed by provider content, and
    // once the provider block starts no event may reappear.
    const firstProviderInTail = tail.findIndex(t => PROVIDER_TYPES.includes(t));
    expect(firstProviderInTail).toBeGreaterThanOrEqual(0);
    tail.slice(0, firstProviderInTail).forEach(t => expect(t).toBe('event'));
    tail.slice(firstProviderInTail).forEach(t => expect(PROVIDER_TYPES).toContain(t));
  });

  it('leads the provider block with the featured provider’s services', () => {
    const firstService = MOCK_FOR_YOU_FEED.find(i => i.type === 'service');
    expect(firstService.provider.id).toBe(boston.id);
    const firstProviderCard = MOCK_FOR_YOU_FEED.find(i => i.type === 'provider');
    expect(firstProviderCard.provider.id).toBe(boston.id);
  });

  it('marks past events with their own type so they never render a booking CTA', () => {
    const pastItems = MOCK_FOR_YOU_FEED.filter(i => i.type === 'past_event');
    expect(pastItems.length).toBeGreaterThan(0);
    pastItems.forEach(item => {
      expect(item.event.is_past).toBe(true);
      expect(startsAt(item)).toBeLessThan(Date.now());
    });
  });

  it('carries the host’s contact channels on every event item, for the RSVP screen', () => {
    const eventItems = MOCK_FOR_YOU_FEED.filter(i => i.type === 'event');
    expect(eventItems.length).toBeGreaterThan(0);
    eventItems.forEach(item => {
      expect(item.provider).toHaveProperty('contact_phone');
      expect(item.provider).toHaveProperty('contact_telegram');
      expect(item.provider).toHaveProperty('contact_instagram');
      expect(item.provider).toHaveProperty('contact_website');
    });
  });
});
