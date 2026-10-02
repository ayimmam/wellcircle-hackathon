import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useCheckin from '../hooks/useCheckin';

const mocks = vi.hoisted(() => ({
  user: { id: 'new-user', longest_streak: 0 },
  checkin: vi.fn(), track: vi.fn(), setUser: vi.fn(),
}));
vi.mock('../api/client', () => ({ checkinCommunity: mocks.checkin }));
vi.mock('../analytics', () => ({ track: mocks.track }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, setUser: mocks.setUser }) }));
vi.mock('../components/Toast', () => ({ showToast: vi.fn() }));

describe('first check-in measurement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.longest_streak = 0;
    mocks.checkin.mockResolvedValue({ current_streak: 1, longest_streak: 1, new_balance: 10 });
  });

  it('tracks a confirmed first check-in', async () => {
    const { result } = renderHook(() => useCheckin('home'));
    await act(() => result.current('community'));
    expect(mocks.track).toHaveBeenCalledWith('first_checkin', { surface: 'home', community_id: 'community' });
  });

  it('does not classify a returning member as newly activated', async () => {
    mocks.user.longest_streak = 5;
    const { result } = renderHook(() => useCheckin('home'));
    await act(() => result.current('community'));
    expect(mocks.track.mock.calls.some(([name]) => name === 'first_checkin')).toBe(false);
  });

  it('does not count a rejected check-in as activation', async () => {
    mocks.checkin.mockRejectedValue({ status: 409 });
    const { result } = renderHook(() => useCheckin('home'));
    await act(async () => {
      await expect(result.current('community')).rejects.toEqual({ status: 409 });
    });
    expect(mocks.track.mock.calls.some(([name]) => name === 'first_checkin')).toBe(false);
  });
});
