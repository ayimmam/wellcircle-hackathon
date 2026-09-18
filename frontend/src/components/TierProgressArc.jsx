/**
 * TierProgressArc — SVG arc showing % progress to the next tier.
 * Renders as a half-circle arc above the tier name on ProfileHeader.
 * Uses Motion to animate the arc stroke on mount.
 */
import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { TIERS } from '../data/mock';

const SIZE = 90;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = Math.PI * R; // half circle
const CX = SIZE / 2;
const CY = SIZE / 2;

export default function TierProgressArc({ points, tier }) {
  const currentTierIndex = TIERS.findIndex(t => t.tier === tier.tier);
  const nextTier = TIERS[currentTierIndex + 1];

  // Progress from current tier min to next tier min (or 100% if max tier)
  const pct = nextTier
    ? Math.min(1, (points - tier.min) / (nextTier.min - tier.min))
    : 1;

  const springPct = useSpring(0, { stiffness: 60, damping: 18 });
  const dashOffset = useTransform(springPct, v => CIRCUMFERENCE * (1 - v));

  useEffect(() => {
    springPct.set(pct);
  }, [pct, springPct]);

  return (
    <div className="tier-arc-wrapper" aria-label={`${Math.round(pct * 100)}% to ${nextTier?.name || 'max tier'}`}>
      <svg
        width={SIZE}
        height={SIZE / 2 + STROKE}
        viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`}
        overflow="visible"
      >
        {/* Track arc */}
        <path
          d={`M ${STROKE / 2} ${CY} A ${R} ${R} 0 0 1 ${SIZE - STROKE / 2} ${CY}`}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <motion.path
          d={`M ${STROKE / 2} ${CY} A ${R} ${R} 0 0 1 ${SIZE - STROKE / 2} ${CY}`}
          fill="none"
          stroke={tier.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
        {/* Tier emoji in centre */}
        <text
          x={CX}
          y={CY + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
        >
          {tier.emoji}
        </text>
      </svg>

      <span className="tier-arc-label">{tier.name}</span>
      {nextTier && (
        <span className="tier-arc-next">
          {nextTier.min - points} pts to {nextTier.name} {nextTier.emoji}
        </span>
      )}
    </div>
  );
}
