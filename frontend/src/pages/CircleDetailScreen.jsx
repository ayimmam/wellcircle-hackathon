import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCircleLeaderboard, joinCircle } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PostFeed from '../components/PostFeed';
import { showToast } from '../components/Toast';

export default function CircleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'leaderboard'

  useEffect(() => {
    loadLeaderboard();
  }, [id]);

  const loadLeaderboard = async () => {
    try {
      const res = await getCircleLeaderboard(id);
      setLeaderboard(res.leaderboard || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      await joinCircle(id);
      showToast('Joined circle!', '✅');
      loadLeaderboard();
    } catch (err) {
      showToast('Error joining', '❌');
    }
  };

  return (
    <div className="page" id="circle-detail-screen">
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Circle</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Micro-community
          </p>
        </div>
      </div>

      <div className="flex gap-8 mb-16">
        <button className="btn btn-primary btn-block" onClick={handleJoin}>Join Circle</button>
      </div>

      <div className="flex gap-8 mb-16">
        <button
          className={`chip ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          📝 Posts
        </button>
        <button
          className={`chip ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {activeTab === 'posts' ? (
        <PostFeed circleId={id} />
      ) : (
        <div className="leaderboard">
          {leaderboard.length > 0 ? (
            <div className="flex-col gap-8">
              {leaderboard.map((member, idx) => (
                <div key={member.user_id} className="card" style={{ background: idx === 0 ? 'var(--accent-gold)' : 'var(--bg-card)' }}>
                  <div className="card-body flex items-center gap-12">
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', width: 24 }}>#{idx + 1}</div>
                    <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#ccc' }}>
                      {member.photo_url ? <img src={member.photo_url} alt="" style={{ width:'100%', borderRadius: '50%' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: '0.75rem' }}>{member.total_points} total pts</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {member.weekly_points} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No members in this circle yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
