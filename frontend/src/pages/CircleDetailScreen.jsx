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
  // Right after joining, land on Activity with a friendly intro pre-filled —
  // one less blank-page moment for a brand-new member.
  const [justJoined, setJustJoined] = useState(false);

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

      // Fetch the real circle (name/description/member_count/join_code) from
      // the live list — previously this only merged join_code, so a real
      // (non-mock) circle always displayed the generic 'Circle' fallback name.
      try {
        const circlesRes = await getCircles();
        const match = (circlesRes.circles || []).find(c => c.id === id);
        if (match) {
          setJoined(Boolean(match.is_joined));
          setCircle(prev => ({
            ...prev,
            name: match.name || prev.name,
            description: match.description ?? prev.description,
            member_count: match.member_count ?? prev.member_count,
            ...(match.join_code ? { join_code: match.join_code } : {}),
          }));
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
      setJustJoined(true);
      setActiveTab('chat');
      showToast('You joined the circle!', 'success');
      if (circle) setCircle(prev => ({ ...prev, member_count: (prev.member_count || 0) + 1 }));
    } catch (err) {
      showToast('Error joining', 'error');
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
    { key: 'chat', label: 'Activity', icon: 'message-circle' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { key: 'members', label: 'Members', icon: 'users' },
  ];

  return (
    <div className="page" id="circle-detail-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-12">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>
          <Icon name="chevron-left" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="flex items-center gap-6" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {circle.is_private && <Icon name="lock" size={16} />}
            {circle.name}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {circle.description}
          </p>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <Icon name="users" size={14} />
          <span style={{ color: 'var(--text-primary)' }}>{circle.member_count}</span>
        </div>
      </div>

      {/* Join / Joined + Invite */}
      <div className="flex gap-8 mb-16">
        {joined ? (
          <div className="btn btn-secondary flex items-center justify-center gap-6" style={{ flex: 1, cursor: 'default', opacity: 0.7 }}>
            <Icon name="check" size={16} /> You're a member
          </div>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleJoin}>
            Join Circle
          </button>
        )}
        {joined && circle.join_code && (
          <button className="btn btn-secondary flex items-center justify-center gap-6" style={{ flex: 1 }} onClick={handleInvite}>
            <Icon name="send" size={15} /> Invite friends
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-16" style={{ overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`chip flex items-center gap-6 ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        joined ? (
          <PostFeed
            circleId={id}
            initialDraft={justJoined ? `Hi I'm ${user?.name?.split(' ')[0] || 'there'}, I'm glad to join you guys!` : undefined}
            onDraftConsumed={() => setJustJoined(false)}
          />
        ) : (
          <div className="card">
            <div className="card-body text-center" style={{ padding: '32px 16px' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icon name="lock" size={40} /></div>
              <h3 className="card-title mb-8">Join to participate</h3>
              <p className="text-secondary text-sm">You need to join this circle to view and participate in the chat.</p>
            </div>
          </div>
        )
      )}

      {activeTab === 'leaderboard' && (
        <div className="leaderboard">
          {leaderboard.length > 0 ? (
            <div className="feed">
              {leaderboard.map((member, idx) => (
                <div
                  key={member.user_id}
                  className={`cell leaderboard-row ${idx === 0 ? 'leader' : ''}`}
                >
                  <div className={`cell-rank ${idx < 3 ? 'top' : ''}`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  <div className="avatar avatar-md">
                    {member.photo_url
                      ? <img src={member.photo_url} alt="" />
                      : <Icon name="user" size={16} />
                    }
                  </div>
                  <div className="cell-body">
                    <div className="cell-title">{member.name}</div>
                    <div className="cell-subtitle">{member.total_points} total pts</div>
                  </div>
                  <div className="cell-trailing">
                    {member.weekly_points}
                    <div className="cell-trailing-sub">this week</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="trophy" size={32} /></div>
              <div className="empty-state-text">No leaderboard yet. Start checking in!</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="feed">
          {leaderboard.length > 0 ? leaderboard.map(member => (
            <div key={member.user_id} className="cell">
              <div className="avatar avatar-lg">
                {member.photo_url
                  ? <img src={member.photo_url} alt="" />
                  : <Icon name="user" size={18} />
                }
              </div>
              <div className="cell-body">
                <div className="cell-title">{member.name}</div>
                <div className="cell-subtitle">
                  <Icon name="leaf" size={12} /> {member.total_points} Legacy Points
                </div>
              </div>
              <div className="cell-trailing" style={{ fontSize: '0.8rem' }}>{member.weekly_points} pts/wk</div>
            </div>
          )) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="users" size={32} /></div>
              <div className="empty-state-text">No members to show yet.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
