import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotificationUnreadCount, cacheKeys } from '../api/client';
import { peek, subscribe } from '../api/cache';
import { useAuth } from '../context/AuthContext';
import useNotificationRealtime from '../hooks/useNotificationRealtime';
import usePolling from '../hooks/usePolling';
import Icon from './Icon';
import { isProviderPortalDomain } from '../utils/providerPortal';
import newLogo from '../new_logo.png';

const unreadSnapshot = () => peek(cacheKeys.unread())?.data ?? 0;
const subscribeUnread = (listener) => subscribe(cacheKeys.unread(), listener);

export default function Header({ onMenuOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const unreadCount = useSyncExternalStore(subscribeUnread, unreadSnapshot, () => 0);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hidden = ['/', '/login', '/landing', '/splash', '/onboarding', '/provider-onboard', '/visit'].includes(location.pathname)
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/provider-portal')
    || isProviderPortalDomain();

  const refreshUnread = async () => {
    try {
      await getNotificationUnreadCount({ force: true });
    } catch {
      // Retain the last known count while the network is unavailable.
    }
  };

  useEffect(() => {
    if (hidden || !user?.id) return undefined;
    // Home is already returning the count in lite/bootstrap. Give that response
    // a chance to land before creating another startup request.
    if (location.pathname === '/home' && !peek(cacheKeys.unread())) {
      const timeout = setTimeout(() => {
        if (!peek(cacheKeys.unread())) getNotificationUnreadCount().catch(() => {});
      }, 2000);
      return () => clearTimeout(timeout);
    }
    getNotificationUnreadCount().catch(() => {});
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, user?.id, location.pathname]);

  // B4: was a raw 30s setInterval that kept waking cold serverless functions
  // while the tab was hidden — usePolling pauses in the background instead.
  const realtimeConnected = useNotificationRealtime(!hidden ? user?.id : null);
  usePolling(refreshUnread, 30000, !hidden && !realtimeConnected);

  if (hidden) return null;

  return (
    <header className={`top-header ${scrolled ? 'compact' : ''}`} id="top-header">
      <button type="button" className="header-brand" onClick={() => navigate('/home')} aria-label={t('Go to home')}>
        <img src={newLogo} className="header-logo" alt="Well Circle Logo" width={38} height={38} />
        <div className="header-text">
          <span className="header-name">WELL CIRCLE</span>
          <span className="header-sub">{t('YOUR WELLNESS TRIBE')}</span>
        </div>
      </button>
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
        <button className="header-menu-btn" data-ui-sound="open" onClick={onMenuOpen} id="header-menu-btn" aria-label="Open menu">
          <Icon name="menu" size={20} />
        </button>
      </div>
    </header>
  );
}
