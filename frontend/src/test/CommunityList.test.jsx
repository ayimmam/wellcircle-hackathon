import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CommunityList from '../pages/CommunityList';
import { renderWithProviders } from './renderWithProviders';
import { createCircle, cacheKeys } from '../api/client';
import { peek } from '../api/cache';

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

  it('creates a private circle with a generated invite code and opens it immediately', async () => {
    createCircle.mockResolvedValueOnce({ id: 'new-circle', name: 'Morning Yogis', join_code: 'INVITE42' });
    renderWithProviders(
      <Routes>
        <Route path="/" element={<CommunityList />} />
        <Route path="/circle/:id" element={<div>New circle chat</div>} />
      </Routes>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'My Circles' }));
    await waitFor(() => expect(document.getElementById('new-circle-name-input')).toBeInTheDocument());
    fireEvent.change(document.getElementById('new-circle-name-input'), { target: { value: 'Morning Yogis' } });
    fireEvent.click(screen.getByLabelText('Private Circle'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByText('New circle chat');
    expect(createCircle).toHaveBeenCalledWith({ name: 'Morning Yogis', description: '', is_private: true });
    expect(peek(cacheKeys.circle('new-circle'))?.data?.join_code).toBe('INVITE42');
  });
});
