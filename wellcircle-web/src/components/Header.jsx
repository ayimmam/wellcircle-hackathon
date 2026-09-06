import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotificationUnreadCount } from '../api/client';
import usePolling from '../hooks/usePolling';
import Icon from './Icon';
import { isProviderPortalDomain } from '../utils/providerPortal';
import newLogo from '../new_logo.png';

export default function Header({ onMenuOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation();

  const hidden = ['/', '/onboarding', '/provider-onboard'].includes(location.pathname)
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/provider-portal')
    || isProviderPortalDomain();

  const refreshUnread = async () => {
    try {
      const count = await getNotificationUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (hidden) return;
    refreshUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, hidden]);

  // B4: was a raw 30s setInterval that kept waking cold serverless functions
  // while the tab was hidden — usePolling pauses in the background instead.
  usePolling(refreshUnread, 30000, !hidden);

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
