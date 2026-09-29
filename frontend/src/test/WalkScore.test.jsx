import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from './renderWithProviders';
import ProfileScreen from '../pages/ProfileScreen';
import PublicProfile from '../pages/PublicProfile';
import { MOCK_PUBLIC_USERS } from '../data/mock';
import WalkScoreBadge from '../components/WalkScoreBadge';

function renderProfile() {
  return renderWithProviders(<Routes><Route path="/profile" element={<ProfileScreen />} /></Routes>, { route: '/profile' });
}

describe('Walk Score profile and connection', () => {
  afterEach(() => { delete window.Telegram; });

  it('shows the score and opens Terra from the tracker button', async () => {
    const openLink = vi.fn();
    window.Telegram = { WebApp: { openLink, expand: vi.fn(), ready: vi.fn() } };
    renderProfile();
    expect(await screen.findByLabelText('Walk Score 12,840 steps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Fitness Tracker' }));
    await waitFor(() => expect(openLink).toHaveBeenCalledWith('https://widget.tryterra.co/session/mock'));
    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByText('Fitness tracker connected')).toBeInTheDocument();
  });

  it('shows a public score when profile activity is visible', async () => {
    const user = MOCK_PUBLIC_USERS[0];
    const previous = user.walk_score;
    user.walk_score = 23456;
    try {
      renderWithProviders(
        <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
        { route: `/users/${user.id}` },
      );
      expect(await screen.findByLabelText('Walk Score 23,456 steps')).toBeInTheDocument();
    } finally {
      user.walk_score = previous;
    }
  });

  it('counts from zero to the score', async () => {
    render(<WalkScoreBadge score={1234} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1,234')).toBeInTheDocument(), { timeout: 1600 });
  });

  it('respects private profile activity visibility', async () => {
    const user = MOCK_PUBLIC_USERS[0];
    const previous = user.profile_privacy;
    user.profile_privacy = 'private';
    try {
      renderWithProviders(
        <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
        { route: `/users/${user.id}` },
      );
      expect(await screen.findByText(/activity and circles are private/i)).toBeInTheDocument();
      expect(screen.queryByText('Walk Score')).toBeNull();
    } finally {
      user.profile_privacy = previous;
    }
  });
});
