import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

// Deliberately excludes every bottom-nav destination (Home, Explore,
// Community, Profile) and Notifications (the header bell) — a link that is
// already one tap away on the persistent chrome makes the menu longer to
// scan without making anything reachable. What is left is exactly the set of
// screens with no other permanent entry point.
const MENU_ITEMS = [
  { path: '/products', icon: 'bag', label: 'Points Store', desc: 'Spend your points on real rewards' },
  { path: '/my-bookings', icon: 'ticket', label: 'Bookings', desc: 'Upcoming and past sessions' },
  { path: '/events', icon: 'calendar', label: 'Events', desc: "What's happening around Addis" },
  { path: '/about', icon: 'info', label: 'About', desc: 'What Well Circle is and how it works' },
];

export default function BurgerMenu({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div className="burger-overlay" onClick={onClose} />

      <div className="burger-menu" id="burger-menu">
        <div className="burger-header">
          <div className="burger-brand">
            <img src="/well.png" className="burger-logo" alt="Well Circle Logo" />
            <div>
              <div className="burger-brand-name">WELL CIRCLE</div>
              <div className="burger-brand-sub">{t('YOUR WELLNESS TRIBE')}</div>
            </div>
          </div>
          <button className="burger-close" onClick={onClose} id="burger-close-btn" aria-label="Close menu">
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="burger-nav">
          {MENU_ITEMS.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                className={`burger-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
                id={`burger-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="burger-nav-icon"><Icon name={item.icon} size={20} /></span>
                <span className="burger-nav-label">
                  {t(item.label)}
                  <small className="burger-nav-desc">{t(item.desc)}</small>
                </span>
                {isActive && <span className="burger-nav-dot" />}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
