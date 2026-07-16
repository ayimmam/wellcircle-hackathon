import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authTelegram, setToken, getMe, onboardUser as apiOnboard, updateProfile as apiUpdate, joinCircleByCode } from '../api/client';
import { showToast } from '../components/Toast';
import { initAnalytics, identifyUser, track } from '../analytics';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const handledStartParam = useRef(false);

  const login = useCallback(async () => {
    setLoading(true);
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
            setUser(u);
            identifyUser(u);
            track('app_open', { entry: 'saved_token' });
            return { token: savedToken, user: u };
          } catch {
            localStorage.removeItem('wc_token');
            setToken(null);
          }
        }
        initData = 'mock-init-data';
      }

      const res = await authTelegram(initData);
      localStorage.setItem('wc_token', res.token);
      setToken(res.token);
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
  useEffect(() => {
    initAnalytics();
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }
    login().then(() => handleStartParam()).catch(() => {});
  }, [login, handleStartParam]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
      return u;
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const onboard = useCallback(async (data) => {
    const res = await apiOnboard(data);
    setUser(prev => ({ ...prev, ...res, is_onboarded: true }));
    return res;
  }, []);

  const updateProfile = useCallback(async (data) => {
    const res = await apiUpdate(data);
    setUser(prev => ({ ...prev, ...res }));
    return res;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('wc_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, login, refreshUser, onboard, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
