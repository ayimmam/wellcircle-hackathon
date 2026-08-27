import { getTier } from '../data/mock';
import { clickableDivProps } from '../utils/a11y';

export default function PointsBadge({ points, onClick }) {
  const tier = getTier(points);

  return (
    <div
      className="points-chip"
      id="points-badge"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      {...(onClick ? clickableDivProps(onClick) : {})}
    >
      <span className="points-chip-emoji">{tier.emoji}</span>
      <span>{points.toLocaleString()} pts</span>
    </div>
  );
}
