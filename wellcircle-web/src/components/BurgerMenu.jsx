import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function BurgerMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  if (!isOpen) return null;

  const goTo = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="menu-backdrop" onClick={onClose} id="burger-menu-backdrop">
      <div className="menu-drawer" onClick={(e) => e.stopPropagation()} id="burger-menu-drawer">
        <div className="menu-header">
          <span className="menu-title">Menu</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close menu" id="menu-close-btn">
            <Icon name="x" size={20} />
          </button>
        </div>

        {user && (
          <div className="menu-user-info" onClick={() => goTo('/profile')}>
            <div className="menu-user-avatar">
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.name || 'User'} />
              ) : (
                <span>{(user.name || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <div className="menu-user-text">
              <div className="menu-user-name">{user.name || 'Wellness Member'}</div>
              <div className="menu-user-points">{user.points_balance || 0} pts · {user.tier_emoji || '🌱'} {user.tier || 'seed'}</div>
            </div>
          </div>
        )}

        <div className="menu-items">
          <button className="menu-item" onClick={() => goTo('/home')} id="menu-home-btn">
            <Icon name="home" size={20} />
            <span>Home Feed</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/explore')} id="menu-explore-btn">
            <Icon name="search" size={20} />
            <span>Explore Providers</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/community')} id="menu-community-btn">
            <Icon name="users" size={20} />
            <span>Circles & Community</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/events')} id="menu-events-btn">
            <Icon name="calendar" size={20} />
            <span>Events in Addis</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/products')} id="menu-store-btn">
            <Icon name="store" size={20} />
            <span>Points Store & Rewards</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/my-bookings')} id="menu-bookings-btn">
            <Icon name="calendar" size={20} />
            <span>My Bookings</span>
          </button>

          <button className="menu-item" onClick={() => goTo('/about')} id="menu-about-btn">
            <Icon name="info" size={20} />
            <span>About Well Circle</span>
          </button>

          {user?.is_provider && (
            <button className="menu-item" onClick={() => goTo('/provider-dashboard')} id="menu-provider-btn">
              <Icon name="chart" size={20} />
              <span>Provider Dashboard</span>
            </button>
          )}

          {user?.is_super_admin && (
            <button className="menu-item" onClick={() => goTo('/admin')} id="menu-admin-btn">
              <Icon name="shield" size={20} />
              <span>Admin Portal</span>
            </button>
          )}

          <div className="menu-divider" />

          {/* Theme Toggle */}
          <button className="menu-item" onClick={toggleTheme} id="menu-theme-btn">
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {user ? (
            <button className="menu-item text-danger" onClick={() => { onClose(); logout(); }} id="menu-logout-btn">
              <Icon name="log-out" size={20} />
              <span>Sign Out</span>
            </button>
          ) : (
            <button className="menu-item text-primary" onClick={() => goTo('/login')} id="menu-login-btn">
              <Icon name="user" size={20} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
