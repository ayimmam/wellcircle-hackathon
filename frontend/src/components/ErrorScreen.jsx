import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { errorVariant } from '../utils/errorState';
import './ErrorScreen.css';

const STATES = {
  unexpected: ['leaf', 'Something went wrong', 'We hit a snag loading this screen. Please try again.'],
  connection: ['smartphone', 'Let’s reconnect', 'We couldn’t reach Well Circle. Check your internet connection, then try again.'],
  timeout: ['clock', 'This is taking a little longer', 'The request took too long. Please give it another try.'],
  server: ['leaf', 'A little pause', 'We couldn’t load this right now. Please try again in a moment.'],
  session: ['lock', 'Let’s get you signed in again', 'Your session may have expired. Reopen Well Circle from Telegram to continue.'],
  auth: ['lock', 'Sign-in failed', 'We couldn’t sign you in. Open Well Circle inside Telegram, or retry in a moment.'],
  restricted: ['shield', 'This space is restricted', 'You may need to join this circle or use an account with access to continue.'],
  missing: ['search', 'We couldn’t find that', 'This content may have been removed, or the link may no longer be available.'],
  notFound: ['search', 'This page wandered off', 'The link may be out of date. Let’s get you back to Well Circle.'],
  busy: ['clock', 'Let’s take a short breather', 'There have been too many requests. Wait a little before trying again.'],
};

export default function ErrorScreen({ variant, error, title, description, onRetry, retryLabel = 'Try again', homeHref, children }) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const [icon, heading, message] = STATES[variant || errorVariant(error)] || STATES.unexpected;
  const retry = async () => {
    setRetrying(true);
    try { await onRetry(); } catch { /* The caller retains its error state for another attempt. */ }
    finally { setRetrying(false); }
  };
  const openSupport = event => {
    const telegram = window.Telegram?.WebApp;
    if (typeof telegram?.openTelegramLink !== 'function') return;
    try {
      telegram.openTelegramLink('https://t.me/well_circle');
      event.preventDefault();
    } catch { /* Keep the regular link available if the Telegram bridge fails. */ }
  };

  return (
    <section className="error-screen" role="alert">
      <div className="error-screen__card">
        <div className="error-screen__icon"><Icon name={icon} size={36} /></div>
        <p className="error-screen__eyebrow">Well Circle</p>
        <h2>{t(title || heading)}</h2>
        <p className="error-screen__description">{t(description || message)}</p>
        <div className="error-screen__actions">
          {onRetry && <button type="button" className="btn btn-secondary" onClick={retry} disabled={retrying} aria-busy={retrying}>
            {t(retrying ? 'Trying again…' : retryLabel)}
          </button>}
          {homeHref && <a className="btn btn-secondary" href={homeHref}>{t('Go back home')}</a>}
          <a className="btn btn-primary error-screen__support" href="https://t.me/well_circle" target="_blank" rel="noopener noreferrer" onClick={openSupport}>
            <Icon name="message-circle" size={18} />{t('Contact support')}
          </a>
        </div>
        <p className="error-screen__hint">{t('We’re here to help on Telegram.')}</p>
        {children}
      </div>
    </section>
  );
}
