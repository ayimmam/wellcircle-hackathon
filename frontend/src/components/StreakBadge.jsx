export default function StreakBadge({ streak, freezeCount = 0 }) {
  if (!streak) return null;

  return (
    <div className="points-chip" id="streak-badge" title={freezeCount ? `${freezeCount} streak freeze${freezeCount > 1 ? 's' : ''} available` : undefined}>
      <span className="points-chip-emoji">🔥</span>
      <span>{streak}d streak{freezeCount > 0 ? ' · 🧊' : ''}</span>
    </div>
  );
}
