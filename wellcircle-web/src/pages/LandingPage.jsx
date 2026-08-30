import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import newLogo from '../new_logo.png';

const HOW_IT_WORKS = [
  {
    icon: 'users',
    title: 'Join a Circle',
    desc: 'Small groups around your favourite gym, yoga studio, running club, or spa in Addis Ababa. Stay accountable together.',
  },
  {
    icon: 'check',
    title: 'Check In Daily',
    desc: 'One tap when you show up. Build a daily streak and share progress with your circle-mates.',
  },
  {
    icon: 'coins',
    title: 'Earn Legacy Points',
    desc: 'Every check-in, streak milestone, and verified booking earns points toward tier upgrades and store rewards.',
  },
  {
    icon: 'calendar',
    title: 'Book & Show Up',
    desc: 'Direct booking with premier Addis providers like Boston Day Spa & Kuriftu. Exclusive member rates apply at checkout.',
  },
];

const HIGHLIGHTS = [
  { label: 'Verified Providers', val: '15+' },
  { label: 'Active Circles', val: '50+' },
  { label: 'Daily Check-ins', val: '1,200+' },
  { label: 'Reward Redemptions', val: '500+' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (!user.is_onboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="landing-page" id="landing-page">
      {/* Top Bar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src={newLogo} alt="Well Circle" className="landing-logo-img" />
          <span className="landing-brand-title">Well Circle</span>
        </div>
        <div className="landing-nav-actions">
          <button
            className="btn btn-ghost landing-login-btn"
            onClick={() => navigate('/login')}
            id="landing-signin-btn"
          >
            Sign In
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/login')}
            id="landing-getstarted-btn"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-badge">
          <span className="landing-badge-dot"></span>
          <span>Wellness & Community in Addis Ababa</span>
        </div>
        <h1 className="landing-title">
          Your wellness tribe.<br />
          <span className="text-gradient">Right where you belong.</span>
        </h1>
        <p className="landing-subtitle">
          Join circles around gyms, studios, and spas in Addis. Check in, build streaks,
          earn points, and book sessions with verified providers — now directly in your browser.
        </p>

        <div className="landing-cta-group">
          <button
            className="btn btn-primary btn-lg landing-cta-primary"
            onClick={() => navigate('/login')}
            id="hero-cta-btn"
          >
            <span>Start Your Journey</span>
            <Icon name="chevron-right" size={20} />
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => navigate('/explore')}
            id="hero-explore-btn"
          >
            <Icon name="search" size={18} />
            <span>Explore Providers</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="landing-stats">
          {HIGHLIGHTS.map((stat, i) => (
            <div className="landing-stat-card" key={i}>
              <div className="landing-stat-val">{stat.val}</div>
              <div className="landing-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-section">
        <div className="section-header-center">
          <span className="section-eyebrow">How It Works</span>
          <h2 className="section-heading">Four simple steps to your best self</h2>
          <p className="section-subtext">Designed to make wellness social, rewarding, and consistent.</p>
        </div>

        <div className="landing-grid">
          {HOW_IT_WORKS.map((step, i) => (
            <div className="landing-step-card" key={i}>
              <div className="landing-step-number">{i + 1}</div>
              <div className="landing-step-icon">
                <Icon name={step.icon} size={24} />
              </div>
              <h3 className="landing-step-title">{step.title}</h3>
              <p className="landing-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Provider Callout */}
      <section className="landing-provider-banner">
        <div className="landing-provider-content">
          <span className="landing-provider-tag">For Businesses</span>
          <h2>Are you a wellness provider in Addis?</h2>
          <p>
            List your gym, yoga studio, spa, or training services on Well Circle. Reach dedicated wellness enthusiasts, manage bookings, and grow your client base.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/provider-onboard')}
            id="landing-provider-onboard-btn"
          >
            Partner with Well Circle
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-brand">
            <img src={newLogo} alt="Well Circle" className="landing-logo-img" />
            <span className="landing-brand-title">Well Circle</span>
          </div>
          <p className="landing-footer-tagline">Your wellness tribe. Made with pride in Addis Ababa.</p>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Well Circle. All rights reserved.</span>
          <div className="landing-footer-links">
            <button onClick={() => navigate('/about')} className="btn-link">About</button>
            <button onClick={() => navigate('/explore')} className="btn-link">Explore</button>
            <button onClick={() => navigate('/community')} className="btn-link">Community</button>
            <button onClick={() => navigate('/login')} className="btn-link">Sign In</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
