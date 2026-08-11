import { TIERS, getTier } from '../data/mock';

export const STREAK_BADGE_THRESHOLDS = [7, 14, 30, 60, 100];

/** 1-indexed day count since account creation ("Day 1" on join day). */
export function daysSinceJoin(createdAt) {
  if (!createdAt) return 1;
  const diffDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return Math.max(1, diffDays + 1);
}

/**
 * The single next thing worth chasing — a live streak takes priority
 * (it's the nearer, more concrete goal), otherwise the next points tier.
 */
export function getNextMilestone(user) {
  const streak = user?.current_streak || 0;
  const points = user?.points_balance || 0;

  if (streak > 0) {
    const nextStreakGoal = Math.ceil((streak + 1) / 7) * 7;
    const daysAway = nextStreakGoal - streak;
    if (daysAway > 0) {
      return {
        emoji: '🔥',
        label: `${daysAway} more day${daysAway === 1 ? '' : 's'} to a ${nextStreakGoal}-day streak freeze`,
      };
    }
  }

  const nextTier = TIERS.find(t => t.min > points);
  if (nextTier) {
    const remaining = nextTier.min - points;
    return {
      emoji: nextTier.emoji,
      label: `${remaining} more point${remaining === 1 ? '' : 's'} to ${nextTier.name} tier`,
    };
  }

  return { emoji: '🔥', label: 'Keep checking in to build your streak' };
}

/** Derived, not stored — badges are computed from existing user fields. */
export function getEarnedMilestoneBadges(user) {
  const badges = [{ id: 'joined', emoji: '🎉', label: 'Joined' }];

  const longest = user?.longest_streak || 0;
  const bestStreak = [...STREAK_BADGE_THRESHOLDS].reverse().find(t => longest >= t);
  if (bestStreak) {
    badges.push({ id: `streak-${bestStreak}`, emoji: '🔥', label: `${bestStreak}-Day Streak` });
  }

  const tier = getTier(user?.points_balance || 0);
  if (tier.tier !== 'seed') {
    badges.push({ id: `tier-${tier.tier}`, emoji: tier.emoji, label: `${tier.name} Tier` });
  }

  return badges;
}
