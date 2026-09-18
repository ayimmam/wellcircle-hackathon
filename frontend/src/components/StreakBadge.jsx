import { useEffect } from 'react';
import { track } from '../analytics';

/** Solid filled flame SVG — matches the minimal rounded flame reference */
function FlameIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <path d="M12 2C12 2 7 7.5 7 13a5 5 0 0 0 10 0c0-2.5-1.5-4.5-2.5-5.5 0 0 0 2-1.5 3C13 9 12 6 12 2Z" />
    </svg>
  );
}

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
      <FlameIcon
        size={14}
        color={atRisk ? 'var(--warning, #f59e0b)' : '#f43f5e'}
      />
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
