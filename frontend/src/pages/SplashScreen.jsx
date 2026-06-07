import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Expand Telegram Mini App viewport
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.expand();
          window.Telegram.WebApp.ready();
        }

        const res = await login();

        if (cancelled) return;

        if (!res.user.is_onboarded) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/home', { replace: true });
        }
      } catch (err) {
        // Show an error toast so we know why it failed
        alert(`Auth Failed: ${err.message}`);
        if (!cancelled) navigate('/home', { replace: true });
      }
    }

    init();
    return () => { cancelled = true; };
  }, [login, navigate]);

  return (
    <div className="splash" id="splash-screen">
      <img src="/well.png" className="splash-logo" alt="Well Circle Logo" />
      <h1 className="splash-title">Well Circle</h1>
      <p className="splash-tagline">
        Your tribe, your wellness.<br />Right where you chat.
      </p>
      <div className="splash-spinner" />
    </div>
  );
}
