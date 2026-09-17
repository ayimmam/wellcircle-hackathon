import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  cacheKeys, completeMockStravaConnection, disconnectStrava, getCommunities, getPointsHistory,
  getStravaConnectUrl, getStravaStats, getTrainerVerificationStatus, updateStravaVisibility,
} from '../api/client';
import useResource from '../hooks/useResource';
import { getTier } from '../data/mock';
import { showToast } from '../components/Toast';
import BugReportSheet from '../components/BugReportSheet';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { getEarnedMilestoneBadges } from '../utils/milestones';
import useDismissOnEscape from '../hooks/useDismissOnEscape';
import ProfileHeader from './profile/ProfileHeader';
import PersonalRecordsSection from './profile/PersonalRecordsSection';
import AccountSection from './profile/AccountSection';
import PreferencesSection from './profile/PreferencesSection';
import PrivacySection from './profile/PrivacySection';
import IntegrationsSection from './profile/IntegrationsSection';

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

  useDismissOnEscape(() => setShowNeighbourhoodSheet(false), showNeighbourhoodSheet);

  const tier = getTier(user?.points_balance || 0);
  const milestoneBadges = getEarnedMilestoneBadges(user);

  // Real data, not the mock fixture — this used to source from
  // MOCK_COMMUNITIES even in live mode, so a real (non-seed) user's joined
  // circles never actually matched here. Reads the unfiltered list (which
  // Home's bootstrap has usually already warmed, so this rarely costs its
  // own request) and filters client-side, same check ForYouScreen uses for
  // its own joined-circles list.
  const { data: allCommunities } = useResource(
    cacheKeys.communities(),
    () => getCommunities(),
    { initialData: [], select: res => res.communities || [] },
  );
  const joinedCommunities = allCommunities.filter(
    c => c.user_joined || user?.joined_communities?.includes(c.id)
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
      <ProfileHeader
        user={user} tier={tier} navigate={navigate} t={t}
        bio={bio} setBio={setBio} editingBio={editingBio} setEditingBio={setEditingBio}
        savingBio={savingBio} saveBio={saveBio}
      />

      <div className="profile-settings-heading">{t('Account')}</div>
      <PersonalRecordsSection t={t} user={user} updateProfile={updateProfile} showToast={showToast} />
      <AccountSection
        user={user} t={t} navigate={navigate}
        pointsHistory={pointsHistory} joinedCommunities={joinedCommunities} milestoneBadges={milestoneBadges}
        trainerStatus={trainerStatus} verificationExpires={verificationExpires}
        editingPhone={editingPhone} setEditingPhone={setEditingPhone}
        phoneEditResult={phoneEditResult} setPhoneEditResult={setPhoneEditResult}
        updateProfile={updateProfile} showToast={showToast}
        setShowBugReport={setShowBugReport}
      />

      <div className="profile-settings-heading">{t('Preferences')}</div>
      <PreferencesSection
        t={t} i18n={i18n} user={user}
        theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent}
        updateProfile={updateProfile} showToast={showToast}
      />

      <div className="profile-settings-heading">{t('Privacy')}</div>
      <PrivacySection
        t={t} user={user} updateProfile={updateProfile} showToast={showToast}
        showNeighbourhoodSheet={showNeighbourhoodSheet} setShowNeighbourhoodSheet={setShowNeighbourhoodSheet}
        handleNeighbourhoodSelect={handleNeighbourhoodSelect}
      />

      <div className="profile-settings-heading">{t('Integrations')}</div>
      <IntegrationsSection
        strava={strava} stravaBusy={stravaBusy}
        connectStrava={connectStrava} handleDisconnectStrava={handleDisconnectStrava}
        toggleStravaStat={toggleStravaStat}
      />

      {/* "Redeem Points", "My Bookings", and the Provider Dashboard button
          used to live here. All three now have a permanent home — the first
          two in the menu (Points Store, Bookings), the third on About — and
          repeating them at the bottom of a long screen only added scroll. */}

      {showBugReport && <BugReportSheet onClose={() => setShowBugReport(false)} />}
    </div>
  );
}
