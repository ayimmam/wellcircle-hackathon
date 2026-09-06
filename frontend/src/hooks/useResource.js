import { useCallback, useEffect, useRef, useState } from 'react';
import { peek, subscribe, invalidate } from '../api/cache';

/**
 * Read an API resource with a stale-while-revalidate render.
 *
 * The screen paints from the last known value on its very first render — no
 * spinner, no layout shift — and swaps in the revalidated data when it lands.
 * `loading` is therefore only true on a genuine cold miss, which is what makes
 * a tab switch feel instant instead of like a page load.
 *
 * `fetcher` must be one of the cached readers in api/client.js: those already
 * write to the same cache key, so a fresh entry short-circuits the network and
 * concurrent callers share a single request.
 *
 * @param {string|null} key      Cache key the fetcher writes to; null disables the hook.
 * @param {() => Promise<any>} fetcher
 * @param {{enabled?: boolean, initialData?: any, select?: (d: any) => any,
 *          refreshOnFocus?: boolean, onError?: (e: Error) => void}} [options]
 */
export default function useResource(key, fetcher, options = {}) {
  const {
    enabled = true,
    initialData,
    select,
    refreshOnFocus = true,
    onError,
  } = options;

  // Inline arrows and callbacks are re-created every render; keeping them in
  // refs means the effect below depends only on `key`, so a parent re-render
  // can't turn into a refetch loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const selectRef = useRef(select);
  selectRef.current = select;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const readCache = useCallback((cacheKey) => {
    if (!cacheKey) return undefined;
    const hit = peek(cacheKey);
    if (!hit) return undefined;
    return selectRef.current ? selectRef.current(hit.data) : hit.data;
  }, []);

  const [data, setData] = useState(() => {
    const hit = readCache(key);
    return hit === undefined ? initialData : hit;
  });
  const [loading, setLoading] = useState(() => enabled && readCache(key) === undefined);
  const [error, setError] = useState(null);

  const load = useCallback(async (cacheKey, { force = false } = {}) => {
    if (!cacheKey) return undefined;
    const hadCached = readCache(cacheKey) !== undefined;
    if (!hadCached) setLoading(true);
    try {
      if (force) invalidate(cacheKey);
      const result = await fetcherRef.current();
      const next = selectRef.current ? selectRef.current(result) : result;
      setData(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err);
      onErrorRef.current?.(err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [readCache]);

  useEffect(() => {
    if (!enabled || !key) {
      setLoading(false);
      return undefined;
    }

    // Paint the cached value for this key before the request resolves. On a
    // key change (a new filter, a different id) this is what replaces the
    // previous screen's data instead of leaving it stranded.
    const hit = readCache(key);
    setData(hit === undefined ? initialData : hit);
    setLoading(hit === undefined);

    let alive = true;
    // Another component may share this key; adopt its result rather than
    // issuing a second request.
    const unsubscribe = subscribe(key, (fresh) => {
      if (!alive) return;
      setData(selectRef.current ? selectRef.current(fresh) : fresh);
      setLoading(false);
    });

    load(key);

    return () => {
      alive = false;
      unsubscribe();
    };
    // `initialData` is intentionally excluded: callers pass literals like `[]`,
    // which change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, load, readCache]);

  // Telegram suspends the WebView when the user switches chats. Coming back to
  // a screen showing minutes-old data is the one place stale-while-revalidate
  // is noticeable, so re-check on return.
  useEffect(() => {
    if (!refreshOnFocus || !enabled || !key) return undefined;
    const onVisible = () => {
      if (document.hidden) return;
      const hit = peek(key);
      if (!hit || hit.stale) load(key);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [key, enabled, refreshOnFocus, load]);

  const refresh = useCallback(() => load(key, { force: true }), [key, load]);

  return { data, loading, error, refresh, setData };
}
