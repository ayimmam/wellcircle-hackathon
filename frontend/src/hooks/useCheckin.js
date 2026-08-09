import { useCallback } from 'react';
import { checkinCommunity } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import { track } from '../analytics';

/**
 * Shared daily check-in behavior: points/streak toasts, user-state update,
 * 7-day milestone celebration (haptic + freeze copy), and analytics. Used by
 * both CommunityDetail's check-in button and the ForYouScreen check-in card so
 * the habit loop feels identical everywhere.
 *
 * Throws on failure (e.g. already checked in) — callers handle their own
 * error copy. Returns the check-in response for caller-specific behavior
 * (feed events, challenge refresh).
 */
export default function useCheckin(surface) {
  const { setUser } = useAuth();

  return useCallback(async (communityId) => {
    const res = await checkinCommunity(communityId);
    showToast('Streak continued!', 'success');
    setUser(prev => prev ? {
      ...prev,
      points_balance: res.new_balance,
      current_streak: res.current_streak ?? prev.current_streak,
      freeze_count: res.freeze_count ?? prev.freeze_count,
    } : prev);
    track('checkin', { surface, community_id: communityId, streak: res.current_streak });

    if (res.freeze_used) {
      setTimeout(() => showToast(
        `Streak freeze used — your ${res.current_streak}-day streak survived!`,
        'success'
      ), 1200);
    }
    if (res.current_streak > 0 && res.current_streak % 7 === 0) {
      // Milestone: every 7 days earns a streak freeze — celebrate it
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      setTimeout(() => showToast(
        `${res.current_streak}-day streak! Freeze earned — miss a day without losing it.`,
        'success'
      ), 2400);
      track('streak_milestone', { streak: res.current_streak, freezes: res.freeze_count });
    } else if (res.current_streak > 1) {
      setTimeout(() => showToast(`🔥 ${res.current_streak}-day streak!`, 'success'), 1200);
    }
    return res;
  }, [surface, setUser]);
}
