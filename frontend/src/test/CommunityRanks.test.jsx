import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import CommunityList from '../pages/CommunityList';
import { renderWithProviders } from './renderWithProviders';

function renderCommunityList() {
  return renderWithProviders(
    <Routes>
      <Route path="/community" element={<CommunityList />} />
      <Route path="/community/:id" element={<div>Community Detail Page</div>} />
    </Routes>,
    { route: '/community' }
  );
}

describe('CommunityList — Ranks tab', () => {
  it('shows the weekly leaderboard with communities ranked, medals for the top 3', async () => {
    renderCommunityList();
    fireEvent.click(document.getElementById('tab-ranks'));

    await screen.findByText('Shanti Yoga Circle');
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('navigates to the community detail page when a ranked community row is tapped', async () => {
    renderCommunityList();
    fireEvent.click(document.getElementById('tab-ranks'));
    await screen.findByText('Shanti Yoga Circle');

    fireEvent.click(document.getElementById('rank-community-22222222-0000-0000-0000-000000000003'));
    await screen.findByText('Community Detail Page');
  });

  it('switches to Individuals and highlights the signed-in user\'s own row', async () => {
    renderCommunityList();
    fireEvent.click(document.getElementById('tab-ranks'));
    await screen.findByText('Shanti Yoga Circle');

    fireEvent.click(document.getElementById('ranks-view-individuals'));
    await screen.findByText('Hana Girma');

    // The mock auth login resolves slower (~800ms) than the mock ranks
    // fetch (~300ms), so "own row" highlighting only appears once the
    // AuthContext user has loaded — wait for it rather than racing it.
    await waitFor(() => {
      expect(screen.getByText(/Meron Tadesse/).textContent).toContain('You');
    }, { timeout: 2000 });

    const ownRow = document.getElementById('rank-user-00000000-0000-0000-0000-000000000001');
    expect(ownRow).toBeInTheDocument();
    expect(ownRow.getAttribute('style')).toContain('brand-primary');
  });
});
