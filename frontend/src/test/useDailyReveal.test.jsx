import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDailyReveal from '../hooks/useDailyReveal';

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useDailyReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
    localStorage.clear();
    setHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it('is false before the delay, true after it', () => {
    const { result } = renderHook(() => useDailyReveal('checkin', 120000));
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(119000); });
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(true);
  });

  it('does not count time spent backgrounded', () => {
    const { result } = renderHook(() => useDailyReveal('checkin', 120000));

    act(() => { vi.advanceTimersByTime(60000); }); // 60s foreground
    act(() => { setHidden(true); });
    act(() => { vi.advanceTimersByTime(10 * 60000); }); // 10min hidden — must not count
    expect(result.current).toBe(false);

    act(() => { setHidden(false); }); // back to foreground, 60s already banked
    act(() => { vi.advanceTimersByTime(59000); });
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(1000); }); // the missing 1s completes the 120s total
    expect(result.current).toBe(true);
  });

  it('is revealed immediately on reload the same day, once it has already fired once', () => {
    const first = renderHook(() => useDailyReveal('checkin', 120000));
    act(() => { vi.advanceTimersByTime(120000); });
    expect(first.result.current).toBe(true);

    const second = renderHook(() => useDailyReveal('checkin', 120000));
    expect(second.result.current).toBe(true);
  });

  it('re-times on a new day rather than trusting yesterday\'s flag', () => {
    localStorage.setItem('wc_reveal_checkin', '2026-8-15'); // yesterday, in the hook's own key format
    const { result } = renderHook(() => useDailyReveal('checkin', 120000));
    expect(result.current).toBe(false); // a new day resets it
  });

  it('tracks separate keys under separate localStorage entries', () => {
    renderHook(() => useDailyReveal('checkin', 120000));
    act(() => { vi.advanceTimersByTime(120000); });
    expect(localStorage.getItem('wc_reveal_checkin')).not.toBeNull();
    expect(localStorage.getItem('wc_reveal_other')).toBeNull();
  });
});
