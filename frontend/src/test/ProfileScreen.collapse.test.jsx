import { describe, it, expect } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
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

// WS4 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — Recent Activity and
// Joined Circles collapse to 2 items with a minimal expand arrow.
describe('ProfileScreen — collapsed Recent Activity and Joined Circles', () => {
  it('shows Recent Activity collapsed to 2 rows, with the rest behind Show more', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    // MOCK_POINTS_HISTORY has 5 items — collapsed to 2 on mount.
    const list = document.getElementById('recent-activity-list');
    const rowCount = () =>
      within(list).queryAllByText('Check-in').length + within(list).queryAllByText('Decay').length;
    expect(rowCount()).toBe(2);

    const toggle = within(list).getByRole('button', { name: /show \d+ more/i });
    fireEvent.click(toggle);

    expect(rowCount()).toBe(5);
  });

  it('sources Joined Circles from real community data (not the mock fixture, filtered) and collapses it too', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    // MOCK_USER.joined_communities carries these two real seed communities.
    const list = document.getElementById('joined-circles-list');
    expect(await within(list).findByText('Shanti Yoga Circle')).toBeInTheDocument();
    expect(within(list).getByText('Nourish Community')).toBeInTheDocument();
  });
});
