import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme, ACCENTS } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import {
  cacheKeys, completeMockStravaConnection, disconnectStrava, getPointsHistory, getStravaConnectUrl,
  getStravaStats, getTrainerVerificationStatus, updateStravaVisibility,
} from '../api/client';
import useResource from '../hooks/useResource';
import { getTier, NEIGHBOURHOODS, MOCK_COMMUNITIES } from '../data/mock';
import { showToast } from '../components/Toast';
import { effectiveTimeFormat, formatSlot } from '../utils/timeFormat';
import PhoneInput from '../components/PhoneInput';
import { parsePhone } from '../utils/phone';
import BugReportSheet from '../components/BugReportSheet';
import VerifiedBadge from '../components/VerifiedBadge';
import StravaStats from '../components/StravaStats';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { getEarnedMilestoneBadges } from '../utils/milestones';

const STRAVA_STATS = [
  ['distance', 'Distance'],
  ['calories', 'Calories'],
  ['moving_time', 'Active time'],
  ['elevation', 'Elevation'],
  ['activity_count', 'Activity count'],
  ['recent_activities', 'Recent activities'],
];

export default function ProfileScreen() {
  const { user, updateProfile, refreshUser } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/home'));
  const location = useLocation();
  const [showNeighbourhoodSheet, setShowNeighbourhoodSheet] = useState(false);
  const [bio, setBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [stravaBusy, setStravaBusy] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneEditResult, setPhoneEditResult] = useState({ valid: false, e164: null });
  const [showBugReport, setShowBugReport] = useState(false);
  const { t, i18n } = useTranslation();

  const tier = getTier(user?.points_balance || 0);
  const milestoneBadges = getEarnedMilestoneBadges(user);
  const joinedCommunities = MOCK_COMMUNITIES.filter(
    c => user?.joined_communities?.includes(c.id)
  );

  const { data: pointsHistory } = useResource(cacheKeys.points(), getPointsHistory);

  const { data: trainerStatus } = useResource(
    cacheKeys.trainer(),
    getTrainerVerificationStatus,
  );

  const { data: strava, setData: setStrava, refresh: refreshStrava } = useResource(
    cacheKeys.strava(),
    getStravaStats,
  );

  // Refresh profile on mount to guarantee up-to-date follower/following counts, points balance, etc.
  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  // An approval granted since the last visit only shows up on the user record
  // after a refresh.
  useEffect(() => {
    if (trainerStatus?.status === 'approved') refreshUser?.();
  }, [trainerStatus?.status, refreshUser]);

  useEffect(() => { setBio(user?.bio || ''); }, [user?.bio]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('strava') !== 'connected') return;
    completeMockStravaConnection();
    Promise.all([refreshStrava(), refreshUser?.()])
      .then(() => showToast('Strava connected successfully', 'success'))
      .catch(err => showToast(err.message, 'error'));
    navigate('/profile', { replace: true });
  }, [location.search, navigate, refreshUser, refreshStrava]);

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

  const saveBio = async () => {
    setSavingBio(true);
    try {
      await updateProfile({ bio: bio.trim() || null });
      showToast('Bio updated', 'success');
      setEditingBio(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingBio(false);
    }
  };

  const connectStrava = async () => {
    setStravaBusy(true);
    try {
      const result = await getStravaConnectUrl();
      const url = result.url || result.authorization_url;
      if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
      else window.open(url, '_self');
    } catch (err) {
      showToast(err.message, 'error');
      setStravaBusy(false);
    }
  };

  const handleDisconnectStrava = async () => {
    setStravaBusy(true);
    try {
      await disconnectStrava();
      setStrava({ connected: false, visible_stats: [] });
      await refreshUser?.();
      showToast('Strava disconnected', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStravaBusy(false);
    }
  };

  const toggleStravaStat = async (key) => {
    const current = strava?.visible_stats || [];
    const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key];
    setStrava(value => ({ ...value, visible_stats: next }));
    try {
      await updateStravaVisibility(next);
    } catch (err) {
      setStrava(value => ({ ...value, visible_stats: current }));
      showToast(err.message, 'error');
    }
  };

  if (!user) return null;
  const verificationExpires = user.verified_trainer_expires_at || trainerStatus?.expires_at;

  return (
    <div className="page" id="profile-screen">
      {/* Profile Header — identity, tier, and the two social counts, on one
          card. The bio sits behind an explicit Edit action: a permanently
          open textarea made the top of the screen read as a form rather than
          as a profile. */}
      <div className="profile-header">
        <div className="profile-avatar">
          <SmartImage
            src={user.photo_url}
            alt={user.name}
            width={72}
            priority
            fallback={<Icon name="user" size={36} strokeWidth={1.5} />}
          />
        </div>
        <h1 className="profile-name">{user.name} {user.is_verified_trainer && <VerifiedBadge compact />}</h1>
        <p className="profile-handle">@{user.telegram_handle}</p>

        <div className="profile-tier">
          <Icon name="leaf" size={15} style={{ color: tier.color }} />
          <span>{tier.name}</span>
        </div>

        {editingBio ? (
          <div className="profile-bio-editor">
            <textarea
              className="input"
              maxLength={300}
              value={bio}
              onChange={event => setBio(event.target.value)}
              placeholder="Share your wellness journey..."
              aria-label="Profile bio"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-secondary">{bio.length}/300</span>
              <div className="flex gap-8">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setBio(user.bio || ''); setEditingBio(false); }}
                >
                  {t('Cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={savingBio || bio === (user.bio || '')}
                  onClick={saveBio}
                  id="save-bio-btn"
                >
                  {savingBio ? 'Saving…' : 'Save bio'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="profile-bio-display">
            {user.bio
              ? <p className="profile-bio-text">{user.bio}</p>
              : <p className="profile-bio-text empty">{t('Share your wellness journey…')}</p>}
            <button
              className="profile-bio-edit-btn"
              onClick={() => setEditingBio(true)}
              id="edit-bio-btn"
              aria-label="Edit bio"
            >
              <Icon name="pencil" size={14} /> {user.bio ? t('Edit') : t('Add a bio')}
            </button>
          </div>
        )}

        <div className="profile-connections">
          <button onClick={() => navigate(`/users/${user.id}/followers`)}><strong>{user.follower_count || 0}</strong> Followers</button>
          <span>·</span>
          <button onClick={() => navigate(`/users/${user.id}/following`)}><strong>{user.following_count || 0}</strong> Following</button>
        </div>
      </div>

      {/* Points Stats */}
      <div className="profile-section">
        <div className="profile-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          Legacy Points
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

      {/* Milestone badges — derived from existing fields (join date, tier,
          longest streak), not a separate achievements table. */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Milestones')}</div>
        <div className="profile-card" style={{ padding: '12px 14px' }}>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }} id="profile-milestone-badges">
            {milestoneBadges.map(badge => (
              <span
                key={badge.id}
                className="points-chip"
                id={`milestone-badge-${badge.id}`}
                title={badge.label}
              >
                <Icon name={badge.icon} size={13} />
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance — deliberately high on the page, straight after
          Milestones. It is the one setting people change for fun rather than
          out of need, and burying it under five preference sections meant
          almost nobody found it. */}
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

      {/* Joined Circles — the strongest re-entry hook on this screen, so it
          sits with the other "what you're part of" content rather than below
          five preference panels. */}
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

      <div className="profile-section">
        <div className="profile-section-title">Trainer Verification</div>
        <div className="profile-card">
          {user.is_verified_trainer ? (
            <div>
              <VerifiedBadge />
              {verificationExpires && <p className="text-sm text-secondary mt-8">Valid until {new Date(verificationExpires).toLocaleDateString()}</p>}
              {verificationExpires && new Date(verificationExpires).getTime() - Date.now() < 30 * 86400000 && <button className="btn btn-secondary btn-sm mt-12" onClick={() => navigate('/trainer/verify')}>Renew</button>}
            </div>
          ) : trainerStatus?.status === 'pending' ? (
            <div className="flex justify-between items-center"><span>Verification pending</span><span className="status-badge pending">Under review</span></div>
          ) : trainerStatus?.status === 'approved' ? (
            <div><VerifiedBadge /><p className="text-sm text-secondary mt-8">Verification approved. Refreshing your profile badge…</p></div>
          ) : trainerStatus?.status === 'rejected' ? (
            <div>
              <strong>Application needs attention</strong>
              <p className="text-sm text-secondary mt-8">{trainerStatus.rejection_reason || 'Your application was not approved.'}</p>
              <button className="btn btn-primary btn-sm mt-12" onClick={() => navigate('/trainer/verify')}>Review and apply again</button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-secondary mb-12">Show your credentials, build trust, and unlock paid-circle eligibility.</p>
              <button className="btn btn-primary btn-block" onClick={() => navigate('/trainer/verify')}>Get Verified</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Settings ─────────────────────────────────────────────────
          Everything below is configuration. It was previously interleaved
          with the content above, which is why the screen felt like a
          settings page with a profile stapled to the top. */}
      <div className="profile-settings-heading">{t('Settings')}</div>

      <div className="profile-section">
        <div className="profile-section-title">Profile Visibility</div>
        <div className="profile-card">
          <div className="privacy-options">
            {[
              ['public', 'Public', 'Anyone can see your activity'],
              ['followers', 'Followers only', 'Only followers see activity'],
              ['private', 'Private', 'Only you see activity'],
            ].map(([value, label, description]) => (
              <label className={`privacy-option ${user.profile_privacy === value ? 'selected' : ''}`} key={value}>
                <input type="radio" name="profile-privacy" value={value} checked={user.profile_privacy === value} onChange={() => updateProfile({ profile_privacy: value }).then(() => showToast('Profile visibility updated', 'success')).catch(err => showToast(err.message, 'error'))} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </label>
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

      {/* Strava */}
      <div className="profile-section">
        <div className="profile-section-title">Strava Activity</div>
        <div className="profile-card">
          {strava?.connected ? (
            <>
              <div className="flex justify-between items-center mb-16">
                <div><strong className="inline-icon-text"><Icon name="check" size={14} /> Connected to Strava</strong><p className="text-xs text-secondary">Choose what appears on your public profile.</p></div>
                <button className="btn btn-secondary btn-sm" disabled={stravaBusy} onClick={handleDisconnectStrava}>Disconnect</button>
              </div>
              <div className="strava-toggles">
                {STRAVA_STATS.map(([key, label]) => (
                  <label className="checkbox-row" key={key}>
                    <input type="checkbox" checked={(strava.visible_stats || []).includes(key)} onChange={() => toggleStravaStat(key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <h3 className="text-sm mt-16 mb-8">Public profile preview</h3>
              <StravaStats stats={strava} preview />
            </>
          ) : (
            <div className="strava-connect">
              <div className="strava-logo" aria-hidden="true">STRAVA</div>
              <p className="text-sm text-secondary mb-12">Connect Strava to share selected activity totals and recent workouts on your profile.</p>
              <button className="btn btn-strava btn-block" disabled={stravaBusy} onClick={connectStrava}>Connect with Strava</button>
            </div>
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

      {/* "Redeem Points", "My Bookings", and the Provider Dashboard button
          used to live here. All three now have a permanent home — the first
          two in the menu (Points Store, Bookings), the third on About — and
          repeating them at the bottom of a long screen only added scroll. */}

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
