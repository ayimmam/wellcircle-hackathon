import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import PublicProfile from '../pages/PublicProfile';
import { MOCK_PUBLIC_USERS, MOCK_USER } from '../data/mock';
import { renderWithProviders } from './renderWithProviders';

describe('PublicProfile', () => {
  afterEach(() => {
    delete MOCK_PUBLIC_USERS[0].stats_hidden;
    MOCK_PUBLIC_USERS[0].profile_privacy = 'public';
    MOCK_PUBLIC_USERS[0].is_following = false;
    MOCK_PUBLIC_USERS[0].follower_count = 148;
    MOCK_USER.profile_privacy = 'public';
  });

  it('shows verified identity, follower links, Strava attribution, and created circles', async () => {
    const profile = MOCK_PUBLIC_USERS[0];
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${profile.id}` },
    );
    expect(await screen.findByRole('heading', { name: /Hana Girma/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Verified trainer')).toBeInTheDocument();
    expect(screen.getByLabelText('Powered by Strava')).toBeInTheDocument();
    expect(screen.getByText('128.4 km')).toBeInTheDocument();
    expect(screen.getByText(/10.2 km/)).toBeInTheDocument();
    expect(screen.getByText('Hana Endurance Club')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument());
  });

  it('does not label created circles as joined circles', async () => {
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${MOCK_PUBLIC_USERS[0].id}` },
    );
    await screen.findByText(/Circles created by/);
    expect(screen.queryByText('Joined Circles')).toBeNull();
  });

  it('hides activity and created circles when privacy denies access', async () => {
    MOCK_PUBLIC_USERS[0].profile_privacy = 'private';
    MOCK_PUBLIC_USERS[0].stats_hidden = true;
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${MOCK_PUBLIC_USERS[0].id}` },
    );

    expect(await screen.findByText(/activity and circles are private/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Powered by Strava')).toBeNull();
    expect(screen.queryByText('Hana Endurance Club')).toBeNull();
  });

  it('allows the owner to see their created circles on a private profile', async () => {
    MOCK_USER.profile_privacy = 'private';
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${MOCK_USER.id}` },
    );

    expect(await screen.findByText('Zen Seekers')).toBeInTheDocument();
    expect(screen.queryByText(/activity and circles are private/i)).toBeNull();
  });

  it('refreshes protected content after following a followers-only profile', async () => {
    MOCK_PUBLIC_USERS[0].profile_privacy = 'followers';
    MOCK_PUBLIC_USERS[0].stats_hidden = true;
    renderWithProviders(
      <Routes><Route path="/users/:id" element={<PublicProfile />} /></Routes>,
      { route: `/users/${MOCK_PUBLIC_USERS[0].id}` },
    );

    expect(await screen.findByText(/activity and circles are private/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(await screen.findByLabelText('Powered by Strava')).toBeInTheDocument();
    expect(screen.getByText('Hana Endurance Club')).toBeInTheDocument();
  });
});
