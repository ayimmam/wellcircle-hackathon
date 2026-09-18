import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';
import { haptic } from '../utils/haptic';
import { isProviderPortalDomain } from '../utils/providerPortal';

const TABS = [
  { path: '/home', icon: 'home', label: 'Home' },
  { path: '/explore', icon: 'search', label: 'Explore' },
  { path: '/community', icon: 'users', label: 'Community' },
  { path: '/profile', icon: 'user', label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const hiddenPaths = ['/', '/onboarding', '/provider-onboard', '/visit'];
  const hidden = hiddenPaths.includes(location.pathname)
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/provider-portal')
    || isProviderPortalDomain();
  if (hidden) return null;

  let current = TABS.find(t => location.pathname.startsWith(t.path))?.path;
  if (!current) {
    if (location.pathname.startsWith('/provider') || location.pathname.startsWith('/booking')) current = '/explore';
    else if (location.pathname.startsWith('/users')) current = '/profile';
  }

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {TABS.map(tab => {
        const isActive = current === tab.path;
        return (
          <motion.button
            key={tab.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              haptic('selection');
              navigate(tab.path);
            }}
            id={`nav-${tab.label.toLowerCase()}`}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <span className="nav-item-bubble">
              {isActive && (
                <motion.span
                  layoutId="nav-active-bg"
                  className="nav-active-bg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    background: 'var(--tint-accent-12)',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="nav-icon" style={{ position: 'relative', zIndex: 1 }}>
                <Icon name={tab.icon} size={isActive ? 21 : 20} strokeWidth={isActive ? 2.5 : 1.8} />
              </span>
            </span>
            <span className="nav-label">{t(tab.label)}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
