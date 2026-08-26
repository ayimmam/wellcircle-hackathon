import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useCheckin from '../hooks/useCheckin';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { track } from '../analytics';
import * as client from '../api/client';
import '../i18n';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const toasts = [];
vi.mock('../components/Toast', () => ({
  showToast: (message, kind) => toasts.push({ message, kind }),
  default: () => null,
}));

const wrapper = ({ children }) => (
  <MemoryRouter>
    <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
  </MemoryRouter>
);

/** Base check-in response; override per case. */
function checkinResponse(overrides) {
  return {
    points_earned: 0,
    new_balance: 120,
    current_streak: 2,
    freeze_count: 0,
    freeze_used: false,
    comeback_bonus: false,
    longest_streak: 3,
    is_personal_best: false,
    tier: 'sprout',
    ...overrides,
  };
}

function mockCheckin(overrides) {
  return vi.spyOn(client, 'checkinCommunity').mockResolvedValue(checkinResponse(overrides));
}

async function runCheckin(overrides, onMilestone) {
  mockCheckin(overrides);
  const { result } = renderHook(() => useCheckin('test', onMilestone), { wrapper });
  let res;
  await act(async () => { res = await result.current('c1'); });
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  toasts.length = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const messages = () => toasts.map(t => t.message).join(' | ');

describe('useCheckin — retention moments', () => {
  it('does not claim a streak was "continued" on a first-ever check-in', async () => {
    await runCheckin({ current_streak: 1, longest_streak: 1, is_personal_best: true });
    expect(toasts[0].message).toBe('Checked in');
  });

  it('says the streak continued from day two onward', async () => {
    await runCheckin({ current_streak: 2 });
    expect(toasts[0].message).toBe('Streak continued');
  });

  it('celebrates a comeback bonus and tracks it', async () => {
    await runCheckin({ current_streak: 1, comeback_bonus: true });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(messages()).toContain('Welcome back');
    expect(track).toHaveBeenCalledWith('comeback_bonus', { surface: 'test', streak: 1 });
  });

  it('reports a used streak freeze', async () => {
    await runCheckin({ current_streak: 6, freeze_used: true });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(messages()).toContain('Streak freeze used');
  });

  it('fires the milestone callback on every 7th day', async () => {
    const onMilestone = vi.fn();
    await runCheckin({ current_streak: 14, freeze_count: 2 }, onMilestone);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(onMilestone).toHaveBeenCalledWith({ type: 'streak', streak: 14, tier: 'sprout' });
    expect(track).toHaveBeenCalledWith('streak_milestone', { streak: 14, freezes: 2 });
    expect(messages()).toContain('Freeze earned');
  });

  it('fires a personal-best milestone when it is not also a 7-day mark', async () => {
    const onMilestone = vi.fn();
    await runCheckin({ current_streak: 5, longest_streak: 5, is_personal_best: true }, onMilestone);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(onMilestone).toHaveBeenCalledWith({ type: 'personal_best', streak: 5, tier: 'sprout' });
    expect(track).toHaveBeenCalledWith('streak_personal_best', { streak: 5 });
    expect(messages()).toContain('New personal best — 5 days');
  });

  it('prefers the 7-day milestone over personal best when both apply', async () => {
    const onMilestone = vi.fn();
    await runCheckin({ current_streak: 7, longest_streak: 7, is_personal_best: true }, onMilestone);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(onMilestone).toHaveBeenCalledTimes(1);
    expect(onMilestone).toHaveBeenCalledWith({ type: 'streak', streak: 7, tier: 'sprout' });
  });

  it('does not fire a milestone on an ordinary check-in', async () => {
    const onMilestone = vi.fn();
    await runCheckin({ current_streak: 3 }, onMilestone);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(onMilestone).not.toHaveBeenCalled();
    expect(messages()).toContain('3-day streak');
  });

  it('uses no emoji in any check-in toast', async () => {
    await runCheckin({ current_streak: 7, comeback_bonus: true, freeze_used: true });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(messages()).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('propagates a failed check-in to the caller', async () => {
    vi.spyOn(client, 'checkinCommunity').mockRejectedValue(new Error('Already checked in today'));
    const { result } = renderHook(() => useCheckin('test'), { wrapper });

    await expect(act(async () => { await result.current('c1'); }))
      .rejects.toThrow('Already checked in today');
  });

  it('syncs streak fields onto the auth user', async () => {
    mockCheckin({ current_streak: 9, longest_streak: 9, new_balance: 250, freeze_count: 1 });
    const { result } = renderHook(
      () => ({ checkin: useCheckin('test'), auth: useAuthForTest() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.auth.user).toBeTruthy());

    await act(async () => { await result.current.checkin('c1'); });

    expect(result.current.auth.user).toMatchObject({
      current_streak: 9, longest_streak: 9, points_balance: 250, freeze_count: 1,
    });
  });
});

// Imported lazily so the mock factories above are hoisted first.
import { useAuth } from '../context/AuthContext';
function useAuthForTest() { return useAuth(); }
