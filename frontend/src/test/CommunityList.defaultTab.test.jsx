import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import CommunityList from '../pages/CommunityList';
import { renderWithProviders } from './renderWithProviders';

// WS4 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — Community opens on
// "My Circles" rather than the discovery list.
describe('CommunityList — default tab', () => {
  it('opens on My Circles by default', async () => {
    renderWithProviders(<CommunityList />);
    expect(await screen.findByRole('button', { name: 'My Circles' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Explore' })).not.toHaveClass('active');
  });

  it('honors an explicit location.state.tab (a caller can still land on a specific tab)', async () => {
    renderWithProviders(<CommunityList />, { route: '/community', state: { tab: 'ranks' } });
    expect(await screen.findByRole('button', { name: /ranks/i })).toHaveClass('active');
  });
});
