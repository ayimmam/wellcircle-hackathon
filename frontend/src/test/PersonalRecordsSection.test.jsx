import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import PublicProfile from '../pages/PublicProfile';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER, MOCK_PUBLIC_USERS } from '../data/mock';

function renderProfile() {
  return renderWithProviders(
    <Routes><Route path="/profile" element={<ProfileScreen />} /></Routes>,
    { route: '/profile' }
  );
}

describe('Personal Records — set on own profile, shown on public profile', () => {
  it('lets the owner add and remove a personal record on their own profile', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    expect(screen.getByText('24:10')).toBeInTheDocument(); // seeded 5K PR

    fireEvent.click(document.getElementById('add-pr-btn'));
    fireEvent.change(screen.getByLabelText('Record label'), { target: { value: '10K' } });
    fireEvent.change(screen.getByLabelText('Record value'), { target: { value: '52:00' } });
    fireEvent.click(document.getElementById('save-pr-btn'));

    // The UI updates instantly now (WS7 optimistic profile edits) — it no
    // longer waits for the mock's own round trip, so assert the eventual
    // server-side mutation separately rather than coupling it to the text
    // appearing.
    expect(await screen.findByText('52:00')).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(MOCK_USER.personal_records.some(r => r.label === '10K' && r.value === '52:00')).toBe(true);
    });

    const removeBtn = screen.getByLabelText('Remove 10K');
    fireEvent.click(removeBtn);
    await vi.waitFor(() => expect(screen.queryByText('52:00')).not.toBeInTheDocument());
  });

  it("shows a member's personal records on their public profile", async () => {
    const hana = MOCK_PUBLIC_USERS.find(u => u.telegram_handle === 'hana_runs');
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${hana.id}` }
    );

    expect(await screen.findByText('10K')).toBeInTheDocument();
    expect(screen.getByText('48:32')).toBeInTheDocument();
  });
});
