import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  setToken, getMe, onboardUser as apiOnboard,
  updateProfile as apiUpdate, joinCircleByCode, cacheKeys,
  authFirebase as apiFirebase,
  authTelegramWidget as apiTelegramWidget,
  authGoogle as apiGoogle,
} from '@shared/api/client';
import { peek, write, invalidate, setCacheScope, clearAll as clearCache } from '@shared/api/cache';
import { showToast } from '@shared/components/Toast';
import { initAnalytics, identifyUser, track } from '@shared/analytics';

const AuthContext = createContext(null);

import { SESSION_EXPIRED_EVENT } from '@shared/utils/platform';
import { takePostRedirect } from '../utils/session';
import { clearGoogleSignIn } from '../utils/firebaseGoogle';

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
  const joinedInvite = useRef(null);
  const locationRef = useRef(location);
  locationRef.current = location;

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
      const postRedirect = takePostRedirect();
      navigate(postRedirect || '/home', { replace: true });
    }
  }, [navigate]);

  const loginWithFirebase = useCallback(async (idToken) => {
    setError(null);
    try {
      const res = await apiFirebase(idToken);
      handleAuthSuccess(res);
      clearGoogleSignIn();
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [handleAuthSuccess]);

  const loginWithTelegram = useCallback(async (widgetData) => {
    setError(null);
    try {
      const res = await apiTelegramWidget(widgetData);
      handleAuthSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
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

  useEffect(() => {
    const expire = () => {
      localStorage.removeItem('wc_token');
      setToken(null);
      clearCache();
      setCacheScope(null);
      setUser(null);
      const current = locationRef.current;
      if (!['/', '/login', '/landing'].includes(current.pathname)) {
        sessionStorage.setItem('wc_post_redirect', current.pathname + current.search + current.hash);
      }
      navigate('/login', { replace: true, state: { expired: true } });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [navigate]);

  // Initial load: verify token if present
  useEffect(() => {
    initAnalytics();
    if (locationRef.current.pathname.startsWith('/provider-portal')) { setLoading(false); return; }
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
          if (err.status === 401) {
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

  // A protected invite URL is saved before login; consume it only after onboarding.
  useEffect(() => {
    if (!user?.is_onboarded) return;
    const joinCode = new URLSearchParams(location.search).get('join');
    if (!joinCode || joinedInvite.current === joinCode) return;
    joinedInvite.current = joinCode;
    joinCircleByCode(joinCode)
      .then(res => {
        showToast(`Joined ${res.name || 'circle'}!`, 'success');
        navigate(`/circle/${res.id}`, { replace: true });
      })
      .catch(() => {
        joinedInvite.current = null;
        showToast('Invalid or expired invite link', 'error');
      });
  }, [user?.is_onboarded, location.pathname, location.search, navigate]);

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
    return { ...res, redirectTo: takePostRedirect() };
  }, [updateUser]);

  const updateProfile = useCallback(async (data) => {
    const res = await apiUpdate(data);
    updateUser(prev => ({ ...prev, ...res }));
    return res;
  }, [updateUser]);

  const logout = useCallback(() => {
    clearGoogleSignIn();
    setUser(null);
    setToken(null);
    localStorage.removeItem('wc_token');
    sessionStorage.removeItem('wc_post_redirect');
    joinedInvite.current = null;
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
      login: () => navigate('/login'),
      loginWithFirebase,
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
