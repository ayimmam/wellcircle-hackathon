import { useEffect, useRef, useState } from 'react';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Reveals `true` after `ms` of *foreground* time have passed today, then
 * stays revealed for the rest of the day without re-timing — Home's
 * check-in card appearing 2 minutes into the session, once per day (WS4 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).
 *
 * Time spent with the tab/Telegram WebView backgrounded doesn't count,
 * mirroring usePolling's pause-on-hidden behavior — someone who opens the
 * app, switches away for an hour, and comes back hasn't "waited" for the
 * card.
 *
 * @param {string} key   Distinguishes multiple reveal timers sharing
 *                        localStorage, e.g. 'checkin'.
 * @param {number} [ms=120000]
 * @returns {boolean}
 */
export default function useDailyReveal(key, ms = 120000) {
  const storageKey = `wc_reveal_${key}`;

  const [revealed, setRevealed] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === todayKey();
    } catch {
      return false;
    }
  });

  // Foreground time banked across hidden/visible transitions, and the
  // timestamp the current foreground stretch started — refs because none of
  // this should trigger a re-render on its own.
  const elapsedRef = useRef(0);
  const foregroundSinceRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (revealed) return undefined;

    const reveal = () => {
      setRevealed(true);
      try { localStorage.setItem(storageKey, todayKey()); } catch { /* private mode etc. */ }
    };

    const startTimer = () => {
      foregroundSinceRef.current = Date.now();
      const remaining = ms - elapsedRef.current;
      timeoutRef.current = setTimeout(reveal, Math.max(remaining, 0));
    };

    const stopTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (foregroundSinceRef.current != null) {
        elapsedRef.current += Date.now() - foregroundSinceRef.current;
        foregroundSinceRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) stopTimer();
      else startTimer();
    };

    if (typeof document === 'undefined' || !document.hidden) startTimer();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revealed, ms, storageKey]);

  return revealed;
}
