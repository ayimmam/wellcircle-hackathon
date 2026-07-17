import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';

function renderProfile() {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>,
    { route: '/profile' }
  );
}

describe('ProfileScreen — Health App coming-soon wishlist', () => {
  it('shows a Coming soon badge instead of a connect toggle', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');
    expect(document.getElementById('health-app-coming-soon')).toBeInTheDocument();
    expect(document.getElementById('health-app-toggle')).toBeNull();
  });

  it('votes for a preset app and collapses to a thank-you message', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    fireEvent.change(document.getElementById('health-app-select'), { target: { value: 'Strava' } });
    fireEvent.click(document.getElementById('health-app-vote-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Thanks for voting: Strava/)).toBeInTheDocument();
    });
    expect(document.getElementById('health-app-select')).toBeNull();
  });

  it('reveals a free-text input for "Other" and requires it before submitting', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    fireEvent.change(document.getElementById('health-app-select'), { target: { value: 'Other' } });
    const otherInput = document.getElementById('health-app-other-input');
    expect(otherInput).toBeInTheDocument();
    expect(document.getElementById('health-app-vote-btn')).toBeDisabled();

    fireEvent.change(otherInput, { target: { value: 'Whoop' } });
    expect(document.getElementById('health-app-vote-btn')).not.toBeDisabled();

    fireEvent.click(document.getElementById('health-app-vote-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Thanks for voting: Whoop/)).toBeInTheDocument();
    });
  });
});
