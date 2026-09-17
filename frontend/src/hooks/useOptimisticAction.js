import { useCallback, useRef } from 'react';
import { showToast } from '../components/Toast';
import { logIssue } from '../utils/log';

/**
 * The shared shape behind every "tap it, see it happen, no spinner" action
 * in the app (WS7 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md): apply the
 * expected result to local/cached state synchronously, fire the request in
 * the background, and either reconcile with the server's answer or roll
 * back and say one short thing if it fails.
 *
 * Usage:
 *   const run = useOptimisticAction();
 *   run({
 *     apply: () => { setLiked(true); return () => setLiked(false); },
 *     request: () => api.likePost(id),
 *     reconcile: (serverResult) => setLikeCount(serverResult.count),
 *     failureMessage: "Couldn't like that — try again",
 *   });
 *
 * - `apply()` runs synchronously and returns an `undo` function (or
 *   undefined if there's nothing to undo).
 * - `request()` runs in the background. Its return value, if any, goes to
 *   `reconcile`.
 * - On rejection: `undo()` runs, `failureMessage` shows once via
 *   `showToast` (the one user-visible message a rolled-back action gets —
 *   see WS10's noise rule), and the error is logged. Pass a falsy
 *   `failureMessage` to fail silently (still logged).
 * - Returns a promise that resolves to `{ ok: true, result }` or
 *   `{ ok: false, error }` — most callers can ignore it; it exists for the
 *   rare caller that needs to know when the background request actually
 *   settles.
 */
export default function useOptimisticAction() {
  // Tracks in-flight actions by an optional `key` so a caller that wants to
  // ignore a double-tap on the same target (not block the tap, just not
  // fire it twice) can pass one — see the `dedupeKey` option.
  const inFlight = useRef(new Set());

  return useCallback(async ({ apply, request, reconcile, failureMessage, dedupeKey }) => {
    if (dedupeKey != null) {
      if (inFlight.current.has(dedupeKey)) return { ok: false, error: null, skipped: true };
      inFlight.current.add(dedupeKey);
    }

    const undo = apply?.();

    try {
      const result = await request();
      reconcile?.(result);
      return { ok: true, result };
    } catch (error) {
      undo?.();
      if (failureMessage) showToast(failureMessage, 'error');
      logIssue('optimistic_action_failed', { message: error?.message, dedupeKey });
      return { ok: false, error };
    } finally {
      if (dedupeKey != null) inFlight.current.delete(dedupeKey);
    }
  }, []);
}
