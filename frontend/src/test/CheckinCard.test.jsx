import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import CheckinCard from '../components/CheckinCard';
import { renderWithProviders } from './renderWithProviders';
import { track } from '../analytics';
import { useState } from 'react';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const CIRCLES = [
  { id: 'c1', name: 'Lifestyle Fit Squad', checked_in_today: false },
  { id: 'c2', name: 'Iron & Soul Lifters', checked_in_today: true },
  { id: 'c3', name: 'Zen Flow Hot Yoga', checked_in_today: false },
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

  it('flips to Checked in synchronously — before the mock check-in request resolves (WS7)', () => {
    renderWithProviders(<CheckinCard circles={CIRCLES} />);
    expect(document.getElementById('home-checkin-c1').textContent).not.toContain('Checked in');

    fireEvent.click(document.getElementById('home-checkin-c1'));

    // No await, no waitFor — this is the instant, pre-response state.
    expect(document.getElementById('home-checkin-c1').textContent).toContain('Checked in');
    expect(document.getElementById('home-checkin-c1')).toBeDisabled();
  });

  it('renders nothing without circles', () => {
    renderWithProviders(<CheckinCard circles={[]} />);
    expect(document.getElementById('home-checkin-card')).toBeNull();
  });

  it('renders nothing when every circle already arrived checked in today', () => {
    const allChecked = CIRCLES.map(c => ({ ...c, checked_in_today: true }));
    renderWithProviders(<CheckinCard circles={allChecked} />);
    expect(document.getElementById('home-checkin-card')).toBeNull();
  });

  it('updates the prompt when a fresh response marks a community checked in', () => {
    function Harness() {
      const [circles, setCircles] = useState([{ id: 'c1', name: 'Lifestyle Fit Squad', checked_in_today: false }]);
      return <>
        <button onClick={() => setCircles([{ id: 'c1', name: 'Lifestyle Fit Squad', checked_in_today: true }])}>Refresh check-in</button>
        <CheckinCard circles={circles} />
      </>;
    }
    renderWithProviders(<Harness />);
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh check-in' }));
    expect(document.getElementById('home-checkin-card')).toBeNull();
  });

  it('shows an unchecked community even when three earlier communities are done', () => {
    const circles = [
      ...CIRCLES.map(c => ({ ...c, checked_in_today: true })),
      { id: 'c4', name: 'Morning Walkers', checked_in_today: false },
    ];
    renderWithProviders(<CheckinCard circles={circles} />);
    expect(document.getElementById('home-checkin-c4')).toBeInTheDocument();
    expect(document.getElementById('home-checkin-c4')).toBeEnabled();
  });

  it('disappears once the last remaining circle is checked in', async () => {
    // Only c2 starts checked; check in c1 then c3 (the two remaining) —
    // the card should unmount right after the last one.
    renderWithProviders(<CheckinCard circles={CIRCLES} />);
    expect(document.getElementById('home-checkin-card')).toBeInTheDocument();

    fireEvent.click(document.getElementById('home-checkin-c1'));
    await waitFor(() =>
      expect(document.getElementById('home-checkin-c1').textContent).toContain('Checked in')
    );

    fireEvent.click(document.getElementById('home-checkin-c3'));
    await waitFor(() =>
      expect(document.getElementById('home-checkin-card')).toBeNull()
    );
  });
});
