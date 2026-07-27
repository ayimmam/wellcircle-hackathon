import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { getCommunity, getCommunityFeed, joinCommunity, leaveCommunity } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FeedEvent from '../components/FeedEvent';
import PostFeed from '../components/PostFeed';
import ChallengesList from '../components/ChallengesList';
import Leaderboard from '../components/Leaderboard';
import { showToast } from '../components/Toast';
import usePolling from '../hooks/usePolling';
import useCheckin from '../hooks/useCheckin';
import Icon from '../components/Icon';

export default function CommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [community, setCommunity] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'posts'
  const [challengeRefreshKey, setChallengeRefreshKey] = useState(0);
  // Right after joining, land on Posts with a friendly intro pre-filled —
  // mirrors CircleDetailScreen's justJoined flow.
  const [justJoined, setJustJoined] = useState(false);
  const lastTimestamp = useRef(null);

  // Load community details and feed
  useEffect(() => {
    setLoading(true);
    Promise.all([getCommunity(id), getCommunityFeed(id)])
      .then(([c, f]) => {
        setCommunity(c);
        setEvents(f.events);
        setCheckedIn(c.user_checked_in_today || false);
        if (f.events.length > 0) {
          lastTimestamp.current = f.events[0].created_at;
        }
      })
      .catch(() => navigate('/community', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Joining from a list card (Home's "Join a Circle" section, Community
  // Explore tab) already calls joinCommunity before we get here — it can't
  // re-run handleJoin, so it flags the redirect via nav state instead. Clear
  // the state after so navigating back doesn't re-trigger it.
  useEffect(() => {
    if (location.state?.justJoined) {
      setActiveTab('posts');
      setJustJoined(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Poll feed every 5 seconds (paused while the app is backgrounded)
  usePolling(async () => {
    try {
      const res = await getCommunityFeed(id, lastTimestamp.current);
      if (res.events.length > 0) {
        setEvents(prev => [...res.events, ...prev]);
        lastTimestamp.current = res.events[0].created_at;
      }
    } catch (err) {
      // Silently fail polling
    }
  }, 5000, Boolean(community));

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await joinCommunity(id);
      setCommunity(prev => ({ ...prev, user_joined: true, member_count: res.member_count }));
      // Add join event to feed
      if (res.feed_event) {
        setEvents(prev => [{ ...res.feed_event, user_photo: user?.photo_url }, ...prev]);
      }
      showToast('Welcome to the circle!', 'success');
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
      setActiveTab('posts');
      setJustJoined(true);
    } catch (err) {
      showToast('Already a member');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      const res = await leaveCommunity(id);
      setCommunity(prev => ({ ...prev, user_joined: false, member_count: res.member_count }));
      showToast('Left the circle');
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: (prev.joined_communities || []).filter(cid => cid !== id)
        }));
      }
    } catch (err) {
      showToast('Error leaving community', 'error');
    }
  };

  const checkin = useCheckin('community_detail');
  const [checkingIn, setCheckingIn] = useState(false);

  const handleCheckin = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      // Toasts, user points/streak updates, milestone celebration, and
      // analytics all live in useCheckin (shared with the Home check-in card)
      const res = await checkin(id);
      setCheckedIn(true);
      // Add checkin event to feed
      if (res.feed_event) {
        setEvents(prev => [{ ...res.feed_event, user_photo: user?.photo_url }, ...prev]);
      }
      setChallengeRefreshKey(k => k + 1);
    } catch (err) {
      showToast('Already checked in today');
      setCheckedIn(true);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading || !community) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 24 }} />
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 2 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page" id="community-detail-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        {!nativeBack && (
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} id="community-back-btn" aria-label="Go back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{community.name}</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            by <button style={{ display: 'inline', color: 'inherit', fontWeight: 'bold' }} onClick={() => navigate(`/provider/${community.provider_id}`)}>{community.provider?.name || community.provider_name}</button>
          </p>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <Icon name="users" size={14} />
          <span style={{ color: 'var(--text-primary)' }}>{community.member_count}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-8 mb-20">
        {community.user_joined ? (
          <>
            <button
              className={`btn btn-block ${checkedIn ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleCheckin}
              disabled={checkedIn || checkingIn}
              id="checkin-btn"
              style={{ flex: 2 }}
            >
              {checkedIn ? (
                <span className="flex items-center justify-center gap-6"><Icon name="check" size={16} /> Checked in today</span>
              ) : (
                <>
                  {checkingIn && <span className="btn-spinner" aria-hidden="true" />}
                  Check In Today
                </>
              )}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleLeave}
              id="leave-btn"
              style={{ flex: 1 }}
            >
              Leave
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary btn-block"
            onClick={handleJoin}
            disabled={joining}
            id="join-btn"
          >
            {joining && <span className="btn-spinner" aria-hidden="true" />}
            Join Circle
          </button>
        )}
      </div>

      {/* Category + description */}
      <div className="flex items-center gap-8 mb-16">
        <span className={`category-badge ${community.category}`}>{community.category}</span>
      </div>

      {/* Tabs for Feed and Posts */}
      <div className="flex gap-8 mb-16">
        <button
          className={`chip flex items-center gap-6 ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Icon name="chart" size={14} /> Live Feed
        </button>
        <button
          className={`chip flex items-center gap-6 ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <Icon name="message-circle" size={14} /> Posts & Reactions
        </button>
      </div>

      {activeTab === 'feed' ? (
        <>
          <ChallengesList communityId={id} refreshKey={challengeRefreshKey} />
          <Leaderboard communityId={id} />
          {events.length > 0 ? (
            <div className="feed">
              {events.map(event => (
                <FeedEvent key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="chart" size={32} /></div>
              <div className="empty-state-text">No activity yet. Be the first to join!</div>
            </div>
          )}
        </>
      ) : (
        <PostFeed
          communityId={id}
          initialDraft={justJoined ? `Hi I'm ${user?.name?.split(' ')[0] || 'there'}, I'm glad to join you guys!` : undefined}
          onDraftConsumed={() => setJustJoined(false)}
        />
      )}
    </div>
  );
}
