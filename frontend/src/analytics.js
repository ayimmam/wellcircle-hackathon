// PostHog analytics wrapper. All calls are safe no-ops when VITE_POSTHOG_KEY
// is unset (local dev, tests, mock mode) so screens never need to guard.
import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let enabled = false;

export function initAnalytics() {
  if (!KEY || enabled) return;
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

export function identifyUser(user) {
  if (!enabled || !user?.id) return;
  posthog.identify(String(user.telegram_id || user.id), {
    name: user.name,
    neighborhood: user.location_neighborhood,
  });
}

export function track(event, properties = {}) {
  if (!enabled) return;
  posthog.capture(event, properties);
}
