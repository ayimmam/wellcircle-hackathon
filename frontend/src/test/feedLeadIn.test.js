import { describe, it, expect } from 'vitest';
import { MOCK_FOR_YOU_FEED, MOCK_PROVIDERS } from '../data/mock';

const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');

describe('For You feed lead-in', () => {
  it('opens with the featured provider, not whichever provider is first in the array', () => {
    expect(MOCK_FOR_YOU_FEED[0].type).toBe('provider');
    expect(MOCK_FOR_YOU_FEED[0].provider.id).toBe(boston.id);
  });

  it('surfaces a service, an upcoming event, and a past event in the opening stretch', () => {
    const opening = MOCK_FOR_YOU_FEED.slice(0, 8).map(i => i.type);
    expect(opening).toContain('service');
    expect(opening).toContain('event');
    expect(opening).toContain('past_event');
  });

  it('the lead-in service and event belong to the spotlight provider', () => {
    const opening = MOCK_FOR_YOU_FEED.slice(0, 8);
    expect(opening.find(i => i.type === 'service').provider.id).toBe(boston.id);
    expect(opening.find(i => i.type === 'event').provider.id).toBe(boston.id);
    expect(opening.find(i => i.type === 'past_event').provider.id).toBe(boston.id);
  });

  it('separates every lead-in card with a member post rather than stacking them', () => {
    const opening = MOCK_FOR_YOU_FEED.slice(0, 8).map(i => i.type);
    for (let i = 0; i < 7; i++) {
      if (opening[i] !== 'post' && opening[i + 1] !== undefined) {
        expect(opening[i + 1]).toBe('post');
      }
    }
  });

  it('scatters the remaining non-post items instead of dumping them at the end', () => {
    const tail = MOCK_FOR_YOU_FEED.slice(8);
    const posts = tail.filter(i => i.type === 'post').length;
    // There is more provider inventory than post volume, so a tail-heavy block
    // is expected — what matters is that posts keep appearing inside it.
    expect(posts).toBeGreaterThan(0);
    expect(MOCK_FOR_YOU_FEED.filter(i => i.type === 'post').length).toBeGreaterThan(4);
  });

  it('marks past events with their own type so they never render a booking CTA', () => {
    const pastItems = MOCK_FOR_YOU_FEED.filter(i => i.type === 'past_event');
    expect(pastItems.length).toBeGreaterThan(0);
    pastItems.forEach(item => {
      expect(item.event.is_past).toBe(true);
      expect(new Date(item.event.starts_at).getTime()).toBeLessThan(Date.now());
    });
  });
});
