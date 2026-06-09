import { useNavigate, useLocation } from 'react-router-dom';

export default function Header({ onMenuOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide header on splash, onboarding, and admin
  const hidden = ['/', '/onboarding', '/provider-onboard'].includes(location.pathname)
    || location.pathname.startsWith('/admin');
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
      <button className="header-menu-btn" onClick={onMenuOpen} id="header-menu-btn">
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>
    </header>
  );
}
