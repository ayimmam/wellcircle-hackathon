import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authTelegramWidget, setToken, getMe } from '../api/client';

// Provider website session — deliberately independent of AuthContext (the
// Mini App's Telegram-initData flow). Uses its own localStorage key so a
// provider's website session never collides with a Mini App session in the
// same browser profile.
const STORAGE_KEY = 'wc_provider_token';

const ProviderPortalAuthContext = createContext(null);

export function ProviderPortalAuthProvider({ children }) {
  const [providerUser, setProviderUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    getMe()
      .then(u => {
        if (!u.is_provider) throw new Error('Not a provider account');
        setProviderUser(u);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loginWithWidget = useCallback(async (widgetData) => {
    setError(null);
    try {
      const res = await authTelegramWidget(widgetData);
      localStorage.setItem(STORAGE_KEY, res.token);
      setToken(res.token);
      setProviderUser(res.user);
      return res.user;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setProviderUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProviderPortalAuthContext.Provider value={{ providerUser, loading, error, loginWithWidget, logout }}>
      {children}
    </ProviderPortalAuthContext.Provider>
  );
}

export function useProviderPortalAuth() {
  const ctx = useContext(ProviderPortalAuthContext);
  if (!ctx) throw new Error('useProviderPortalAuth must be used within ProviderPortalAuthProvider');
  return ctx;
}
