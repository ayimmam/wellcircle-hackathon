import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';

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

  const hiddenPaths = ['/', '/onboarding', '/provider-onboard'];
  const hidden = hiddenPaths.includes(location.pathname)
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/provider-portal');
  if (hidden) return null;

  const current = TABS.find(t => location.pathname.startsWith(t.path))?.path;

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.path}
          className={`nav-item ${current === tab.path ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
          id={`nav-${tab.label.toLowerCase()}`}
        >
          <span className="nav-icon"><Icon name={tab.icon} size={22} /></span>
          <span className="nav-label">{t(tab.label)}</span>
        </button>
      ))}
    </nav>
  );
}
