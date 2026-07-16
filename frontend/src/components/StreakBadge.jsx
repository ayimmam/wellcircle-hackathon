import { useEffect } from 'react';
import { track } from '../analytics';

export default function StreakBadge({ streak, freezeCount = 0, atRisk = false }) {
  useEffect(() => {
    if (streak && atRisk) track('streak_risk_view', { streak, freezes: freezeCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(streak && atRisk)]);

  if (!streak) return null;

  const title = atRisk
    ? 'No check-in yet today — one check-in keeps your streak alive'
    : freezeCount ? `${freezeCount} streak freeze${freezeCount > 1 ? 's' : ''} available` : undefined;

  return (
    <div className="points-chip" id="streak-badge" title={title} style={{ position: 'relative' }}>
      <span className="points-chip-emoji">🔥</span>
      <span>{streak}d streak{freezeCount > 0 ? ' · freeze' : ''}</span>
      {atRisk && (
        <span
          id="streak-risk-dot"
          aria-label="Streak at risk today"
          style={{
            position: 'absolute', top: -2, right: -2, width: 8, height: 8,
            borderRadius: '50%', background: 'var(--warning, #f59e0b)',
          }}
        />
      )}
    </div>
  );
}
