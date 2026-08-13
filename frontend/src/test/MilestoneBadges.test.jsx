import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';
import { getEarnedMilestoneBadges, getNextMilestone, daysSinceJoin } from '../utils/milestones';

function renderProfile() {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>,
    { route: '/profile' }
  );
}

describe('ProfileScreen — milestone badges', () => {
  it('always shows a Joined badge, and a tier badge once past Seed', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    expect(document.getElementById('milestone-badge-joined')).toBeInTheDocument();
    // Mock user has 120 pts -> Sprout tier (100-299)
    expect(document.getElementById('milestone-badge-tier-sprout')).toBeInTheDocument();
    // Mock user's longest_streak is 3 — below the lowest (7-day) threshold
    expect(document.getElementById('milestone-badge-streak-7')).toBeNull();
  });
});

describe('milestones utils', () => {
  it('getEarnedMilestoneBadges adds a streak badge only once a threshold is met', () => {
    const noStreak = getEarnedMilestoneBadges({ points_balance: 0, longest_streak: 6 });
    expect(noStreak.find(b => b.id.startsWith('streak-'))).toBeUndefined();

    const withStreak = getEarnedMilestoneBadges({ points_balance: 0, longest_streak: 7 });
    expect(withStreak.find(b => b.id === 'streak-7')).toBeTruthy();

    const higherStreak = getEarnedMilestoneBadges({ points_balance: 0, longest_streak: 15 });
    // Only the highest threshold crossed is shown, not every one below it
    expect(higherStreak.filter(b => b.id.startsWith('streak-'))).toHaveLength(1);
    expect(higherStreak.find(b => b.id === 'streak-14')).toBeTruthy();
  });

  it('getNextMilestone prioritizes an in-progress streak over the next tier', () => {
    const midStreak = getNextMilestone({ current_streak: 3, points_balance: 50 });
    expect(midStreak.label).toContain('4 more days to a 7-day streak freeze');

    const noStreak = getNextMilestone({ current_streak: 0, points_balance: 50 });
    expect(noStreak.label).toContain('Sprout tier');
  });

  it('daysSinceJoin returns 1 on the join day and grows with elapsed time', () => {
    expect(daysSinceJoin(new Date().toISOString())).toBe(1);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(daysSinceJoin(tenDaysAgo)).toBe(11);
  });
});
