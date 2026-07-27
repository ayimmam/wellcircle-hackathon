/**
 * Well Circle — client-side response cache.
 *
 * The Mini App runs against free-tier serverless hosting, where a cold Python
 * function can take seconds to answer. Re-fetching the same provider/circle
 * lists on every tab switch made navigation feel like a website rather than a
 * native app, so reads go through here instead of straight to `fetch`.
 *
 * Two access patterns, deliberately different:
 *
 *  - `cached()` (used by api/client.js) returns a *fresh* entry synchronously
 *    and otherwise hits the network. It never resolves with stale data, so
 *    callers that simply `await getProviders()` keep their existing guarantees.
 *  - `peek()` (used by hooks/useResource.js) returns whatever is in the store
 *    including stale entries, so a screen can paint from the last known data
 *    on the first render and swap in the revalidated result when it lands.
 *
 * Entries survive an app close via localStorage, because Telegram tears the
 * WebView down aggressively and re-opening the Mini App is the single most
 * common navigation in the product.
 */

// Bump when a cached payload's shape changes; old entries are then ignored.
const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = `wc_cache:v${SCHEMA_VERSION}:`;
const SCOPE_KEY = 'wc_cache_scope';

// A single oversized entry can blow the whole localStorage budget and start
// evicting auth tokens, so anything bigger than this stays memory-only.
const MAX_PERSISTED_BYTES = 192 * 1024;

// Mock mode serves generated data that must not outlive a session, and tests
// would otherwise inherit a warm cache from a previous run.
const PERSIST = import.meta.env.VITE_USE_MOCK !== 'true';

/**
 * Freshness windows in ms, keyed by cache namespace (the part of a key before
 * `|`). Lists and their detail records share a namespace so that invalidating
 * after a mutation — `invalidate('communities')` when the user joins one —
 * clears both in a single call.
 */
export const TTL = {
  // Marketplace content changes rarely and reads the same for every user.
  providers: 5 * 60_000,
  products: 5 * 60_000,
  events: 5 * 60_000,
  ranks: 5 * 60_000,
  subscriptions: 10 * 60_000,
  // Membership-flavoured lists shift as the user joins and posts.
  communities: 2 * 60_000,
  circles: 2 * 60_000,
  challenges: 2 * 60_000,
  posts: 60_000,
  profile: 2 * 60_000,
  followers: 2 * 60_000,
  home: 60_000,
  // Anything the user can change from inside the app in a single tap.
  me: 30_000,
  points: 30_000,
  leaderboard: 30_000,
  bookings: 30_000,
  redemptions: 30_000,
  notifications: 30_000,
  social: 30_000,
  trainer: 30_000,
  strava: 60_000,
  // Provider dashboard/portal reads — heavy queries, viewed in long sessions.
  'provider-me': 60_000,
  // Just under the header's 30s poll, so route changes are free but each
  // scheduled poll still reaches the server.
  unread: 25_000,
};

const DEFAULT_TTL = 60_000;

/** In-memory store: key → { data, ts }. Authoritative; localStorage mirrors it. */
const memory = new Map();
/** De-duplicates concurrent requests for the same key across components. */
const inflight = new Map();
/** key → Set<listener>, so useResource can re-render on background refresh. */
const listeners = new Map();
/** Keys already looked up in localStorage, so a miss is only paid for once. */
const hydrated = new Set();

function ttlFor(key) {
  const namespace = key.split('|')[0];
  return TTL[namespace] ?? DEFAULT_TTL;
}

function storageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some embedded WebViews throw on storage access rather than returning null.
    return null;
  }
}

/**
 * Pull one key out of localStorage the first time it's asked for. Hydrating
 * lazily rather than reading every entry at boot keeps startup off the
 * main-thread-blocking synchronous storage API.
 */
function hydrate(key) {
  if (hydrated.has(key) || memory.has(key)) return;
  hydrated.add(key);
  if (!PERSIST) return;

  const store = safeStorage();
  if (!store) return;
  try {
    const raw = store.getItem(storageKey(key));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number') {
      memory.set(key, { data: parsed.data, ts: parsed.ts });
    }
  } catch {
    // Corrupt or unreadable entry — treat as a miss.
  }
}

