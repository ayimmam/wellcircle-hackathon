import { describe, it, expect } from 'vitest';
import { MOCK_FOR_YOU_FEED, MOCK_PROVIDERS } from '../data/mock';
import { roundRobin, orderFeedItems } from '../utils/feedOrdering';

// The For You feed round-robins five lanes — this week's events, image
// posts, text posts, upcoming events, provider services — one item from each
// per cycle, repeating. Provider cards and past-event recaps are not lanes;
// they close the feed. This file pins that against the mock builder, which
// mirrors backend/app/services/feed_service.py::_order_feed; the backend's
// own ordering is covered by app/tests/test_for_you_feed.py.
const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');
const types = MOCK_FOR_YOU_FEED.map(i => i.type);
const TAIL_TYPES = ['provider', 'past_event'];
const WEEK_MS = 7 * 86400000;

const startsAt = (item) => new Date(item.event.starts_at).getTime();
const firstTailIndex = types.findIndex(t => TAIL_TYPES.includes(t));
const cycle = MOCK_FOR_YOU_FEED.slice(0, firstTailIndex);
const tail = types.slice(firstTailIndex);

describe('roundRobin', () => {
  it('takes one item per lane per cycle, in lane order', () => {
    expect(roundRobin([[1, 2, 3], ['a'], ['x', 'y']])).toEqual([1, 'a', 'x', 2, 'y', 3]);
  });

  it('skips an exhausted lane rather than stalling', () => {
    expect(roundRobin([['a'], [1, 2, 3, 4]])).toEqual(['a', 1, 2, 3, 4]);
  });

  it('handles empty lanes and an empty input', () => {
    expect(roundRobin([[], ['a', 'b'], []])).toEqual(['a', 'b']);
    expect(roundRobin([])).toEqual([]);
    expect(roundRobin([[], []])).toEqual([]);
  });
});

describe('For You feed order', () => {
  it('opens with an event — position 1 of the cycle', () => {
    expect(types[0]).toBe('event');
  });

  it('lays the first cycle out in lane order', () => {
    // Lanes 1 and 4 are both events (this week's, then the ones further
    // out), which is why 'event' legitimately appears twice in one cycle.
    expect(types.slice(0, 5)).toEqual(['event', 'post', 'post', 'event', 'service']);
  });

  it('repeats the same cycle for as long as every lane has items', () => {
    expect(types.slice(5, 10)).toEqual(['event', 'post', 'post', 'event', 'service']);
  });

  it('interleaves posts between the events while the post lanes hold items', () => {
    const lastPost = types.lastIndexOf('post');
    const eventPositions = types
      .map((t, i) => (t === 'event' ? i : -1))
      .filter(i => i >= 0 && i < lastPost);
    expect(eventPositions.length).toBeGreaterThan(1);
    // No two events adjacent while there is still other content to separate
    // them. Past that point the shorter lanes have run dry and the cycle
    // correctly collapses to the lanes that remain.
    for (let i = 1; i < eventPositions.length; i += 1) {
      expect(eventPositions[i] - eventPositions[i - 1]).toBeGreaterThan(1);
    }
  });

  it('alternates image posts and text posts', () => {
    const postTypes = cycle
      .filter(i => i.type === 'post')
      .map(i => (i.post.photo_url ? 'image' : 'text'));
    expect(postTypes.length).toBeGreaterThan(3);
    // The image lane leads the two post lanes, and they alternate while both
    // still hold items.
    expect(postTypes[0]).toBe('image');
    expect(postTypes[1]).toBe('text');
  });

  it('puts a service inside the cycle, not in a block at the end', () => {
    const serviceIdx = types.indexOf('service');
    expect(serviceIdx).toBeGreaterThan(0);
    expect(serviceIdx).toBeLessThan(firstTailIndex);
    // At least one post appears before the first service — it is lane 5.
    expect(types.slice(0, serviceIdx)).toContain('post');
  });

  it('cycles this week’s events before the ones further out', () => {
    const eventItems = cycle.filter(i => i.type === 'event');
    const thisWeek = eventItems.filter(i => startsAt(i) <= Date.now() + WEEK_MS);
    const later = eventItems.filter(i => startsAt(i) > Date.now() + WEEK_MS);
    expect(thisWeek.length).toBeGreaterThan(0);
    // Lane 1 is this week, lane 4 is later — so the first event of the feed
    // is always one of this week's.
    expect(startsAt(eventItems[0])).toBeLessThanOrEqual(Date.now() + WEEK_MS);
    if (later.length) {
      expect(cycle.indexOf(thisWeek[0])).toBeLessThan(cycle.indexOf(later[0]));
    }
  });

  it('closes with provider cards then past-event recaps, nothing else', () => {
    expect(tail.length).toBeGreaterThan(0);
    tail.forEach(t => expect(TAIL_TYPES).toContain(t));
    const lastProvider = tail.lastIndexOf('provider');
    const firstRecap = tail.indexOf('past_event');
    if (lastProvider >= 0 && firstRecap >= 0) {
      expect(lastProvider).toBeLessThan(firstRecap);
    }
  });

  it('leads the provider block with the featured provider', () => {
    const firstService = MOCK_FOR_YOU_FEED.find(i => i.type === 'service');
    expect(firstService.provider.id).toBe(boston.id);
    const firstProviderCard = MOCK_FOR_YOU_FEED.find(i => i.type === 'provider');
    expect(firstProviderCard.provider.id).toBe(boston.id);
  });

  it('marks past events with their own type so they never render a CTA', () => {
    const pastItems = MOCK_FOR_YOU_FEED.filter(i => i.type === 'past_event');
    expect(pastItems.length).toBeGreaterThan(0);
    pastItems.forEach(item => {
      expect(item.event.is_past).toBe(true);
      expect(startsAt(item)).toBeLessThan(Date.now());
    });
  });

  it('carries the host’s contact channels on every event item, for RSVP', () => {
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

// The pre-settle paint re-imposes the cycle on whatever order the cached or
// lite payload arrived in, so the feed doesn't visibly reshuffle when the
// settled server response lands.
describe('orderFeedItems (pre-settle)', () => {
  const post = (id, photo) => ({ type: 'post', id, post: { photo_url: photo || null } });
  const event = (id) => ({ type: 'event', id, provider: { cover_photo_url: 'x.jpg' } });

  it('re-cycles a block-ordered payload into lane order', () => {
    const blocked = [
      event('e1'), event('e2'),
      post('p1', 'a.jpg'), post('p2', 'b.jpg'),
      post('t1'), post('t2'),
      { type: 'service', id: 's1' },
    ];
    expect(orderFeedItems(blocked).map(i => i.id))
      .toEqual(['e1', 'p1', 't1', 's1', 'e2', 'p2', 't2']);
  });

  it('appends provider cards and recaps after the cycle', () => {
    const withTail = [
      { type: 'provider', id: 'pr1' },
      event('e1'),
      { type: 'past_event', id: 'pe1', event: {} },
      post('p1', 'a.jpg'),
    ];
    expect(orderFeedItems(withTail).map(i => i.id)).toEqual(['e1', 'p1', 'pr1', 'pe1']);
  });

  it('handles an empty or missing payload', () => {
    expect(orderFeedItems([])).toEqual([]);
    expect(orderFeedItems(undefined)).toEqual([]);
  });
});
