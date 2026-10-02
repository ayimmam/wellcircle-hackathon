import { useCallback } from 'react';
import { checkinCommunity } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import { track } from '../analytics';


/**
 * Shared daily check-in behavior: points/streak toasts, user-state update,
 * 7-day milestone celebration (haptic + freeze copy), comeback-bonus and
 * personal-best celebration, and analytics. Used by both CommunityDetail's
 * check-in button and the ForYouScreen check-in card so the habit loop feels
 * identical everywhere.
 *
 * `onMilestone(data)` — optional. Fired for share-worthy moments (7-day
 * streak multiples, new personal bests) so callers can surface the
 * ShareCard without useCheckin owning any render tree of its own.
 *
 * Throws on failure (e.g. already checked in) — callers handle their own
 * error copy. Returns the check-in response for caller-specific behavior
 * (feed events, challenge refresh).
 */
export default function useCheckin(surface, onMilestone) {
  const { user, setUser } = useAuth();

  return useCallback(async (communityId) => {
    track('checkin_attempt', { surface, community_id: communityId });
    let res;
    try {
      res = await checkinCommunity(communityId);
    } catch (error) {
      track('checkin_failure', {
        surface,
        community_id: communityId,
        status: error?.status || (error?.isNetworkNoise ? 'network' : 'unknown'),
      });
      throw error;
    }
    setUser(prev => prev ? {
      ...prev,
      points_balance: res.new_balance,
      current_streak: res.current_streak ?? prev.current_streak,
      freeze_count: res.freeze_count ?? prev.freeze_count,
      longest_streak: res.longest_streak ?? prev.longest_streak,
    } : prev);
    track('checkin', { surface, community_id: communityId, streak: res.current_streak });
    if ((user?.longest_streak ?? 0) === 0 && res.current_streak === 1) {
      track('first_checkin', { surface, community_id: communityId });
    }

    if (res.comeback_bonus) {
      track('comeback_bonus', { surface, streak: res.current_streak });
    }
    if (res.current_streak > 0 && res.current_streak % 7 === 0) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      track('streak_milestone', { streak: res.current_streak, freezes: res.freeze_count });
      onMilestone?.({ type: 'streak', streak: res.current_streak, tier: res.tier });
    } else if (res.is_personal_best && res.current_streak > 1) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      track('streak_personal_best', { streak: res.current_streak });
      onMilestone?.({ type: 'personal_best', streak: res.current_streak, tier: res.tier });
    }
    // One confirmation per user per Addis day, even if several circle views
    // react to the same check-in. Keep all earned context in that one toast.
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date());
    const toastKey = `wellcircle-checkin-toast:${user?.id || 'guest'}:${day}`;
    let shown = false;
    try { shown = sessionStorage.getItem(toastKey) === '1'; } catch { /* storage can be disabled */ }
    if (!shown) {
      const details = ['Checked in'];
      if (res.current_streak > 1) details.push(`${res.current_streak}-day streak`);
      if (res.freeze_used) details.push('streak freeze used');
      if (res.comeback_bonus) details.push('+15 pts comeback bonus');
      if (res.current_streak > 0 && res.current_streak % 7 === 0) details.push('freeze earned');
      else if (res.is_personal_best && res.current_streak > 1) details.push('new personal best');
      showToast(details.join(' · '), 'success');
      try { sessionStorage.setItem(toastKey, '1'); } catch { /* storage can be disabled */ }
    }
    return res;
  }, [surface, user?.id, user?.longest_streak, setUser, onMilestone]);
}
