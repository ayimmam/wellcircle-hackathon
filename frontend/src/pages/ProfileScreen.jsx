import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme, ACCENTS } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { getPointsHistory } from '../api/client';
import { getTier, NEIGHBOURHOODS, MOCK_COMMUNITIES } from '../data/mock';
import { submitFeedback } from '../api/client';
import { showToast } from '../components/Toast';
import { effectiveTimeFormat, formatSlot } from '../utils/timeFormat';
import PhoneInput from '../components/PhoneInput';
import { parsePhone } from '../utils/phone';
import BugReportSheet from '../components/BugReportSheet';

const HEALTH_APPS = ['Apple Health', 'Google Fit', 'Samsung Health', 'Fitbit', 'Garmin', 'Strava', 'Huawei Health', 'Other'];

const PointsTooltip = () => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2 align-middle">
      <button onClick={() => setShow(!show)} className="w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold" style={{ border: 'none', background: 'var(--text-secondary)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
      {show && (
        <div style={{ position: 'absolute', top: '24px', left: 0, width: '250px', padding: '12px', background: 'var(--bg-surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--border)', zIndex: 50, fontSize: '0.85rem' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Legacy Points Dynamics</h4>
          {/* Thresholds mirror the backend tier engine (points.get_points_tier) */}
          <ul style={{ paddingLeft: '16px', margin: 0, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>🌱 <b>Seed (0+ pts):</b> earn +10 per daily check-in</li>
            <li>🌿 <b>Sprout (100+ pts):</b> redeem vouchers in the store</li>
            <li>🌳 <b>Grove (300+ pts):</b> unlock partner merch rewards</li>
            <li>🌲 <b>Forest (700+ pts):</b> top-tier partner perks</li>
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Points pause (−5/day) after 3 days away — a check-in keeps them growing.
          </p>
        </div>
      )}
    </div>
  );
};

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [pointsHistory, setPointsHistory] = useState(null);
  const [showNeighbourhoodSheet, setShowNeighbourhoodSheet] = useState(false);
  const [healthAppChoice, setHealthAppChoice] = useState(HEALTH_APPS[0]);
  const [healthAppOther, setHealthAppOther] = useState('');
  const [healthAppVoted, setHealthAppVoted] = useState(null);
  const [votingHealthApp, setVotingHealthApp] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneEditResult, setPhoneEditResult] = useState({ valid: false, e164: null });
  const [showBugReport, setShowBugReport] = useState(false);
  const { t, i18n } = useTranslation();

  const tier = getTier(user?.points_balance || 0);
  const joinedCommunities = MOCK_COMMUNITIES.filter(
    c => user?.joined_communities?.includes(c.id)
  );

  useEffect(() => {
    getPointsHistory().then(setPointsHistory);
  }, []);

  // Location nudges (Home's "Near you" section, Explore's "Near me" filter)
  // deep-link here with a flag to auto-open the neighbourhood sheet — clear
  // the state after so navigating back doesn't re-trigger it.
  useEffect(() => {
    if (location.state?.openNeighbourhood) {
      setShowNeighbourhoodSheet(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleNeighbourhoodSelect = async (neighbourhood) => {
    if (user?.location_neighborhood === neighbourhood) {
      showToast('Already changed');
      setShowNeighbourhoodSheet(false);
      return;
    }
    try {
      await updateProfile({ location_neighborhood: neighbourhood });
      showToast(`Location set to ${neighbourhood}!`, 'success');
      setShowNeighbourhoodSheet(false);
    } catch (err) {
      showToast('Failed to update', 'error');
    }
  };

  const handleHealthAppVote = async () => {
    const appName = healthAppChoice === 'Other' ? healthAppOther.trim() : healthAppChoice;
    if (!appName || votingHealthApp) return;
    setVotingHealthApp(true);
    try {
      await submitFeedback({ type: 'health_app_request', message: appName });
      showToast(t("Noted — we'll prioritize it."), 'success');
      setHealthAppVoted(appName);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setVotingHealthApp(false);
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
                  <span className="inline-icon-text" style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    {item.action === 'checkin' ? <><Icon name="check" size={13} /> Check-in</> : item.action === 'decay' ? <><Icon name="chart" size={13} /> Decay</> : item.action}
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
          <div className="accent-swatches" role="group" aria-label={t('Accent color')}>
            {ACCENTS.map(({ key, swatch }) => (
              <button
                key={key}
                type="button"
                className={`accent-swatch ${accent === key ? 'active' : ''}`}
                style={{ background: swatch }}
                onClick={() => setAccent(key)}
                aria-label={key}
                aria-pressed={accent === key}
                id={`accent-${key}-btn`}
              >
                {accent === key && <Icon name="check" size={16} style={{ color: '#fff' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Time Format */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Time Format')}</div>
        <div className="profile-card">
          <div className="theme-toggle" role="group" aria-label="Time format">
            <button
              type="button"
              className={`theme-toggle-btn ${effectiveTimeFormat(user) === '12h' ? 'active' : ''}`}
              onClick={() => updateProfile({ time_format: '12h' }).then(() => showToast('Time format updated', 'success'))}
              id="time-format-12h-btn"
            >
              {`12-hour (${formatSlot('14:00', '12h')})`}
            </button>
            <button
              type="button"
              className={`theme-toggle-btn ${effectiveTimeFormat(user) === '24h' ? 'active' : ''}`}
              onClick={() => updateProfile({ time_format: '24h' }).then(() => showToast('Time format updated', 'success'))}
              id="time-format-24h-btn"
            >
              {`24-hour (${formatSlot('14:00', '24h')})`}
            </button>
          </div>
        </div>
      </div>

      {/* Contact phone */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Contact')}</div>
        <div className="profile-card">
          {editingPhone ? (
            <div>
              <PhoneInput value={parsePhone(user?.phone_number)} onChange={setPhoneEditResult} />
              <div className="flex gap-8" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!phoneEditResult.valid}
                  onClick={() => {
                    updateProfile({ phone_number: phoneEditResult.e164 }).then(() => {
                      showToast('Phone number updated', 'success');
                      setEditingPhone(false);
                    });
                  }}
                  id="save-phone-btn"
                >
                  {t('Save')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingPhone(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.95rem' }}>
                {user?.phone_number || <span style={{ color: 'var(--text-secondary)' }}>{t('No phone number saved')}</span>}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingPhone(true)} id="edit-phone-btn">
                {t('Edit')}
              </button>
            </div>
          )}
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
        <div className="profile-section-title flex items-center gap-8">
          {t('Health & Activity')}
          <span className="badge badge-muted" id="health-app-coming-soon">{t('Coming soon')}</span>
        </div>
        <div className="profile-card">
          {healthAppVoted ? (
            <p style={{ margin: 0 }}>{t('Thanks for voting: {{app}}', { app: healthAppVoted })}</p>
          ) : (
            <>
              <p className="text-sm text-secondary mb-8">{t('Which app should we support first?')}</p>
              <select
                className="input mb-8"
                value={healthAppChoice}
                onChange={e => setHealthAppChoice(e.target.value)}
                id="health-app-select"
              >
                {HEALTH_APPS.map(app => <option key={app} value={app}>{app}</option>)}
              </select>
              {healthAppChoice === 'Other' && (
                <input
                  className="input mb-8"
                  placeholder={t('Which app?')}
                  value={healthAppOther}
                  onChange={e => setHealthAppOther(e.target.value)}
                  id="health-app-other-input"
                />
              )}
              <button
                className="btn btn-primary btn-block"
                onClick={handleHealthAppVote}
                disabled={votingHealthApp || (healthAppChoice === 'Other' && !healthAppOther.trim())}
                id="health-app-vote-btn"
              >
                {t('Submit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Support')}</div>
        <div
          className="profile-card"
          onClick={() => setShowBugReport(true)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          id="report-bug-row"
        >
          <Icon name="message-circle" size={20} />
          <div style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600 }}>{t('Report a bug')}</div>
          <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {/* Redeem Points */}
      <div className="profile-section">
        <button 
          className="btn btn-secondary btn-block" 
          onClick={() => navigate('/products')} 
          id="redeem-btn"
        >
          <Icon name="ticket" size={16} /> {t('Redeem Points')}
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

      {showBugReport && <BugReportSheet onClose={() => setShowBugReport(false)} />}
    </div>
  );
}
