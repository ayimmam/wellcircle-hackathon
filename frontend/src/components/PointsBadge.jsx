import { getTier } from '../data/mock';
import Icon from './Icon';

export default function PointsBadge({ points, onClick }) {
  const tier = getTier(points);

  return (
    <div className="points-chip" id="points-badge" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <Icon name="leaf" size={14} style={{ color: tier.color }} title={tier.name} />
      <span>{points.toLocaleString()} pts</span>
    </div>
  );
}
