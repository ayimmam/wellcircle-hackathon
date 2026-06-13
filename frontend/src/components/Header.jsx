import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotificationUnreadCount } from '../api/client';
import Icon from './Icon';
import newLogo from '../new_logo.png';

export default function Header({ onMenuOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation();

  const hidden = ['/', '/onboarding', '/provider-onboard'].includes(location.pathname)
    || location.pathname.startsWith('/admin');

  useEffect(() => {
    if (hidden) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const count = await getNotificationUnreadCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location.pathname, hidden]);

  if (hidden) return null;

  return (
    <header className="top-header" id="top-header">
      <div className="header-brand" onClick={() => navigate('/home')}>
        <img src={newLogo} className="header-logo" alt="Well Circle Logo" />
        <div className="header-text">
          <span className="header-name">WELL CIRCLE</span>
          <span className="header-sub">{t('YOUR WELLNESS TRIBE')}</span>
        </div>
      </div>
      <div className="header-actions">
        <button
          className="header-icon-btn"
          onClick={() => navigate('/notifications')}
          id="header-notif-btn"
          aria-label="Notifications"
        >
          <Icon name="bell" size={20} />
          {unreadCount > 0 && (
            <span className="header-badge">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button className="header-menu-btn" onClick={onMenuOpen} id="header-menu-btn" aria-label="Open menu">
          <Icon name="menu" size={20} />
        </button>
      </div>
    </header>
  );
}
