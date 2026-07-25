import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import FollowersList from '../pages/FollowersList';
import { MOCK_PUBLIC_USERS } from '../data/mock';
import { renderWithProviders } from './renderWithProviders';

describe('FollowersList', () => {
  it('renders followers and lets the current user follow someone', async () => {
    renderWithProviders(
      <Routes><Route path="/users/:id/followers" element={<FollowersList />} /></Routes>,
      { route: `/users/${MOCK_PUBLIC_USERS[0].id}/followers` },
    );
    expect(await screen.findByText('Hana Girma')).toBeInTheDocument();
    const follow = screen.getByRole('button', { name: 'Follow' });
    fireEvent.click(follow);
    expect(await screen.findByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
  });

  it('uses a separate following route and active tab', async () => {
    renderWithProviders(
      <Routes><Route path="/users/:id/following" element={<FollowersList />} /></Routes>,
      { route: `/users/${MOCK_PUBLIC_USERS[0].id}/following` },
    );
    expect(await screen.findByText('Selam Alemu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toHaveClass('active');
  });
});
