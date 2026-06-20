import { useEffect, useRef } from 'react';

/**
 * Run `callback` on an interval, but only while the app is in the foreground.
 *
 * On free-tier hosting, every poll can wake a cold serverless function, so we
 * pause polling whenever the tab/Telegram WebView is hidden and resume (with an
 * immediate refresh) when the user comes back.
 *
 * @param {() => void} callback   Work to run each tick (errors should be handled inside).
 * @param {number} intervalMs     Delay between ticks.
 * @param {boolean} [active=true] When false, no polling happens at all.
 */
export default function usePolling(callback, intervalMs, active = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!active) return undefined;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      savedCallback.current();
    };

    const interval = setInterval(tick, intervalMs);
    const onVisible = () => { if (!document.hidden) savedCallback.current(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, active]);
}
