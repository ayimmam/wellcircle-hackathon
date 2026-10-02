import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useCheckin from '../hooks/useCheckin';
import { showToast } from './Toast';
import { track } from '../analytics';
import Icon from './Icon';
import ShareCard from './ShareCard';

/**
 * Daily check-in card on Home — the habit-loop trigger. Check-in used to live
 * only inside CommunityDetail; this surfaces it where users land every day.
 * Streak == 0 users get "start your streak" copy (first-value nudge); everyone
 * else gets streak-continuation copy. Uses the same useCheckin hook as
 * CommunityDetail so toasts/milestones/analytics behave identically.
 */
export default function CheckinCard({ circles, onChecked }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shareMilestone, setShareMilestone] = useState(null);
  const checkin = useCheckin('home', setShareMilestone);
  const [checkedIds, setCheckedIds] = useState(() =>
    new Set((circles || []).filter(c => c.checked_in_today).map(c => c.id))
  );
  const [busyId, setBusyId] = useState(null);

  const list = (circles || []).slice(0, 3);
  const streak = user?.current_streak || 0;

  useEffect(() => {
    if (list.length > 0) {
      track('checkin_prompt_view', { surface: 'home', streak, circles: list.length });
    }
    // once per mount — the prompt, not each re-render, is the event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareCard = shareMilestone && <ShareCard milestone={shareMilestone} onClose={() => setShareMilestone(null)} />;

  if (list.length === 0) return shareCard || null;

  // Confirm the daily action, then invite a visit to the community's real
  // activity feed to close the loop with other members.
  const allDone = list.every(c => checkedIds.has(c.id));
  if (allDone) return (
    <div className="card mb-24" style={{ padding: 16 }} id="home-community-activity-card">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 6 }}>You're checked in today</h3>
      <p className="text-sm text-secondary mb-12">See how your community is doing and cheer someone on.</p>
      <button className="btn btn-sm btn-outline" onClick={() => {
        track('community_activity_open', { source: 'home_after_checkin', community_id: list[0].id });
        navigate(`/community/${list[0].id}`);
      }}>See community activity</button>
      {shareCard}
    </div>
  );

  const handleCheckin = async (id) => {
    setBusyId(id);
    track('checkin_prompt_click', { surface: 'home', community_id: id });
    try {
      await checkin(id);
      setCheckedIds(new Set((circles || []).map(c => c.id)));
      onChecked?.(id);
    } catch (err) {
      if (err?.status === 409) {
        setCheckedIds(new Set((circles || []).map(c => c.id)));
        onChecked?.(id);
      } else if (err?.status === 403) {
        showToast('Join this community again to check in.', 'error');
        navigate(`/community/${id}`);
      } else if (err?.status === 401) {
        showToast('Your session expired. Reopen Well Circle to sign in again.', 'error');
      } else {
        showToast("Couldn't check in. Check your connection and try again.", 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card mb-24" style={{ padding: 16 }} id="home-checkin-card">
      <div className="flex items-center gap-6" style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>
        <Icon name={streak === 0 ? 'star' : 'flame'} size={15} />
        {streak === 0
          ? 'Start your streak — check in daily!'
          : `Keep your ${streak}-day streak going`}
      </div>
      <div className="flex-col gap-8">
        {list.map(c => {
          const done = checkedIds.has(c.id);
          return (
            <div key={c.id} className="flex items-center justify-between gap-8">
              <span style={{ fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              <button
                className={`btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}`}
                disabled={done || busyId === c.id}
                onClick={() => handleCheckin(c.id)}
                id={`home-checkin-${c.id}`}
              >
                {done ? (
                  <span className="flex items-center gap-4"><Icon name="check" size={13} /> Checked in</span>
                ) : busyId === c.id ? (
                  <span className="btn-spinner" aria-hidden="true" />
                ) : 'Check in'}
              </button>
            </div>
          );
        })}
      </div>
      {shareCard}
    </div>
  );
}
