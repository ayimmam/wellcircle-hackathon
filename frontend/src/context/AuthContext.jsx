import { createContext, useContext, useState, useCallback } from 'react';
import { authTelegram, setToken, getMe, onboardUser as apiOnboard, updateProfile as apiUpdate } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          const u = await getMe();
          setUser(u);
          return { token: savedToken, user: u };
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