function persist(key, entry) {
  if (!PERSIST) return;
  const store = safeStorage();
  if (!store) return;

  let serialized;
  try {
    serialized = JSON.stringify(entry);
  } catch {
    return; // Non-serializable payload (Blob, circular) — memory-only.
  }
  if (serialized.length > MAX_PERSISTED_BYTES) return;

  try {
    store.setItem(storageKey(key), serialized);
  } catch {
    // Out of quota: drop every cache entry and retry once. Losing the cache is
    // recoverable, losing the auth token in `wc_token` is not, so only our own
    // prefix is ever removed.
    dropPersisted();
    try {
      store.setItem(storageKey(key), serialized);
    } catch {
      /* give up — memory cache still works */
    }
  }
}

function dropPersisted() {
  const store = safeStorage();
  if (!store) return;
  const doomed = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith('wc_cache:')) doomed.push(key);
  }
  doomed.forEach(key => store.removeItem(key));
}

function notify(key, data) {
  const subs = listeners.get(key);
  if (!subs) return;
  subs.forEach(fn => {
    try {
      fn(data);
    } catch {
      /* a broken subscriber must not break the others */
    }
  });
}

/** Store a value and wake up anything rendering it. */
export function write(key, data) {
  const entry = { data, ts: Date.now() };
  memory.set(key, entry);
  hydrated.add(key);
  persist(key, entry);
  notify(key, data);
}

/**
 * Read whatever is stored, fresh or not.
 * @returns {{data: any, ts: number, stale: boolean}|null}
 */
export function peek(key, ttl) {
  hydrate(key);
  const entry = memory.get(key);
  if (!entry) return null;
  const maxAge = ttl ?? ttlFor(key);
  return { data: entry.data, ts: entry.ts, stale: Date.now() - entry.ts > maxAge };
}

/**
 * Fetch through the cache. Resolves immediately from a fresh entry, joins an
 * in-flight request for the same key, and otherwise calls `fetcher`.
 *
 * @param {string} key      Namespaced cache key, e.g. `providers|category=gym`.
 * @param {() => Promise<any>} fetcher
 * @param {{ttl?: number, force?: boolean}} [options]
 */
export function cached(key, fetcher, { ttl, force = false } = {}) {
  if (!force) {
    const hit = peek(key, ttl);
    if (hit && !hit.stale) return Promise.resolve(hit.data);

    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const request = fetcher()
    .then(data => {
      write(key, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/**
 * Drop cached data. Pass an exact key, or a `namespace|` / `namespace` prefix
 * to clear a whole family after a mutation (e.g. `invalidate('communities')`
 * once the user joins one).
 */
export function invalidate(prefix) {
  const match = (key) => key === prefix || key.startsWith(`${prefix}|`);

  for (const key of [...memory.keys()]) {
    if (match(key)) {
      memory.delete(key);
      hydrated.delete(key);
    }
  }
  inflight.forEach((_, key) => { if (match(key)) inflight.delete(key); });

  const store = safeStorage();
  if (!store) return;
  const doomed = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(STORAGE_PREFIX) && match(key.slice(STORAGE_PREFIX.length))) {
      doomed.push(key);
    }
  }
  doomed.forEach(key => store.removeItem(key));
}

/** Subscribe to background refreshes of `key`. Returns an unsubscribe fn. */
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => {
    const subs = listeners.get(key);
    if (!subs) return;
    subs.delete(fn);
    if (subs.size === 0) listeners.delete(key);
  };
}

/** Wipe everything, including persisted entries. */
export function clearAll() {
  memory.clear();
  inflight.clear();
  hydrated.clear();
  dropPersisted();
}

/**
 * Bind the cache to a user. Cached payloads carry per-user state (points,
 * `user_joined` flags, subscription status), so a different account opening the
 * app on the same device must not inherit them.
 */
export function setCacheScope(scopeId) {
  const scope = scopeId ? String(scopeId) : '';
  const store = safeStorage();
  const previous = store ? store.getItem(SCOPE_KEY) : null;
  if (previous === scope) return;

  clearAll();
  if (!store) return;
  if (scope) store.setItem(SCOPE_KEY, scope);
  else store.removeItem(SCOPE_KEY);
}

/** Build a stable cache key from a namespace and a params object. */
export function keyOf(namespace, params) {
  if (params === undefined || params === null) return namespace;
  if (typeof params !== 'object') return `${namespace}|${params}`;

  const parts = Object.keys(params)
    .sort()
    .filter(name => params[name] !== undefined && params[name] !== null && params[name] !== '')
    .map(name => `${name}=${params[name]}`);
  return parts.length ? `${namespace}|${parts.join('&')}` : namespace;
}
