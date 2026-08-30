// PostHog analytics wrapper. All calls are safe no-ops when VITE_POSTHOG_KEY
// is unset (local dev, tests, mock mode) so screens never need to guard.
//
// posthog-js is the largest third-party dependency in the app and nothing on
// screen depends on it, so it is imported dynamically after the first paint
// rather than bundled into the startup path. Events fired before it finishes
// loading are queued and replayed, so callers never have to think about it.
const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthog = null;
let enabled = false;
let loading = null;
/** Calls made before the SDK lands, replayed in order once it does. */
const queue = [];

function flushQueue() {
  while (queue.length) {
    const run = queue.shift();
    try {
      run();
    } catch {
      /* never let a queued analytics call break the app */
    }
  }
}

/**
 * Load the SDK when the browser is otherwise idle, so it competes with neither
 * the first paint nor the auth request behind it.
 */
function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 3000 });
  else setTimeout(fn, 1200);
}

export function initAnalytics() {
  if (!KEY || loading) return;
  loading = new Promise(resolve => {
    whenIdle(async () => {
      try {
        const module = await import('posthog-js');
        posthog = module.default;
        startPosthog();
        flushQueue();
      } catch {
        // Analytics is best-effort; a blocked or failed load is not an error
        // the user should ever see. Drop anything queued so it can't leak.
        queue.length = 0;
      }
      resolve();
    });
  });
}

function startPosthog() {
  posthog.init(KEY, {
    api_host: HOST,
    // Telegram WebView: no cookies — keep identity in localStorage
    persistence: 'localStorage',
    // Auto-capture $pageview (incl. react-router's pushState navigation) and
    // autocaptured clicks, so PostHog's default funnel/insight templates work
    // out of the box — this is additive to the explicit track() calls below,
    // not a replacement for them.
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    // Telegram can suspend/destroy the WebView the instant a user backgrounds
    // or closes the Mini App, without reliably firing pagehide/unload — the
    // default 3s batch flush loses events in that window, so flush at the
    // SDK's minimum interval instead of trusting the unload handler.
    flush_interval_ms: 250,
    // Telegram passes its signed initData (auth_date, user info, hash) via the
    // URL hash fragment (#tgWebAppData=...) — strip it before any event
    // property leaves the device, so a signed auth payload never lands in a
    // third-party analytics tool.
    sanitize_properties: (properties) => {
      if (typeof properties.$current_url === 'string') {
        properties.$current_url = properties.$current_url.split('#')[0];
      }
      return properties;
    },
  });
  enabled = true;
}

/** Run now if the SDK is up, otherwise replay once it loads. */
function whenReady(fn) {
  if (enabled) fn();
  else if (loading) queue.push(fn);
}

export function identifyUser(user) {
  if (!user?.id) return;
  whenReady(() => posthog.identify(String(user.telegram_id || user.id), {
    name: user.name,
    neighborhood: user.location_neighborhood,
  }));
}

export function track(event, properties = {}) {
  // `app_open` and the deep-link events fire during startup, before the SDK
  // has been fetched — queueing is what keeps them out of the funnel's blind
  // spot now that the import is deferred.
  whenReady(() => posthog.capture(event, properties));
}

/**
 * Reads a PostHog feature flag / experiment variant. Calling this (rather
 * than reading the flag some other way) is what fires PostHog's
 * `$feature_flag_called` event, which experiments use for their default
 * "Include people when: Feature flag is called" inclusion criteria — so
 * every flag read should go through this function, not a raw posthog call.
 * Falls back to `fallback` ("control" by default) when analytics is
 * disabled (local dev, tests, mock mode) or flags haven't loaded yet, so
 * callers always render the pre-experiment behavior in those cases.
 */
export function getFeatureFlag(key, fallback = 'control') {
  if (!enabled) return fallback;
  return posthog.getFeatureFlag(key) ?? fallback;
}

/** Re-invokes `callback` once PostHog's flags have (re)loaded, so a variant
 * read at mount time (before flags are ready) can be corrected shortly
 * after. No-op when analytics is disabled. */
export function onFeatureFlags(callback) {
  if (enabled) return posthog.onFeatureFlags(callback) || (() => {});
  if (!loading) return () => {};

  // The SDK is still downloading. Subscribe as soon as it arrives, unless the
  // component unmounted in the meantime.
  let unsubscribe = null;
  let cancelled = false;
  queue.push(() => {
    if (cancelled) return;
    unsubscribe = posthog.onFeatureFlags(callback) || null;
  });
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
