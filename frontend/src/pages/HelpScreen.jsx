import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';

export default function HelpScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bot = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
  return <div className="page" id="help-screen">
    <h1 className="section-title">{t('Help & support')}</h1>
    <p className="text-secondary mb-20">{t('Your circles, bookings, points, rewards and wellness tools work in both the app and your browser.')}</p>
    <div className="card mb-16"><div className="card-body">
      <h2>{t('Telegram bot features')}</h2>
      <p className="text-secondary mb-16">{t('These features take place in your private chat with the Well Circle bot. Sign in with the same Telegram account to use your existing points and profile.')}</p>
      <ul>
        <li><strong>/pinbonus</strong> — {t('Pin the bot chat and claim your one-time 200-point bonus.')}</li>
        <li><strong>/evidence</strong> — {t('Designated staff can submit event participation photos for review.')}</li>
        <li><strong>/help</strong> — {t('See bot commands and get help.')}</li>
      </ul>
      <p className="text-secondary mt-12 mb-16">{t('Streak reminders and bot digests arrive in Telegram. Your in-app notifications are available on both versions.')}</p>
      <a className="btn btn-primary btn-block" href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer"><Icon name="send" size={18} /> {t('Open Well Circle bot')}</a>
    </div></div>
    <button className="btn btn-secondary btn-block mb-16" onClick={() => navigate('/notifications')}>{t('View notifications')}</button>
    <a className="btn btn-primary btn-block" style={{ borderRadius: 9999 }} href="https://t.me/well_circle" target="_blank" rel="noopener noreferrer"><Icon name="message-circle" size={18} /> {t('Contact support')}</a>
  </div>;
}
