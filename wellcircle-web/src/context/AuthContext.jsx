import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  setToken, getMe, onboardUser as apiOnboard,
  updateProfile as apiUpdate, joinCircleByCode, cacheKeys,
  authWhatsAppStart as apiWhatsAppStart,
  authWhatsAppVerify as apiWhatsAppVerify,
  authTelegramWidget as apiTelegramWidget,
  authGoogle as apiGoogle,
} from '../api/client';
import { peek, write, invalidate, setCacheScope, clearAll as clearCache } from '../api/cache';
import { showToast } from '../components/Toast';
import { initAnalytics, identifyUser, track } from '../analytics';

const AuthContext = createContext(null);

const PUBLIC_ROUTES = ['/', '/login', '/about'];

function restoreSession() {
  if (typeof window === 'undefined') return null;
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

  setToken(savedToken);
  return { token: savedToken, user: cachedUser };
}

function applySession(nextUser) {
  if (!nextUser?.id) return;
  setCacheScope(nextUser.id);
  write(cacheKeys.me(), nextUser);
}

export function AuthProvider({ children }) {
  const restored = useRef(restoreSession()).current;
  const [user, setUser] = useState(restored?.user ?? null);
  const [loading, setLoading] = useState(!restored && Boolean(localStorage.getItem('wc_token')));
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthSuccess = useCallback((res) => {
    localStorage.setItem('wc_token', res.token);
    setToken(res.token);
    applySession(res.user);
    setUser(res.user);
    identifyUser(res.user);
    track('web_login_success', { is_new_user: res.is_new_user });
    if (!res.user.is_onboarded) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/home', { replace: true });
    }
  }, [navigate]);

  const loginWithWhatsAppStart = useCallback(async (phone, channel = "whatsapp") => {
    setError(null);
    return apiWhatsAppStart(phone, channel);
  }, []);

  const loginWithWhatsAppVerify = useCallback(async (requestId, code) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiWhatsAppVerify(requestId, code);
      handleAuthSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleAuthSuccess]);

  const loginWithTelegram = useCallback(async (widgetData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiTelegramWidget(widgetData);
      handleAuthSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleAuthSuccess]);

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGoogle(credential);
      handleAuthSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleAuthSuccess]);

  // Initial load: verify token if present
  useEffect(() => {
    initAnalytics();
    const token = localStorage.getItem('wc_token');
    if (token) {
      setToken(token);
      getMe()
        .then(u => {
          applySession(u);
          setUser(u);
          identifyUser(u);
        })
        .catch(err => {
          if (err.status === 401 || err.status === 403) {
            localStorage.removeItem('wc_token');
            setToken(null);
            clearCache();
            setUser(null);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  // Check join code param in URL (e.g. ?join=ABC or /circle/id?join=ABC)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      joinCircleByCode(joinCode)
        .then(res => {
          showToast(`Joined ${res.name || 'circle'}!`, 'success');
          navigate(`/circle/${res.id}`);
        })
        .catch(() => {
          showToast('Invalid or expired invite link', 'error');
        });
    }
  }, [user, navigate]);

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
    clearCache();
    setCacheScope(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{
      user,
      setUser: updateUser,
      loading,
      error,
      loginWithWhatsAppStart,
      loginWithWhatsAppVerify,
      loginWithTelegram,
      loginWithGoogle,
      refreshUser,
      onboard,
      updateProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
