import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunity, getCommunityFeed, joinCommunity, leaveCommunity, checkinCommunity } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FeedEvent from '../components/FeedEvent';
import { showToast } from '../components/Toast';

export default function CommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [community, setCommunity] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [joining, setJoining] = useState(false);
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

  // Poll feed every 5 seconds
  useEffect(() => {
    if (!community) return;
    const interval = setInterval(async () => {
      try {
        const res = await getCommunityFeed(id, lastTimestamp.current);
        if (res.events.length > 0) {
          setEvents(prev => [...res.events, ...prev]);
          lastTimestamp.current = res.events[0].created_at;
        }
      } catch (err) {
        // Silently fail polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, community]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await joinCommunity(id);
      setCommunity(prev => ({ ...prev, user_joined: true, member_count: res.member_count }));
      // Add join event to feed
      if (res.feed_event) {
        setEvents(prev => [{ ...res.feed_event, user_photo: user?.photo_url }, ...prev]);
      }
      showToast('Welcome to the circle! 🎉', '🤝');
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
    } catch (err) {
      showToast('Already a member', '👥');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      const res = await leaveCommunity(id);
      setCommunity(prev => ({ ...prev, user_joined: false, member_count: res.member_count }));
      showToast('Left the circle', '👋');
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: (prev.joined_communities || []).filter(cid => cid !== id)
        }));
      }
    } catch (err) {
      showToast('Error leaving community', '❌');
    }
  };

  const handleCheckin = async () => {
    try {
      const res = await checkinCommunity(id);
      setCheckedIn(true);
      showToast(`+${res.points_earned} Legacy Points earned!`, '🏆');
      // Update user points
      if (user) {
        setUser(prev => ({ ...prev, points_balance: res.new_balance }));
      }
      // Add checkin event to feed
      if (res.feed_event) {
        setEvents(prev => [{ ...res.feed_event, user_photo: user?.photo_url }, ...prev]);
      }
    } catch (err) {
      showToast('Already checked in today', '✅');
      setCheckedIn(true);
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
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} id="community-back-btn">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{community.name}</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            by {community.provider?.name || community.provider_name}
          </p>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <span>👥</span>
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
              disabled={checkedIn}
              id="checkin-btn"
              style={{ flex: 2 }}
            >
              {checkedIn ? '✅ Checked in today' : '✨ Check In Today'}
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
            {joining ? 'Joining...' : '🤝 Join Circle'}
          </button>
        )}
      </div>

      {/* Category + description */}
      <div className="flex items-center gap-8 mb-16">
        <span className={`category-badge ${community.category}`}>{community.category}</span>
      </div>

      {/* Live Feed */}
      <div className="section-header">
        <h2 className="section-title">Live Feed</h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          🟢 Live · updates every 5s
        </span>
      </div>

      {events.length > 0 ? (
        <div className="feed">
          {events.map(event => (
            <FeedEvent key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-text">No activity yet. Be the first to join!</div>
        </div>
      )}
    </div>
  );
}
