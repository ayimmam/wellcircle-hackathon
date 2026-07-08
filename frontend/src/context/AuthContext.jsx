import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authTelegram, setToken, getMe, onboardUser as apiOnboard, updateProfile as apiUpdate, joinCircleByCode } from '../api/client';
import { showToast } from '../components/Toast';

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
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // E1: `https://t.me/{bot}?startapp=circle_{join_code}` deep links deliver
  // start_param into the Mini App's initData — join the circle right after auth.
  const handleStartParam = useCallback(async () => {
    if (handledStartParam.current) return;
    handledStartParam.current = true;
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam?.startsWith('circle_')) return;
    const joinCode = startParam.slice('circle_'.length);
    try {
      const res = await joinCircleByCode(joinCode);
      showToast(`Joined ${res.name || 'circle'}! 🎉`, '🤝');
      navigate(`/circle/${res.id}`);
    } catch {
      showToast('Invalid or expired invite link', '❌');
    }
  }, [navigate]);

  // Auth must run on every entry route (e.g. /admin from Telegram WebApp), not only on /
  useEffect(() => {
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
