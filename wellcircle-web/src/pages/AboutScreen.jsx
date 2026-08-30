import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/auth';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import Icon from '../components/Icon';

// The four things a first-time user has to understand before anything else in
// the app makes sense. Ordered as the loop is actually lived, not as the data
// model is shaped: you join people first, show up second, earn third, book
// last — which is also the order that gets someone to a booking fastest.
const HOW_IT_WORKS = [
  {
    icon: 'users',
    title: 'Join a circle',
    body: 'Circles are small groups around a gym, studio, or spa. You see what other members are doing and they see you.',
  },
  {
    icon: 'check',
    title: 'Check in daily',
    body: 'One tap on the days you show up. Consecutive days build a streak, and your circle sees it.',
  },
  {
    icon: 'coins',
    title: 'Earn Legacy Points',
    body: 'Check-ins, streaks, and bookings earn points. Points move you up tiers and buy real rewards in the Points Store.',
  },
  {
    icon: 'calendar',
    title: 'Book and show up',
    body: 'Book sessions and events with verified providers around Addis. Members-only promotions apply automatically at checkout.',
  },
];

function Row({ icon, title, sub, onClick, id }) {
  return (
    <button className="about-row" onClick={onClick} id={id} type="button">
      <span className="about-row-icon"><Icon name={icon} size={20} /></span>
      <span className="about-row-text">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <Icon name="chevron-right" size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </button>
  );
}

export default function AboutScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  useTelegramBackButton(() => navigate('/home'));

  const appVersion = import.meta.env.VITE_APP_VERSION || null;

  return (
    <div className="page" id="about-screen">
      <div className="about-hero">
        <img src="/well.png" className="about-logo" alt="" aria-hidden="true" />
        <h1 className="about-title">{t('Well Circle')}</h1>
        <p className="about-tagline">{t('Your wellness tribe')}</p>
        <p className="about-lede">
          Well Circle is where wellness in Addis Ababa stops being something you do alone.
          Join a circle around a gym, studio, or spa you like, check in on the days you show up,
          and book sessions with providers we have verified — all inside Telegram, with no separate
          app to install.
        </p>
      </div>

      <div className="profile-section">
        <div className="profile-section-title">{t('How it works')}</div>
        <div className="about-steps">
          {HOW_IT_WORKS.map((step, i) => (
            <div className="about-step" key={step.title}>
              <span className="about-step-num">{i + 1}</span>
              <span className="about-step-icon"><Icon name={step.icon} size={18} /></span>
              <div>
                <div className="about-step-title">{t(step.title)}</div>
                <p className="about-step-body">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-title">{t('Get started')}</div>
        <div className="about-rows">
          <Row
            icon="search"
            title="Find a provider"
            sub="Gyms, studios, spas and trainers near you"
            onClick={() => navigate('/explore')}
            id="about-explore-row"
          />
          <Row
            icon="users"
            title="Browse circles"
            sub="Find your people and start a streak"
            onClick={() => navigate('/community')}
            id="about-circles-row"
          />
          <Row
            icon="calendar"
            title="See what's on"
            sub="Upcoming events across the city"
            onClick={() => navigate('/events')}
            id="about-events-row"
          />
        </div>
      </div>

      {/* Provider pitch — a rare, one-time action for a small slice of users,
          so it lives here rather than taking a permanent slot in the menu. */}
      <div className="profile-section">
        <div className="profile-section-title">{t('For businesses')}</div>
        <div className="about-provider-card">
          <span className="about-provider-icon"><Icon name="store" size={22} /></span>
          <h3 className="about-provider-title">{t('Run a wellness business?')}</h3>
          <p className="about-provider-body">
            List your gym, studio, or spa on Well Circle. Get bookings from an audience that
            already shows up, run members-only promotions, and manage it all from a dashboard.
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/provider-onboard')}
            id="about-become-provider-btn"
          >
            {t('List your business')}
          </button>
        </div>
      </div>

      {(user?.is_provider || isSuperAdmin(user)) && (
        <div className="profile-section">
          <div className="profile-section-title">{t('Manage')}</div>
          <div className="about-rows">
            {user?.is_provider && (
              <Row
                icon="chart"
                title="Provider Dashboard"
                sub="Bookings, events, and promotions"
                onClick={() => navigate('/provider-dashboard')}
                id="about-provider-dashboard-row"
              />
            )}
            {isSuperAdmin(user) && (
              <Row
                icon="shield"
                title="Admin"
                sub="Analytics, providers, and reports"
                onClick={() => navigate('/admin')}
                id="about-admin-row"
              />
            )}
          </div>
        </div>
      )}

      <p className="about-footer">
        {t('Made in Addis Ababa')}
        {appVersion && <span> · v{appVersion}</span>}
      </p>
    </div>
  );
}
