import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MENU_ITEMS = [
  { path: '/home', icon: '🏠', label: 'Home' },
  { path: '/explore', icon: '🔍', label: 'Explore' },
  { path: '/community', icon: '👥', label: 'Communities' },
  { path: '/profile', icon: '👤', label: 'Profile' },
  { path: '/booking-history', icon: '📅', label: 'Bookings' },
  { path: '/provider-dashboard', icon: '📊', label: 'Dashboard' },
];

export default function BurgerMenu({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className="burger-overlay" onClick={onClose} />

      {/* Menu panel */}
      <div className="burger-menu" id="burger-menu">
        {/* Header */}
        <div className="burger-header">
          <div className="burger-brand">
            <div className="burger-logo">🌿</div>
            <div>
              <div className="burger-brand-name">WELL CIRCLE</div>
              <div className="burger-brand-sub">YOUR WELLNESS TRIBE</div>
            </div>
          </div>
          <button className="burger-close" onClick={onClose} id="burger-close-btn">✕</button>
        </div>

        {/* Nav items */}
        <nav className="burger-nav">
          {MENU_ITEMS.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                className={`burger-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
                id={`burger-nav-${item.label.toLowerCase()}`}
              >
                <span className="burger-nav-icon">{item.icon}</span>
                <span className="burger-nav-label">{item.label}</span>
                {isActive && <span className="burger-nav-dot">●</span>}
              </button>
            );
          })}
        </nav>

        {/* CTA at bottom */}
        <div className="burger-footer">
          <button
            className="burger-cta"
            onClick={() => handleNav('/explore')}
            id="burger-book-cta"
          >
            📅 Book a Session
          </button>
        </div>
      </div>
    </>
  );
}
