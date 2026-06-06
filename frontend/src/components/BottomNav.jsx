import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '/home', icon: '🏠', label: 'Home' },
  { path: '/explore', icon: '🔍', label: 'Explore' },
  { path: '/community', icon: '👥', label: 'Community' },
  { path: '/profile', icon: '👤', label: 'Profile' }
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide nav on splash, onboarding, and full-screen flows
  const hidden = ['/', '/onboarding'].some(
    p => location.pathname === p
  );
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
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
