import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ExploreScreen from '../pages/ExploreScreen';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderExplore() {
  return renderWithProviders(
    <Routes>
      <Route path="/explore" element={<ExploreScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>,
    { route: '/explore' }
  );
}

describe('ExploreScreen — Near me filter', () => {
  afterEach(() => {
    MOCK_USER.location_neighborhood = null; // restore the shared mock fixture
  });

  it('navigates to Profile and opens the neighbourhood sheet when no neighbourhood is set yet', async () => {
    renderExplore(); // MOCK_USER.location_neighborhood is null by default
    await screen.findByText('Lifestyle Fitness Center');

    fireEvent.click(document.getElementById('filter-near-me'));

    await screen.findByText('Select your neighbourhood');
    expect(document.getElementById('neighbourhood-sheet')).toBeInTheDocument();
  });

  it('filters the provider list to matches only once a neighbourhood is set', async () => {
    MOCK_USER.location_neighborhood = 'Bole';
    renderExplore();
    await screen.findByText('Lifestyle Fitness Center'); // Bole — stays
    expect(screen.getByText('Iron & Soul Gym')).toBeInTheDocument(); // Kazanchis — present before filtering

    fireEvent.click(document.getElementById('filter-near-me'));

    expect(screen.getByText('Lifestyle Fitness Center')).toBeInTheDocument();
    expect(screen.queryByText('Iron & Soul Gym')).toBeNull();
  });
});
