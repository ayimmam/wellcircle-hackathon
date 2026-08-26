/**
 * Well Circle — on-device image cache.
 *
 * Images are most of what this app downloads and almost all of what it
 * downloads *twice*: the same provider cover appears in the feed, in Explore
 * and on the provider page, and the same avatars scroll past every session.
 * The HTTP cache should handle that, but on the mid-range Android phones this
 * app targets it is small, shared with every other site, and evicted
 * constantly — so a photo seen this morning is re-downloaded this afternoon on
 * a connection where that costs real seconds and real money.
 *
 * This worker keeps a Cache Storage copy of images only. It is deliberately
 * narrow:
 *
 *  - It calls `respondWith` for image requests and nothing else. HTML, JS, the
 *    API — every other request falls straight through to the network, so this
 *    can never serve a stale app shell or a stale API response. That is the
 *    failure mode that makes service workers dangerous, and it is designed out
 *    rather than guarded against.
 *  - Entries carry their own insertion timestamp and expire, so a provider who
 *    changes their cover photo is not stale forever.
 *  - The cache is capped and versioned; bumping CACHE drops the old one.
 *
 * Registered from src/main.jsx, production builds only.
 */

const CACHE = 'wc-images-v1';
const MAX_ENTRIES = 160;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STAMP_HEADER = 'x-wc-cached-at';

// Hosts that refused a CORS read once. A cross-origin response we can't read is
// opaque: it can be cached, but browsers pad opaque entries to several MB of
// quota each, which would blow the storage budget for a handful of avatars.
// So we ask in CORS mode — and remember the hosts where that wastes a download,
// to only pay for that lesson once.
const noCorsHosts = new Set();

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(name => name.startsWith('wc-images-') && name !== CACHE)
        .map(name => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.destination !== 'image') return;
  if (!/^https?:$/.test(new URL(request.url).protocol)) return;
  event.respondWith(serveImage(request));
});

async function serveImage(request) {
  const cache = await caches.open(CACHE);
  // ignoreVary: a CDN that varies on Accept would otherwise miss every time
  // the browser's Accept header shifts (it does, between WebP and AVIF builds).
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit && !isExpired(hit)) return hit;

  try {
    return await fetchAndStore(request, cache);
  } catch (err) {
    // Offline or the host is down. An expired copy still shows the user their
    // feed; that is strictly better than a broken-image icon.
    if (hit) return hit;
    throw err;
  }
}

function isExpired(response) {
  const stamp = Number(response.headers.get(STAMP_HEADER));
  if (!stamp) return false;
  return Date.now() - stamp > MAX_AGE_MS;
}

async function fetchAndStore(request, cache) {
  const host = new URL(request.url).host;

  if (!noCorsHosts.has(host)) {
    let response;
    try {
      response = await fetch(new Request(request.url, { mode: 'cors', credentials: 'omit' }));
    } catch {
      // The host doesn't allow a cross-origin read. Fall through to a plain
      // fetch and stop trying CORS on it for the life of this worker.
      noCorsHosts.add(host);
      return fetch(request);
    }
    if (response.ok && response.type !== 'opaque') {
      // Re-wrap so the entry carries its own age. Reading the body here is
      // what makes that possible, and these are resized images — tens of KB.
      const body = await response.clone().blob();
      const headers = new Headers(response.headers);
      headers.set(STAMP_HEADER, String(Date.now()));
      const stored = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await cache.put(request, stored.clone());
      trim(cache);
      return stored;
    }
    return response;
  }

  return fetch(request);
}

/** Cache.keys() is insertion-ordered, so dropping from the front is FIFO. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(
    keys.slice(0, keys.length - MAX_ENTRIES).map(key => cache.delete(key)),
  );
}
