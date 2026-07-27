import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  authTelegram, setToken, getMe, onboardUser as apiOnboard,
  updateProfile as apiUpdate, joinCircleByCode, cacheKeys,
} from '../api/client';
import { peek, write, invalidate, setCacheScope, clearAll as clearCache } from '../api/cache';
import { showToast } from '../components/Toast';
import { initAnalytics, identifyUser, track } from '../analytics';

const AuthContext = createContext(null);

/**
 * Recover the previous session synchronously, before the first render.
 *
 * Only ever returns a user that the cache already holds for this device, and
 * the caller always re-authenticates afterwards — so a revoked or expired
 * token is caught within one round trip, it just doesn't hold up the paint.
 */
function restoreSession() {
  if (typeof window === 'undefined') return null;
  // The provider website runs its own Telegram-Login-Widget session and must
  // never adopt a Mini App one.
  if (window.location.pathname.startsWith('/provider-portal')) return null;

  let savedToken = null;
  try {
    savedToken = localStorage.getItem('wc_token');
  } catch {
    return null;
  }
  if (!savedToken) return null;

  const hit = peek(cacheKeys.me(), Infinity);
  const cachedUser = hit?.data;
  if (!cachedUser?.id) return null;

  // Guard against a second Telegram account opening the app on the same
  // device: initData names the account before we authenticate, so a mismatch
  // means the cached session belongs to someone else.
  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (telegramId && String(cachedUser.telegram_id) !== String(telegramId)) return null;

  setToken(savedToken);
  return { token: savedToken, user: cachedUser };
}

/** Bind the cache to this user and seed it with the freshest user record. */
function applySession(nextUser) {
  if (!nextUser?.id) return;
  setCacheScope(nextUser.id);
  write(cacheKeys.me(), nextUser);
}

export function AuthProvider({ children }) {
  // Re-opening the Mini App is the most common navigation in the product, and
  // `POST /auth/telegram` against a cold serverless function is the slowest
  // thing on the critical path. If the last session's user is still cached,
  // render as that user immediately and re-authenticate underneath — the
  // request still runs, it just no longer blocks first paint.
  const restored = useRef(restoreSession()).current;

  const [user, setUser] = useState(restored?.user ?? null);
  const [loading, setLoading] = useState(!restored);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const handledStartParam = useRef(false);

  const login = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      let initData = window.Telegram?.WebApp?.initData;
      
      // If we are testing outside Telegram and have a saved token, try to restore session
      if (!initData) {
        const savedToken = localStorage.getItem('wc_token');
        if (savedToken) {
          setToken(savedToken);
          try {
            const u = await getMe();
            applySession(u);
            setUser(u);
            identifyUser(u);
            track('app_open', { entry: 'saved_token' });
            return { token: savedToken, user: u };
          } catch {
            localStorage.removeItem('wc_token');
            setToken(null);
            clearCache();
          }
        }
        initData = 'mock-init-data';
      }

      const res = await authTelegram(initData);
      localStorage.setItem('wc_token', res.token);
      setToken(res.token);
      applySession(res.user);
      setUser(res.user);
      identifyUser(res.user);
      track('app_open', { entry: initData === 'mock-init-data' ? 'browser' : 'telegram' });
      return res;
    } catch (err) {
      // The page is restricted to load only inside Telegram (see
      // authTelegram() in api/client.js) — track blocked attempts as their
      // own event so they're visible in PostHog instead of going dark,
      // rather than as a failed app_open (no session ever started).
      if (err.code === 'TELEGRAM_INIT_DATA_MISSING') {
        track('blocked_non_telegram_access');
      }
      // A restored session is already on screen. A transient network failure
      // shouldn't replace a working app with an error card — only a rejected
      // credential should, and that path tears the session down.
      if (background && err.status !== 401 && err.status !== 403) {
        throw err;
      }
      if (background) {
        localStorage.removeItem('wc_token');
        setToken(null);
        clearCache();
        setUser(null);
      }
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep links deliver start_param into the Mini App's initData:
  //  - E1: `?startapp=circle_{join_code}` → join the circle right after auth
  //  - Presale loop: `?startapp=reentry_promo_{provider_id}` (bot re-entry
  //    nudge) → track reentry_open and land on the promo's provider page
  const handleStartParam = useCallback(async () => {
    if (handledStartParam.current) return;
    handledStartParam.current = true;
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam) return;

    if (startParam.startsWith('reentry')) {
      const providerId = startParam.startsWith('reentry_promo_')
        ? startParam.slice('reentry_promo_'.length)
        : null;
      const isCheckinNudge = startParam === 'reentry_checkin';
      track('reentry_open', {
        source: 'bot_nudge',
        ...(isCheckinNudge ? { nudge: 'streak' } : {}),
        ...(providerId ? { provider_id: providerId } : {}),
      });
      if (providerId) navigate(`/provider/${providerId}`);
      else if (isCheckinNudge) navigate('/home'); // check-in card lives on Home
      return;
    }

    if (!startParam.startsWith('circle_')) return;
    const joinCode = startParam.slice('circle_'.length);
    try {
      const res = await joinCircleByCode(joinCode);
      showToast(`Joined ${res.name || 'circle'}!`, 'success');
      navigate(`/circle/${res.id}`);
    } catch {
      showToast('Invalid or expired invite link', 'error');
    }
  }, [navigate]);

  // Auth must run on every entry route (e.g. /admin from Telegram WebApp), not only on /
  // — except the provider website, which is a plain browser tab with its own
  // Telegram-Login-Widget session (ProviderPortalAuthContext) and must never
  // attempt Mini App initData auth, mock or otherwise.
  useEffect(() => {
    initAnalytics();
    if (window.location.pathname.startsWith('/provider-portal')) {
      setLoading(false);
      return;
    }
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }
    login({ background: Boolean(restored) }).then(() => handleStartParam()).catch(() => {});
  }, [login, handleStartParam, restored]);

  // Callers reach for this after an action that moved server-side state, so
  // it must bypass the cached user rather than echo it back.
  const refreshUser = useCallback(async () => {
    try {
      invalidate('me');
      const u = await getMe();
      applySession(u);
      setUser(u);
      return u;
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Screens optimistically patch the user after a check-in or a join. Writing
  // those patches through to the cache keeps the next app open consistent with
  // what the user last saw, instead of briefly rewinding to a pre-action state.
  const updateUser = useCallback((updater) => {
    setUser(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next) applySession(next);
      return next;
    });
  }, []);

  const onboard = useCallback(async (data) => {
    const res = await apiOnboard(data);
    updateUser(prev => ({ ...prev, ...res, is_onboarded: true }));
    return res;
  }, [updateUser]);

  const updateProfile = useCallback(async (data) => {
    const res = await apiUpdate(data);
    updateUser(prev => ({ ...prev, ...res }));
    return res;
  }, [updateUser]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('wc_token');
    // Cached responses carry this user's points, joined circles and
    // subscription state — none of it may survive into the next session.
    clearCache();
    setCacheScope(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, loading, error, login, refreshUser, onboard, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
