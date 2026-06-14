import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { getPointsHistory } from '../api/client';
import { getTier, NEIGHBOURHOODS, MOCK_HEALTH_METRICS, MOCK_COMMUNITIES } from '../data/mock';
import { showToast } from '../components/Toast';

const PointsTooltip = () => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2 align-middle">
      <button onClick={() => setShow(!show)} className="w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold" style={{ border: 'none', background: 'var(--text-secondary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
      {show && (
        <div style={{ position: 'absolute', top: '24px', left: 0, width: '250px', padding: '12px', background: 'var(--bg-surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--border)', zIndex: 50, fontSize: '0.85rem' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Legacy Points Dynamics</h4>
          <ul style={{ paddingLeft: '16px', margin: 0, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>🌱 <b>Seed Tier (100 pts):</b> 10% off specific events</li>
            <li>🌿 <b>Sprout Tier (500 pts):</b> 20% off + free merch</li>
            <li>🌳 <b>Tree Tier (1000 pts):</b> 1 Free month at partner gyms</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [pointsHistory, setPointsHistory] = useState(null);
  const [showNeighbourhoodSheet, setShowNeighbourhoodSheet] = useState(false);
  const [healthConnected, setHealthConnected] = useState(user?.health_app_connected || false);
  const { t, i18n } = useTranslation();

  const tier = getTier(user?.points_balance || 0);
  const joinedCommunities = MOCK_COMMUNITIES.filter(
    c => user?.joined_communities?.includes(c.id)
  );

  useEffect(() => {
    getPointsHistory().then(setPointsHistory);
  }, []);

  const handleNeighbourhoodSelect = async (neighbourhood) => {
    if (user?.location_neighborhood === neighbourhood) {
      showToast('Already changed', 'ℹ️');
      setShowNeighbourhoodSheet(false);
      return;
    }
    try {
      await updateProfile({ location_neighborhood: neighbourhood });
      showToast(`Location set to ${neighbourhood}! 📍`, '✅');
      setShowNeighbourhoodSheet(false);
    } catch (err) {
      showToast('Failed to update', '❌');
    }
  };

  const toggleHealthApp = async () => {
    const newState = !healthConnected;
    setHealthConnected(newState);
    try {
      await updateProfile({ health_app_connected: newState });
      showToast(newState ? 'Health app connected! 💚' : 'Health app disconnected', newState ? '✅' : '📴');
    } catch (err) {
      // Still update locally per PRD — frontend state is source of truth
    }
  };

  if (!user) return null;

  return (
    <div className="page" id="profile-screen">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {user.photo_url ? (
            <img src={user.photo_url} alt={user.name} />
          ) : (
            <Icon name="user" size={36} strokeWidth={1.5} />
          )}
        </div>
        <h1 className="profile-name">{user.name}</h1>
        <p className="profile-handle">@{user.telegram_handle}</p>
        <div className="profile-tier">
          <span>{tier.emoji}</span>
          <span>{tier.name}</span>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {user.points_balance || 0} pts</span>
        </div>
      </div>

      {/* Points Stats */}
      <div className="profile-section">
        <div className="profile-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          Legacy Points <PointsTooltip />
        </div>
        <div className="profile-card">
          <div className="profile-stat-row">
            <div>
              <div className="profile-stat-value">{user.points_balance || 0}</div>
              <div className="profile-stat-label">Balance</div>
            </div>
            <div>
              <div className="profile-stat-value" style={{ color: 'var(--accent)' }}>
                {pointsHistory?.items?.filter(i => i.points > 0).reduce((sum, i) => sum + i.points, 0) || 0}
              </div>
              <div className="profile-stat-label">Earned</div>
            </div>
            <div>
              <div className="profile-stat-value" style={{ color: 'var(--secondary)' }}>
                {joinedCommunities.length}
              </div>
              <div className="profile-stat-label">Circles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Points History */}
      {pointsHistory?.items?.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">{t('Recent Activity')}</div>
          <div className="profile-card">
            {pointsHistory.items.slice(0, 5).map((item, i) => (
              <div
                key={i}
                className="confirmation-row"
                style={i === Math.min(4, pointsHistory.items.length - 1) ? { borderBottom: 'none' } : {}}
              >
                <div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    {item.action === 'checkin' ? '✅ Check-in' : item.action === 'decay' ? '📉 Decay' : item.action}
                  </span>
                  {item.community_name && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 8 }}>
                      {item.community_name}
                    </span>
                  )}
                </div>
                <span style={{
                  fontWeight: 700,
                  color: item.points > 0 ? 'var(--accent)' : 'var(--danger)',
                  fontSize: '0.88rem'
                }}>
                  {item.points > 0 ? `+${item.points}` : item.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Appearance')}</div>
        <div className="profile-card">
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              id="theme-light-btn"
            >
              <Icon name="sun" size={16} /> {t('Light')}
            </button>
            <button
              type="button"
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              id="theme-dark-btn"
            >
              <Icon name="moon" size={16} /> {t('Dark')}
            </button>
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Language')}</div>
        <div className="profile-card">
          <select 
            value={i18n.language} 
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.95rem', cursor: 'pointer', outline: 'none' }}
          >
            <option value="en">English</option>
            <option value="am">አማርኛ (Amharic)</option>
            <option value="fr">Français (French)</option>
            <option value="it">Italiano (Italian)</option>
          </select>
        </div>
      </div>

      {/* Neighbourhood Opt-in */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Local Alerts')}</div>
        <div
          className="neighbourhood-card"
          onClick={() => setShowNeighbourhoodSheet(true)}
          id="neighbourhood-optin"
        >
          <span className="neighbourhood-icon"><Icon name="map-pin" size={20} /></span>
          <div className="neighbourhood-text">
            {user.location_neighborhood ? (
              <>
                <div className="neighbourhood-title inline-icon-text"><Icon name="check" size={14} strokeWidth={2.5} /> Showing alerts for {user.location_neighborhood}</div>
                <div className="neighbourhood-desc">Tap to change your neighbourhood</div>
              </>
            ) : (
              <>
                <div className="neighbourhood-title">Get local wellness alerts</div>
                <div className="neighbourhood-desc">Tell us your neighbourhood</div>
              </>
            )}
          </div>
          <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {/* Joined Communities */}
      {joinedCommunities.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">{t('Joined Circles')}</div>
          <div className="flex-col gap-8">
            {joinedCommunities.map(c => (
              <div
                key={c.id}
                className="profile-card"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => navigate(`/community/${c.id}`)}
              >
                <Icon name="leaf" size={20} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{c.name}</div>
                  <div className="inline-icon-text" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}><Icon name="users" size={12} /> {c.member_count}</div>
                </div>
                <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings & History */}
      <div className="profile-section">
        <div className="profile-section-title">{t('My Bookings')}</div>
        <div className="profile-card" onClick={() => navigate('/my-bookings')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="ticket" size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>View Booking History</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Upcoming & Past classes</div>
          </div>
          <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {/* Health & Activity */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Health & Activity')}</div>
        <div className="profile-card">
          <button
            className={`btn btn-block ${healthConnected ? 'btn-primary' : 'btn-outline'}`}
            onClick={toggleHealthApp}
            id="health-app-toggle"
          >
            {healthConnected ? <><Icon name="check" size={16} strokeWidth={2.5} /> {t('Connected')}</> : t('Connect Health App')}
          </button>

          {healthConnected && (
            <div className="health-metrics">
              <div className="health-metric">
                <div className="health-metric-value">{MOCK_HEALTH_METRICS.steps_this_week.toLocaleString()}</div>
                <div className="health-metric-label">Steps this week</div>
              </div>
              <div className="health-metric">
                <div className="health-metric-value">{MOCK_HEALTH_METRICS.active_minutes}</div>
                <div className="health-metric-label">Active min</div>
              </div>
              <div className="health-metric">
                <div className="health-metric-value">{MOCK_HEALTH_METRICS.wellness_score}</div>
                <div className="health-metric-label">Wellness score</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redeem Points */}
      <div className="profile-section">
        <button 
          className="btn btn-secondary btn-block" 
          onClick={() => navigate('/products')} 
          id="redeem-btn"
        >
          🎁 {t('Redeem Points')}
        </button>
      </div>

      {/* Provider Dashboard Link (if provider) */}
      {user.is_provider && (
        <div className="profile-section">
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/provider-dashboard')}
            id="provider-dashboard-link"
          >
            <Icon name="chart" size={18} /> Provider Dashboard
          </button>
        </div>
      )}

      {/* Neighbourhood Bottom Sheet */}
      {showNeighbourhoodSheet && (
        <>
          <div className="sheet-overlay" onClick={() => setShowNeighbourhoodSheet(false)} />
          <div className="sheet" id="neighbourhood-sheet">
            <div className="sheet-handle" />
            <h3 className="sheet-title">Select your neighbourhood</h3>
            <div className="sheet-options">
              {NEIGHBOURHOODS.map(n => (
                <button
                  key={n}
                  className={`sheet-option ${user.location_neighborhood === n ? 'selected' : ''}`}
                  onClick={() => handleNeighbourhoodSelect(n)}
                >
                  <span className="inline-icon-text"><Icon name="map-pin" size={14} /> {n}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
