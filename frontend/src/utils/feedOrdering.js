// WS3 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the For You feed leads
// with items that have an image, mirroring
// backend/app/services/feed_service.py::partition_by_image. Shared by
// ForYouScreen.jsx (pre-settle ordering) and data/mock.js (offline/test
// parity) so neither can drift from the other.

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
