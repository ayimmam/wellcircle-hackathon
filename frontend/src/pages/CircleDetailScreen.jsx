import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCircles, getCircleLeaderboard, joinCircle } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PostFeed from '../components/PostFeed';
import Leaderboard from '../components/Leaderboard';
import { showToast } from '../components/Toast';
import { MOCK_CIRCLES, MOCK_LEADERBOARD } from '../data/mock';
import Icon from '../components/Icon';
import { shareCircleInvite } from '../utils/circleInvite';

export default function CircleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [circle, setCircle] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'leaderboard' | 'members'

  useEffect(() => {
    loadCircle();
  }, [id]);

  const loadCircle = async () => {
    try {
      // Find circle details from mock or API
      const found = MOCK_CIRCLES.find(c => c.id === id);
      setCircle(found || { id, name: 'Circle', description: '', member_count: 0 });

      const res = await getCircleLeaderboard(id);
      setLeaderboard(res.leaderboard || []);

      // E1: fetch join_code (only returned for circles the user is already in)
      // for the invite link, without disturbing the name/description source above.
      try {
        const circlesRes = await getCircles();
        const match = (circlesRes.circles || []).find(c => c.id === id);
        if (match) {
          setJoined(Boolean(match.is_joined));
          if (match.join_code) {
            setCircle(prev => ({ ...prev, join_code: match.join_code }));
          }
        }
      } catch { /* invite link is a bonus, not required for the page to work */ }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // E1: invite via Telegram-native sharing (shared with the onboarding
  // circles step — see utils/circleInvite.js).
  const handleInvite = () => shareCircleInvite(circle, { source: 'circle_detail' });

  const handleJoin = async () => {
    let joinCode = null;
    if (circle?.is_private) {
      joinCode = prompt('This circle is private. Please enter the invitation code:');
      if (!joinCode) return;
    }
    try {
      await joinCircle(id, joinCode);
      setJoined(true);
      showToast('You joined the circle!', '🎉');
      if (circle) setCircle(prev => ({ ...prev, member_count: (prev.member_count || 0) + 1 }));
    } catch (err) {
      showToast('Error joining', '❌');
    }
  };

  if (loading || !circle) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  const tabs = [
    { key: 'chat', label: 'Chat', icon: '💬' },
    { key: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { key: 'members', label: 'Members', icon: '👥' },
  ];

  return (
    <div className="page" id="circle-detail-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-12">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>
          <Icon name="chevron-left" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {circle.is_private && '🔒 '}
            {circle.name}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {circle.description}
          </p>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <span>👥</span>
          <span style={{ color: 'var(--text-primary)' }}>{circle.member_count}</span>
        </div>
      </div>

      {/* Join / Joined + Invite */}
      <div className="flex gap-8 mb-16">
        {joined ? (
          <div className="btn btn-secondary" style={{ flex: 1, cursor: 'default', opacity: 0.7 }}>
            ✅ You're a member
          </div>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleJoin}>
            🤝 Join Circle
          </button>
        )}
        {joined && circle.join_code && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleInvite}>
            📤 Invite friends
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-16" style={{ overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`chip ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        joined ? <PostFeed circleId={id} /> : (
          <div className="card">
            <div className="card-body text-center" style={{ padding: '32px 16px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
              <h3 className="card-title mb-8">Join to participate</h3>
              <p className="text-secondary text-sm">You need to join this circle to view and participate in the chat.</p>
            </div>
          </div>
        )
      )}

      {activeTab === 'leaderboard' && (
        <div className="leaderboard">
          {leaderboard.length > 0 ? (
            <div className="flex-col gap-8">
              {leaderboard.map((member, idx) => (
                <div
                  key={member.user_id}
                  className="card"
                  style={{
                    background: idx === 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))' : 'var(--bg-card)',
                    border: idx === 0 ? '1px solid rgba(245,158,11,0.3)' : undefined
                  }}
                >
                  <div className="card-body flex items-center gap-12">
                    <div style={{
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      width: 28,
                      color: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : 'var(--text-secondary)'
                    }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#ccc' }}>
                      {member.photo_url
                        ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>👤</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{member.total_points} total pts</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-primary)' }}>
                      {member.weekly_points} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-secondary)' }}>this week</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <div className="empty-state-text">No leaderboard yet. Start checking in!</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="flex-col gap-8">
          {leaderboard.length > 0 ? leaderboard.map(member => (
            <div key={member.user_id} className="card">
              <div className="card-body flex items-center gap-12">
                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#ccc' }}>
                  {member.photo_url
                    ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>👤</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{member.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    🌿 {member.total_points} Legacy Points
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                  {member.weekly_points} pts/wk
                </div>
              </div>
            </div>
          )) : (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">No members to show yet.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
