import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const SEEN_KEY = `wc_join_card_seen_v1_${MOCK_USER.id}`;

function renderForYou() {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<ForYouScreen />} />
    </Routes>,
    { route: '/home' }
  );
}

describe('ForYouScreen — one-time "Day N on WellCircle" share card', () => {
  beforeEach(() => {
    localStorage.removeItem(SEEN_KEY);
  });

  it('shows the join ShareCard once on first load, for both new and existing accounts', async () => {
    renderForYou();
    await waitFor(() => expect(document.getElementById('share-card-sheet')).toBeInTheDocument());
    expect(document.getElementById('share-card-caption').textContent).toContain('on WellCircle');
    expect(localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('does not show it again once already seen', async () => {
    localStorage.setItem(SEEN_KEY, '1');
    renderForYou();
    await screen.findByText(/Your wellness journey awaits/);
    expect(document.getElementById('share-card-sheet')).toBeNull();
  });
});
