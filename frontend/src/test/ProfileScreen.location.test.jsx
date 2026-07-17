import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';

describe('ProfileScreen — location nudge deep link', () => {
  it('auto-opens the neighbourhood sheet when navigated with openNeighbourhood state', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>,
      { route: '/profile', state: { openNeighbourhood: true } }
    );

    await screen.findByText('Select your neighbourhood');
    expect(document.getElementById('neighbourhood-sheet')).toBeInTheDocument();
  });

  it('does not open the sheet on a plain visit', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>,
      { route: '/profile' }
    );

    await screen.findByText('Legacy Points');
    expect(document.getElementById('neighbourhood-sheet')).toBeNull();
  });
});
