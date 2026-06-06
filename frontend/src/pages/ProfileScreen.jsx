import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPointsHistory } from '../api/client';
import { getTier, NEIGHBOURHOODS, MOCK_HEALTH_METRICS, MOCK_COMMUNITIES } from '../data/mock';
import { showToast } from '../components/Toast';

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [pointsHistory, setPointsHistory] = useState(null);
  const [showNeighbourhoodSheet, setShowNeighbourhoodSheet] = useState(false);
  const [healthConnected, setHealthConnected] = useState(user?.health_app_connected || false);

  const tier = getTier(user?.points_balance || 0);
  const joinedCommunities = MOCK_COMMUNITIES.filter(
    c => user?.joined_communities?.includes(c.id)
  );

  useEffect(() => {
    getPointsHistory().then(setPointsHistory);
  }, []);

  const handleNeighbourhoodSelect = async (neighbourhood) => {
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
            <span style={{ fontSize: '2rem' }}>👤</span>
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
        <div className="profile-section-title">Legacy Points</div>
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
          <div className="profile-section-title">Recent Activity</div>
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

      {/* Neighbourhood Opt-in */}
      <div className="profile-section">
        <div className="profile-section-title">Local Alerts</div>
        <div
          className="neighbourhood-card"
          onClick={() => setShowNeighbourhoodSheet(true)}
          id="neighbourhood-optin"
        >
          <span className="neighbourhood-icon">📍</span>
          <div className="neighbourhood-text">
            {user.location_neighborhood ? (
              <>
                <div className="neighbourhood-title">✓ Showing alerts for {user.location_neighborhood}</div>
                <div className="neighbourhood-desc">Tap to change your neighbourhood</div>
              </>
            ) : (
              <>
                <div className="neighbourhood-title">Get local wellness alerts</div>
                <div className="neighbourhood-desc">Tell us your neighbourhood</div>
              </>
            )}
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        </div>
      </div>

      {/* Joined Communities */}
      {joinedCommunities.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">Joined Circles</div>
          <div className="flex-col gap-8">
            {joinedCommunities.map(c => (
              <div
                key={c.id}
                className="profile-card"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => navigate(`/community/${c.id}`)}
              >
                <span style={{ fontSize: '1.2rem' }}>🌿</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>👥 {c.member_count}</div>
                </div>
                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health & Activity */}
      <div className="profile-section">
        <div className="profile-section-title">Health & Activity</div>
        <div className="profile-card">
          <button
            className={`btn btn-block ${healthConnected ? 'btn-primary' : 'btn-outline'}`}
            onClick={toggleHealthApp}
            id="health-app-toggle"
          >
            {healthConnected ? '✓ Connected' : 'Connect Health App'}
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

      {/* Redeem (greyed out) */}
      <div className="profile-section">
        <button className="btn btn-secondary btn-block" disabled style={{ opacity: 0.5 }} id="redeem-btn">
          🎁 Redeem Points — Coming Soon
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
            📊 Provider Dashboard
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
                  📍 {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
