import { getTier } from '../data/mock';

export default function PointsBadge({ points, onClick }) {
  const tier = getTier(points);

  return (
    <div className="points-chip" id="points-badge" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className="points-chip-emoji">{tier.emoji}</span>
      <span>{points.toLocaleString()} pts</span>
    </div>
  );
}
