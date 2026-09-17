import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard, createInteraction } from '../api/client';
import useOptimisticAction from '../hooks/useOptimisticAction';
import { showToast } from './Toast';
import SmartImage from './SmartImage';
import { clickableDivProps } from '../utils/a11y';

const Leaderboard = ({ communityId }) => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const runOptimistic = useOptimisticAction();

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

  // Optimistic (WS7): there's no per-user "already nudged" state to flip
  // here, so the instant feedback is the success toast itself — it shows
  // the moment the button is tapped rather than after the round trip.
  const handleInteraction = (targetUserId, actionType) => {
    runOptimistic({
      apply: () => showToast(`Sent a ${actionType}!`, 'success'),
      request: () => createInteraction(communityId, targetUserId, actionType),
      failureMessage: `Failed to send ${actionType}`,
      dedupeKey: `${targetUserId}-${actionType}`,
    });
  };

  if (loading) return null;
  if (leaderboard.length === 0) return null;

  return (
    <div className="mb-16">
      <h3 className="section-title mb-12">Top Check-ins (Last 30 Days)</h3>
      <div className="feed">
        {leaderboard.map((u, i) => (
          <div key={u.user_id} className="cell">
            <div className={`cell-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
            <div className="avatar avatar-md" style={{ cursor: 'pointer' }} aria-label={u.name} {...clickableDivProps(() => navigate(`/users/${u.user_id}`))}>
              <SmartImage
                src={u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                alt={u.name}
                width={36}
              />
            </div>
            <div className="cell-body cell-title" style={{ cursor: 'pointer' }} {...clickableDivProps(() => navigate(`/users/${u.user_id}`))}>{u.name}</div>
            <div className="cell-trailing" style={{ marginRight: 8 }}>{u.checkins_last_30_days}</div>
            <div className="flex gap-8">
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
