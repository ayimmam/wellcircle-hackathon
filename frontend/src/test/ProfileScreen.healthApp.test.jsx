import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER } from '../data/mock';

function renderProfile(route = '/profile') {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>,
    { route }
  );
}

describe('ProfileScreen — Strava integration', () => {
  it('replaces the health-app wishlist with Strava connection UI', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');
    expect(screen.getByRole('button', { name: 'Connect with Strava' })).toBeInTheDocument();
    expect(document.getElementById('health-app-coming-soon')).toBeNull();
  });

  it('shows editable bio, follower counts, privacy, and trainer verification', async () => {
    renderProfile();
    // The bio is read-only until Edit is tapped — a permanently open textarea
    // made the top of the profile read as a form.
    await screen.findByText('Legacy Points');
    expect(screen.queryByLabelText('Profile bio')).toBeNull();
    fireEvent.click(document.getElementById('edit-bio-btn'));
    expect(await screen.findByLabelText('Profile bio')).toHaveAttribute('maxlength', '300');

    expect(screen.getByText('Followers only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Verified' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Followers/ })).toBeInTheDocument();
  });

  it('handles the OAuth callback, visibility updates, and disconnect sync', async () => {
    renderProfile('/profile?strava=connected');

    expect(await screen.findByText('Connected to Strava')).toBeInTheDocument();
    expect(MOCK_USER.health_app_connected).toBe(true);
    const calories = screen.getByRole('checkbox', { name: 'Calories' });
    expect(calories).not.toBeChecked();
    fireEvent.click(calories);
    await waitFor(() => expect(calories).toBeChecked());

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('button', { name: 'Connect with Strava' })).toBeInTheDocument();
    expect(MOCK_USER.health_app_connected).toBe(false);
  });
});
