// The For You feed round-robins five lanes — this week's events, image
// posts, text posts, upcoming events, provider services — taking one item
// from each in turn so the reader never gets a wall of the same card. This
// file mirrors backend/app/services/feed_service.py's `round_robin` and
// `_order_feed`, and is shared by ForYouScreen.jsx (pre-settle ordering) and
// data/mock.js (offline/test parity) so none of the three can drift.

export function postHasImage(item) {
  return Boolean(item?.post?.photo_url);
}

export function eventHasImage(item) {
  return Boolean(item?.provider?.cover_photo_url);
}

/** Stable partition: items `hasImage` first, then the rest, each keeping
 * its existing relative order. */
export function partitionByImage(items, hasImage) {
  const withImage = [];
  const withoutImage = [];
  for (const item of items || []) {
    (hasImage(item) ? withImage : withoutImage).push(item);
  }
  return [...withImage, ...withoutImage];
}

/**
 * Interleave lanes, one item from each per cycle, in the given lane order.
 * An exhausted lane drops out and the cycle continues without it, so a feed
 * with two events and thirty posts degrades to alternating posts rather
 * than stalling.
 *
 *   roundRobin([[1, 2, 3], ['a'], ['x', 'y']]) → [1, 'a', 'x', 2, 'y', 3]
 */
export function roundRobin(lanes) {
  const result = [];
  const cursors = lanes.map(() => 0);
  let remaining = lanes.reduce((n, lane) => n + lane.length, 0);
  while (remaining > 0) {
    for (let i = 0; i < lanes.length; i += 1) {
      if (cursors[i] < lanes[i].length) {
        result.push(lanes[i][cursors[i]]);
        cursors[i] += 1;
        remaining -= 1;
      }
    }
  }
  return result;
}

/**
 * Split a page of feed items back into its lanes and re-cycle them.
 *
 * Used for the pre-settle paint: the cached/lite payload is already in some
 * order, and this re-imposes the lane cycle on it so nothing visibly
 * reshuffles when the settled server response replaces it. Provider cards
 * and past-event recaps are not lanes — they are appended after the cycle,
 * in the order they arrived.
 */
export function orderFeedItems(items) {
  const lanes = { event: [], imagePost: [], textPost: [], service: [] };
  const tail = [];

  for (const item of items || []) {
    if (item.type === 'event') lanes.event.push(item);
    else if (item.type === 'post') {
      (postHasImage(item) ? lanes.imagePost : lanes.textPost).push(item);
    } else if (item.type === 'service') lanes.service.push(item);
    else tail.push(item);
  }

  // The client can't tell this week's events from the upcoming ones without
  // re-deriving the 7-day window, and the server already ordered them that
  // way within the payload — so the event lane stays as one, cover-photo
  // items first, matching the server's own per-lane partition.
  return [
    ...roundRobin([
      partitionByImage(lanes.event, eventHasImage),
      lanes.imagePost,
      lanes.textPost,
      lanes.service,
    ]),
    ...tail,
  ];
}
