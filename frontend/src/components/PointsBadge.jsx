import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { getTier } from '../data/mock';
import { clickableDivProps } from '../utils/a11y';

export default function PointsBadge({ points, onClick }) {
  const tier = getTier(points);

  // Animate the number from 0 to points on first render
  const springValue = useSpring(0, { stiffness: 80, damping: 20 });
  const displayValue = useTransform(springValue, v => Math.round(v).toLocaleString());

  useEffect(() => {
    springValue.set(points);
  }, [points, springValue]);

  return (
    <div
      className="points-chip"
      id="points-badge"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      {...(onClick ? clickableDivProps(onClick) : {})}
    >
      <span className="points-chip-emoji">{tier.emoji}</span>
      <motion.span>{displayValue}</motion.span>
      <span> pts</span>
    </div>
  );
}
