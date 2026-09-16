import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderForYou() {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<ForYouScreen />} />
    </Routes>,
    { route: '/home' }
  );
}

// WS4 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the check-in card
// appears 2 minutes into the session, once per day.
describe('ForYouScreen — check-in card daily-reveal delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at mount and for the first 2 minutes, then appears', async () => {
    renderForYou();

    // Let mock auth (~800ms) and the home payload settle so joined circles
    // actually exist to prompt a check-in — otherwise "absent" would be
    // trivially true for the wrong reason.
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(document.getElementById('home-checkin-card')).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(118000); });
    expect(document.getElementById('home-checkin-card')).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
  });

  it('appears immediately on a later open the same day, once already revealed', async () => {
    localStorage.setItem('wc_reveal_checkin', (() => {
      const d = new Date();
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })());

    renderForYou();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
  });
});
