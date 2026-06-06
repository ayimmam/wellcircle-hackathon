import { getTier } from '../data/mock';

export default function PointsBadge({ points }) {
  const tier = getTier(points);

  return (
    <div className="points-chip" id="points-badge">
      <span className="points-chip-emoji">{tier.emoji}</span>
      <span>{points.toLocaleString()} pts</span>
    </div>
  );
}
