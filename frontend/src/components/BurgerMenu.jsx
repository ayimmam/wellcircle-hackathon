import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/auth';
import Icon from './Icon';

const BASE_MENU_ITEMS = [
  { path: '/home', icon: 'home', label: 'Home' },
  { path: '/explore', icon: 'search', label: 'Explore' },
  { path: '/community', icon: 'users', label: 'Communities' },
  { path: '/products', icon: 'bag', label: 'Points Store' },
  { path: '/notifications', icon: 'bell', label: 'Notifications' },
  { path: '/profile', icon: 'user', label: 'Profile' },
  { path: '/my-bookings', icon: 'calendar', label: 'Bookings' },
  { path: '/provider-onboard', icon: 'store', label: 'Become Provider' },
];

export default function BurgerMenu({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  const menuItems = [
    ...BASE_MENU_ITEMS.slice(0, 5),
    ...(user?.is_provider ? [{ path: '/provider-dashboard', icon: 'chart', label: 'Dashboard' }] : []),
    ...BASE_MENU_ITEMS.slice(5),
    ...(isSuperAdmin(user) ? [{ path: '/admin', icon: 'settings', label: 'Admin' }] : []),
  ];

  return (
    <>
      <div className="burger-overlay" onClick={onClose} />

      <div className="burger-menu" id="burger-menu">
        <div className="burger-header">
          <div className="burger-brand">
            <img src="/well.png" className="burger-logo" alt="Well Circle Logo" />
            <div>
              <div className="burger-brand-name">WELL CIRCLE</div>
              <div className="burger-brand-sub">YOUR WELLNESS TRIBE</div>
            </div>
          </div>
          <button className="burger-close" onClick={onClose} id="burger-close-btn" aria-label="Close menu">
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="burger-nav">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                className={`burger-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
                id={`burger-nav-${item.label.toLowerCase()}`}
              >
                <span className="burger-nav-icon"><Icon name={item.icon} size={20} /></span>
                <span className="burger-nav-label">{item.label}</span>
                {isActive && <span className="burger-nav-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="burger-footer">
          <button
            className="burger-cta"
            onClick={() => handleNav('/explore')}
            id="burger-book-cta"
          >
            <Icon name="calendar" size={18} /> Book a Session
          </button>
        </div>
      </div>
    </>
  );
}
