import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useCheckin from '../hooks/useCheckin';
import useOptimisticAction from '../hooks/useOptimisticAction';
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
  const runOptimistic = useOptimisticAction();
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());

  const isChecked = (circle) => circle.checked_in_today || checkedIds.has(circle.id);
  // Keep the card compact, but always show circles that still need a check-in.
  const list = [...(circles || [])].sort((a, b) => Number(isChecked(a)) - Number(isChecked(b))).slice(0, 3);
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

  // Once every joined circle is checked in (including ones that arrived
  // already checked_in_today), the card has nothing left to prompt — unmount
  // it. The toast for the last check-in is rendered by the global
  // ToastContainer, not inside this card, so it survives the unmount. The
  // milestone ShareCard (if any) still needs to render even though the
  // check-in prompt itself is gone.
  const allDone = (circles || []).every(isChecked);
  if (allDone) return shareCard || null;

  // Show a pending state while the server confirms the check-in. A failed
  // request must remain retryable instead of looking like a completed action.
  const handleCheckin = (id) => {
    track('checkin_prompt_click', { surface: 'home', community_id: id });
    runOptimistic({
      apply: () => {
        setBusyIds(prev => new Set([...prev, id]));
        return () => setBusyIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      request: () => checkin(id),
      reconcile: () => {
        setCheckedIds(new Set((circles || []).map(c => c.id)));
        onChecked?.(id);
      },
      failureMessage: (error) => {
        if (error?.status === 409) {
          setCheckedIds(new Set((circles || []).map(c => c.id)));
          onChecked?.(id);
          return null;
        }
        if (error?.status === 403) {
          navigate(`/community/${id}`);
          return 'Join this community again to check in.';
        }
        if (error?.status === 401) return 'Your session expired. Reopen Well Circle to sign in again.';
        return "Couldn't check in. Check your connection and try again.";
      },
      dedupeKey: `checkin-${id}`,
    });
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
          const done = isChecked(c);
          return (
            <div key={c.id} className="flex items-center justify-between gap-8">
              <span style={{ fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              <button
                className={`btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}`}
                disabled={done || busyIds.has(c.id)}
                onClick={() => handleCheckin(c.id)}
                id={`home-checkin-${c.id}`}
              >
                {done ? (
                  <span className="flex items-center gap-4"><Icon name="check" size={13} /> Checked in</span>
                ) : busyIds.has(c.id) ? (
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
