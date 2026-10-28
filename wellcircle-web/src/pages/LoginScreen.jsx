import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showToast } from '@shared/components/Toast';
import { prepareGoogleSignIn, signInWithGoogle, firebaseGoogleConfigured } from '../utils/firebaseGoogle';
import { prepareTelegramLogin, signInWithTelegram } from '../utils/telegramLogin';
import newLogo from '@shared/new_logo.png';


export default function LoginScreen() {
  const { loginWithFirebase, loginWithTelegram } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramReady, setTelegramReady] = useState(false);
  const [telegramSetupError, setTelegramSetupError] = useState(null);
  const [error, setError] = useState(null);
  const requestBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (firebaseGoogleConfigured) prepareGoogleSignIn().catch(() => {});
    prepareTelegramLogin().then(() => { if (mounted.current) setTelegramReady(true); }).catch(err => { if (mounted.current) setTelegramSetupError(err.message); });
    return () => { mounted.current = false; };
  }, []);

  const handleGoogleClick = async () => {
    if (requestBusy.current) return;
    requestBusy.current = true;
    setLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      if (!mounted.current) return;
      await loginWithFirebase(idToken);
      showToast('Welcome to Well Circle!', 'success');
    } catch (err) {
      if (mounted.current) setError(err.message || 'Google sign-in could not complete. Please try again.');
    } finally {
      requestBusy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const handleTelegramClick = async () => {
    if (requestBusy.current) return;
    requestBusy.current = true;
    setTelegramLoading(true);
    setError(null);
    try {
      const data = await signInWithTelegram();
      if (!mounted.current) return;
      await loginWithTelegram(data);
      showToast('Signed in with Telegram!', 'success');
    } catch (err) {
      if (mounted.current) setError(err.message || 'Telegram login failed. Please try again.');
    } finally {
      requestBusy.current = false;
      if (mounted.current) setTelegramLoading(false);
    }
  };

  const retryTelegramSetup = async () => {
    setTelegramSetupError(null);
    try { await prepareTelegramLogin(); if (mounted.current) setTelegramReady(true); }
    catch (err) { if (mounted.current) setTelegramSetupError(err.message); }
  };

  return (
    <div className="login-page" id="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src={newLogo} alt="Well Circle" className="login-logo" />
          <h1 className="login-title">Sign in to Well Circle</h1>
          <p className="login-sub">Your wellness tribe, accountability circles, and verified bookings in Addis Ababa.</p>
        </div>
        {location.state?.expired && <div className="login-alert warning">Your session has expired. Please sign in again to continue.</div>}
        {error && <div className="login-alert error" role="alert">{error}</div>}
        {!firebaseGoogleConfigured && <p className="login-alert warning" role="status">Google sign-in is not available yet. Please continue with Telegram.</p>}
        <div className="login-methods-container">
          <button type="button" className="btn btn-google btn-block btn-lg" id="login-google-btn" onClick={handleGoogleClick} disabled={loading || telegramLoading || !firebaseGoogleConfigured}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.36Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/>
              <path fill="#EA4335" d="M12 5.95c1.47 0 2.78.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z"/>
            </svg>
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
          <p className="login-sub">Use your Gmail or Google account to sign in.</p>
          <div className="login-divider"><span>or continue with Telegram</span></div>
          <button type="button" className="btn btn-telegram btn-block btn-lg" onClick={handleTelegramClick} disabled={telegramLoading || loading || !telegramReady} id="login-telegram-btn">
            <span>{telegramLoading ? 'Connecting to Telegram...' : 'Continue with Telegram'}</span>
          </button>
          <p className="login-sub">Confirm your account on Telegram’s secure login page when prompted.</p>
          {telegramSetupError && <div role="status"><p>{telegramSetupError}</p><button type="button" className="btn-link" onClick={retryTelegramSetup}>Retry Telegram login</button></div>}
        </div>
        <button type="button" className="btn btn-secondary btn-block mt-16" onClick={() => navigate('/help')}>Help & support</button>
        <div className="login-footer-terms">By continuing, you agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the <Link to="/privacy">Privacy Policy</Link>.</div>
      </div>
    </div>
  );
}
