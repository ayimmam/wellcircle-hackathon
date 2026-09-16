// A quiet place for issues that are real but not the user's business — a
// timed-out request, a background refresh that failed, an empty toast call
// somewhere. `showToast` used to be the app's only recourse ("This is taking
// longer than usual…"), which is diagnostic text with no action a user can
// take. `logIssue` is the replacement: it always goes to the console, and
// goes to PostHog too when analytics is configured (`track()` is already a
// safe no-op otherwise, so this file doesn't need its own enabled check).
import { track } from '../analytics';

/**
 * @param {string} kind short machine-readable category, e.g. 'timeout',
 *   'offline', 'empty_toast'
 * @param {object} [detail] extra context — path, status, request_id,
 *   duration_ms, whatever is available. Never put PII here.
 */
export function logIssue(kind, detail = {}) {
  console.error(`[WellCircle] ${kind}`, detail);
  track('client_issue', { kind, path: typeof location !== 'undefined' ? location.pathname : undefined, ...detail });
}
