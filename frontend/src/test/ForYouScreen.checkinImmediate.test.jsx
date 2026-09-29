import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER, MOCK_COMMUNITIES } from '../data/mock';
import { cacheKeys } from '../api/client';
import { setCacheScope, write } from '../api/cache';

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

describe('ForYouScreen — immediate check-in prompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('wc_token');
    localStorage.removeItem('wc_reveal_checkin');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appears as soon as joined communities load, without waiting two minutes', async () => {
    renderForYou();

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
    expect(document.querySelector('#home-checkin-card button:not([disabled])')).toBeInTheDocument();
  });

  it('ignores the old daily-reveal timer state', async () => {
    localStorage.setItem('wc_reveal_checkin', 'yesterday');
    renderForYou();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
  });

  it('shows joined communities from cache on the first render after reopening', () => {
    localStorage.setItem('wc_token', 'saved-token');
    setCacheScope(MOCK_USER.id);
    write(cacheKeys.me(), MOCK_USER);
    write(cacheKeys.homeLite(), {
      partial: true,
      communities: MOCK_COMMUNITIES.filter(c => c.user_joined),
      feed: { items: [], next_before: null },
      stories: [],
    });

    renderForYou();
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
  });

  it('does not keep yesterday’s checked-in state on the first render', () => {
    vi.setSystemTime(new Date('2026-09-28T20:00:00Z'));
    localStorage.setItem('wc_token', 'saved-token');
    setCacheScope(MOCK_USER.id);
    write(cacheKeys.me(), MOCK_USER);
    write(cacheKeys.homeLite(), {
      partial: true,
      communities: MOCK_COMMUNITIES.filter(c => c.user_joined)
        .map(c => ({ ...c, checked_in_today: true })),
      feed: { items: [], next_before: null },
      stories: [],
    });
    vi.setSystemTime(new Date('2026-09-29T08:00:00Z'));

    renderForYou();
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
    expect(document.querySelector('#home-checkin-card button:not([disabled])')).toBeInTheDocument();
  });
});
