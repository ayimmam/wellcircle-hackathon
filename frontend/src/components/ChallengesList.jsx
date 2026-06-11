import React, { useEffect, useState } from 'react';
import { getChallenges } from '../api/client';

const ChallengesList = ({ communityId }) => {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await getChallenges(communityId);
        setChallenges(res.challenges || []);
      } catch (err) {
        console.error('Error fetching challenges:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChallenges();
  }, [communityId]);

  if (loading) return null;
  if (challenges.length === 0) return null;

  return (
    <div className="mb-16">
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>Active Challenges</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {challenges.map(c => {
          const progress = c.user_progress || { checkins_this_period: 0, completed: false };
          const percent = Math.min(100, Math.round((progress.checkins_this_period / c.target_checkins) * 100));
          return (
            <div key={c.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                  +{c.reward_points} pts
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {c.description}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span>{progress.checkins_this_period} / {c.target_checkins} check-ins</span>
                  {progress.completed && <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Completed</span>}
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percent}%`, background: progress.completed ? '#10b981' : 'var(--brand-primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChallengesList;
