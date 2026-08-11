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
    // Ranks are plain numerals; the top three are marked with the accent
    // colour rather than medal emoji.
    ['1', '2', '3', '4'].forEach(rank => {
      expect(screen.getByText(rank)).toBeInTheDocument();
    });
    const topRow = document.getElementById('rank-community-22222222-0000-0000-0000-000000000003');
    expect(topRow.querySelector('span').getAttribute('style')).toContain('--accent');
  });

  it('navigates to the community detail page when a ranked community row is tapped', async () => {
    renderCommunityList();
    fireEvent.click(document.getElementById('tab-ranks'));
    await screen.findByText('Shanti Yoga Circle');

    fireEvent.click(document.getElementById('rank-community-22222222-0000-0000-0000-000000000003'));
    await screen.findByText('Community Detail Page');
  });

  it('switches to Individuals and shows a "Your League" section when the user is outside the top list', async () => {
    renderCommunityList();
    fireEvent.click(document.getElementById('tab-ranks'));
    await screen.findByText('Shanti Yoga Circle');

    fireEvent.click(document.getElementById('ranks-view-individuals'));
    await screen.findByText('Hana Girma');

    // The mock auth login resolves slower (~800ms) than the mock ranks
    // fetch (~300ms), so "own row" highlighting only appears once the
    // AuthContext user has loaded — wait for it rather than racing it.
    await waitFor(() => {
      expect(screen.getByText('Your League — this week')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText(/Meron Tadesse/).textContent).toContain('You');

    const ownRow = document.getElementById('league-user-00000000-0000-0000-0000-000000000001');
    expect(ownRow).toBeInTheDocument();
    expect(ownRow.getAttribute('style')).toContain('brand-primary');

    // Not stranded in a global ranking — the league is a small, nearby group.
    expect(screen.getByText('Bereket Assefa')).toBeInTheDocument();
    expect(screen.getByText('Liya Fikru')).toBeInTheDocument();
  });
});
