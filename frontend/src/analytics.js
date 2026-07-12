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
    capture_pageview: false, // we capture explicit events instead
    autocapture: false,
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
