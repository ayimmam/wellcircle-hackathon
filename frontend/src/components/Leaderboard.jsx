import React, { useEffect, useState } from 'react';
import { getLeaderboard, createInteraction } from '../api/client';
import { showToast } from './Toast';

const Leaderboard = ({ communityId }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await getLeaderboard(communityId);
        setLeaderboard(res.leaderboard || []);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [communityId]);

  const handleInteraction = async (targetUserId, actionType) => {
    try {
      await createInteraction(communityId, targetUserId, actionType);
      showToast(`Sent a ${actionType}!`, '🎉');
    } catch (err) {
      console.error(err);
      showToast(`Failed to send ${actionType}`, '❌');
    }
  };

  if (loading) return null;
  if (leaderboard.length === 0) return null;

  return (
    <div className="mb-16">
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>Top Check-ins (Last 30 Days)</h3>
      <div className="card" style={{ padding: '0' }}>
        {leaderboard.map((u, i) => (
          <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: '24px', fontWeight: 'bold', color: i < 3 ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
              {i + 1}
            </div>
            <img 
              src={u.photo_url || `https://ui-avatars.com/api/?name=${u.name}&background=random`} 
              alt={u.name}
              style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 12px' }}
            />
            <div style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{u.name}</div>
            <div style={{ fontWeight: 700, color: 'var(--brand-primary)', marginRight: '16px' }}>{u.checkins_last_30_days}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleInteraction(u.user_id, 'nudge')}>👉</button>
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleInteraction(u.user_id, 'high-five')}>🙌</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
