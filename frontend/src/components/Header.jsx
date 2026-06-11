import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getNotificationUnreadCount } from '../api/client';

export default function Header({ onMenuOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

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
        <img src="/well.png" className="header-logo" alt="Well Circle Logo" />
        <div className="header-text">
          <span className="header-name">WELL CIRCLE</span>
          <span className="header-sub">YOUR WELLNESS TRIBE</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/notifications')}
          style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', position: 'relative' }}
          id="header-notif-btn"
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: 'var(--danger, #ef4444)', color: 'white',
              fontSize: '0.65rem', fontWeight: 700, minWidth: 16, height: 16,
              borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button className="header-menu-btn" onClick={onMenuOpen} id="header-menu-btn">
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>
    </header>
  );
}
