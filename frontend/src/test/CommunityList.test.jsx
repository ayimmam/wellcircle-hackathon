import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import CommunityList from '../pages/CommunityList';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    getCommunities: vi.fn().mockResolvedValue({ communities: [] }),
    getCircles: vi.fn().mockResolvedValue({ circles: [] }),
    getRanks: vi.fn().mockResolvedValue({ users: [], league: [] }),
    joinCommunity: vi.fn(),
    createCircle: vi.fn(),
  };
});

describe('CommunityList — actionable empty states', () => {
  it('offers a "Create your first circle" CTA that focuses the name input', async () => {
    renderWithProviders(<CommunityList />);
    fireEvent.click(screen.getByRole('button', { name: 'My Circles' }));

    const cta = await screen.findByRole('button', { name: /create your first circle/i });
    fireEvent.click(cta);

    await waitFor(() => expect(document.getElementById('new-circle-name-input')).toHaveFocus());
  });

  it('offers a "Browse circles" CTA on the joined tab that switches to explore', async () => {
    renderWithProviders(<CommunityList />);
    fireEvent.click(screen.getByRole('button', { name: 'Joined' }));

    const cta = await screen.findByRole('button', { name: /browse circles/i });
    fireEvent.click(cta);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Explore' })).toHaveClass('active'));
  });
});
