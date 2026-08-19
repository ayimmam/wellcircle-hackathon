import { describe, it, expect } from 'vitest';
import { MOCK_FOR_YOU_FEED, MOCK_PROVIDERS } from '../data/mock';

// The For You feed is laid out in three sections — upcoming events, then
// member posts, then provider content. This file pins that order against the
// mock builder, which mirrors backend/app/services/feed_service.py::_order_feed;
// the backend's own ordering is covered by app/tests/test_for_you_feed.py.
const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');
const types = MOCK_FOR_YOU_FEED.map(i => i.type);
const PROVIDER_TYPES = ['service', 'provider', 'past_event'];

const firstIndexOf = (pred) => types.findIndex(pred);
const lastIndexOf = (pred) => types.length - 1 - [...types].reverse().findIndex(pred);

describe('For You feed order', () => {
  it('opens with upcoming events, above everything else', () => {
    expect(types[0]).toBe('event');
    const firstNonEvent = firstIndexOf(t => t !== 'event');
    expect(firstNonEvent).toBeGreaterThan(0);
    // Every event is in that opening block — none stranded further down.
    expect(types.slice(firstNonEvent)).not.toContain('event');
  });

  it('puts member posts after the events and before any provider content', () => {
    const lastEvent = lastIndexOf(t => t === 'event');
    const firstPost = firstIndexOf(t => t === 'post');
    const firstProvider = firstIndexOf(t => PROVIDER_TYPES.includes(t));

    expect(firstPost).toBeGreaterThan(lastEvent);
    expect(firstProvider).toBeGreaterThan(firstPost);
    expect(MOCK_FOR_YOU_FEED.filter(i => i.type === 'post').length).toBeGreaterThan(4);
  });

  it('puts provider content last, with no posts interleaved into it', () => {
    const lastPost = lastIndexOf(t => t === 'post');
    const tail = types.slice(lastPost + 1);
    expect(tail.length).toBeGreaterThan(0);
    tail.forEach(t => expect(PROVIDER_TYPES).toContain(t));
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
      expect(new Date(item.event.starts_at).getTime()).toBeLessThan(Date.now());
    });
  });

  it('only carries upcoming events in the lead block', () => {
    const lead = MOCK_FOR_YOU_FEED.slice(0, firstIndexOf(t => t !== 'event'));
    expect(lead.length).toBeGreaterThan(0);
    lead.forEach(item => {
      expect(item.event.is_past).toBeFalsy();
      expect(new Date(item.event.starts_at).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
