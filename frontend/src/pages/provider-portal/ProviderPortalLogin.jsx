import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderPortalAuth } from '../../context/ProviderPortalAuthContext';
import { showToast } from '../../components/Toast';
import { providerPortalBase } from '../../utils/providerPortal';
import newLogo from '../../new_logo.png';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
// Same bot username used for circle invite deep links (utils/circleInvite.js)
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

export default function ProviderPortalLogin() {
  const { providerUser, loginWithWidget } = useProviderPortalAuth();
  const navigate = useNavigate();
  const widgetContainerRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (providerUser) navigate(`${providerPortalBase()}/overview`, { replace: true });
  }, [providerUser, navigate]);

  const handleWidgetAuth = async (telegramUser) => {
    setSubmitting(true);
    try {
      await loginWithWidget(telegramUser);
      navigate(`${providerPortalBase()}/overview`, { replace: true });
    } catch (err) {
      showToast(err.message || 'Login failed — is this Telegram account linked to a provider?', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Real Telegram Login Widget — needs this domain registered with
  // BotFather (/setdomain) and HTTPS; it won't render on localhost.
  useEffect(() => {
    if (USE_MOCK || !BOT_USERNAME || !widgetContainerRef.current) return;

    window.onWellCircleProviderAuth = handleWidgetAuth;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onWellCircleProviderAuth(user)');
    script.setAttribute('data-request-access', 'write');
    widgetContainerRef.current.appendChild(script);

    return () => {
      delete window.onWellCircleProviderAuth;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMockLogin = () => {
    handleWidgetAuth({
      id: 100000001,
      first_name: 'Demo',
      username: 'demo_provider',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'mock',
    });
  };

  return (
    <div className="page" id="provider-portal-login" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', paddingTop: '15vh' }}>
      <img src={newLogo} alt="Well Circle" style={{ width: 72, height: 72, marginBottom: 16 }} />
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>Well Circle for Providers</h1>
      <p className="text-sm text-secondary mb-24">Sign in with Telegram to manage your dashboard.</p>

      {USE_MOCK ? (
        <button className="btn btn-primary" disabled={submitting} onClick={handleMockLogin}>
          {submitting ? 'Signing in…' : 'Continue as Demo Provider'}
        </button>
      ) : BOT_USERNAME ? (
        <div ref={widgetContainerRef} style={{ display: 'flex', justifyContent: 'center' }} />
      ) : (
        <p className="text-sm" style={{ color: 'var(--danger, #ef4444)' }}>
          Provider login isn't configured yet — set VITE_TELEGRAM_BOT_USERNAME.
        </p>
      )}

      <p className="text-xs text-secondary mt-24">
        Only Telegram accounts already linked to an approved provider can sign in here.
      </p>
    </div>
  );
}
