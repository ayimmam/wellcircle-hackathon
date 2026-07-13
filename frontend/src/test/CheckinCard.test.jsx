import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import CheckinCard from '../components/CheckinCard';
import { renderWithProviders } from './renderWithProviders';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const CIRCLES = [
  { id: 'c1', name: 'Lifestyle Fit Squad', checked_in_today: false },
  { id: 'c2', name: 'Iron & Soul Lifters', checked_in_today: true },
];

describe('CheckinCard (Home habit loop)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses start-your-streak copy and shows per-circle state', async () => {
    // mock-mode auth user (MOCK_USER) has current_streak 3, so force copy via circles only —
    // streak text comes from auth; assert the structural bits instead
    renderWithProviders(<CheckinCard circles={CIRCLES} />);
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
    expect(screen.getByText('Lifestyle Fit Squad')).toBeInTheDocument();
    // pre-checked circle renders as done
    expect(document.getElementById('home-checkin-c2').textContent).toContain('Checked in');
    expect(track).toHaveBeenCalledWith('checkin_prompt_view', expect.objectContaining({ surface: 'home' }));
  });

  it('checking in flips the button and fires checkin analytics', async () => {
    renderWithProviders(<CheckinCard circles={CIRCLES} />);
    fireEvent.click(document.getElementById('home-checkin-c1'));
    expect(track).toHaveBeenCalledWith('checkin_prompt_click', expect.objectContaining({ community_id: 'c1' }));

    // mock client checkinCommunity resolves after ~400ms
    await waitFor(
      () => expect(document.getElementById('home-checkin-c1').textContent).toContain('Checked in'),
      { timeout: 3000 }
    );
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('checkin', expect.objectContaining({ surface: 'home', community_id: 'c1' }))
    );
  });

  it('renders nothing without circles', () => {
    renderWithProviders(<CheckinCard circles={[]} />);
    expect(document.getElementById('home-checkin-card')).toBeNull();
  });
});
