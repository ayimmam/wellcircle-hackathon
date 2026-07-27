import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { followUser, getUserProfile, unfollowUser } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import VerifiedBadge from '../components/VerifiedBadge';
import StravaStats from '../components/StravaStats';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getUserProfile(id)
      .then(nextProfile => {
        if (!active) return;
        setProfile(nextProfile);
        setStats(nextProfile.strava_stats || null);
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const toggleFollow = async () => {
    try {
      const next = !profile.is_following;
      if (next) await followUser(id);
      else await unfollowUser(id);
      // Re-read the privacy-aware profile. Following/unfollowing can reveal or
      // hide Strava stats and created circles, so changing only the count would
      // leave protected content in the wrong state.
      const refreshed = await getUserProfile(id);
      setProfile(refreshed);
      setStats(refreshed.strava_stats || null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <div className="page"><div className="skeleton" style={{ height: 320 }} /></div>;
  if (!profile) return <div className="page"><div className="empty-state">Profile unavailable.</div></div>;
  const statsHidden = id !== user?.id && profile.stats_hidden;

  return (
    <div className="page public-profile" id="public-profile-screen">
      {!nativeBack && (
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Back"><Icon name="chevron-left" /></button>
      )}
      <div className="profile-header">
        <div className="profile-avatar">
          <SmartImage
            src={profile.photo_url}
            alt={profile.name}
            width={72}
            priority
            fallback={<Icon name="user" size={36} />}
          />
        </div>
        <h1 className="profile-name">{profile.name} {profile.is_verified_trainer && <VerifiedBadge compact />}</h1>
        <p className="profile-handle">@{profile.telegram_handle || 'wellcircle'}</p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <div className="profile-connections">
          <button onClick={() => navigate(`/users/${id}/followers`)}><strong>{profile.follower_count || 0}</strong> Followers</button>
          <span>·</span>
          <button onClick={() => navigate(`/users/${id}/following`)}><strong>{profile.following_count || 0}</strong> Following</button>
        </div>
        {id !== user?.id && (
          <button className={`btn mt-16 ${profile.is_following ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleFollow}>
            {profile.is_following ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {statsHidden && (
        <div className="profile-card mb-16 text-center text-secondary">
          This profile&apos;s activity and circles are private.
        </div>
      )}
      {!statsHidden && stats && (
        <div className="profile-section">
          <div className="profile-section-title">Strava Activity</div>
          <div className="profile-card"><StravaStats stats={stats} /></div>
        </div>
      )}
      {!statsHidden && (profile.created_circles || []).length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">Circles created by {profile.name.split(' ')[0]}</div>
          <div className="flex-col gap-8">
            {profile.created_circles.map(circle => (
              <button className="profile-card text-left circle-profile-card" key={circle.id} onClick={() => navigate(`/circle/${circle.id}`)}>
                <strong>{circle.name}</strong>
                <span>
                  {circle.member_count != null ? `${circle.member_count} members ` : ''}
                  {circle.is_paid ? `${circle.member_count != null ? '· ' : ''}ETB ${circle.price_etb}/month` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
