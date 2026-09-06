import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CircleDetailScreen from '../pages/CircleDetailScreen';
import { MOCK_CIRCLES } from '../data/mock';
import { renderWithProviders } from './renderWithProviders';

describe('CircleDetailScreen — preview mode (public free circle, non-member)', () => {
  const publicCircle = MOCK_CIRCLES.find(c => !c.is_joined && !c.is_private && !c.is_paid);

  afterEach(() => {
    publicCircle.is_joined = false;
    publicCircle.member_count = MOCK_CIRCLES.find(c => c.id === publicCircle.id)?.member_count;
  });

  function renderCircle() {
    return renderWithProviders(
      <Routes><Route path="/circle/:id" element={<CircleDetailScreen />} /></Routes>,
      { route: `/circle/${publicCircle.id}` },
    );
  }

  it('shows a read-only preview feed, hides leaderboard/members tabs and the invite button, and shows a sticky Join CTA', async () => {
    renderCircle();
    await screen.findByText(publicCircle.name);

    // No composer, reaction buttons, or comment boxes in preview mode
    expect(document.getElementById('circle-preview-feed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leaderboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Members' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Invite friends/i })).toBeNull();

    expect(document.getElementById('circle-preview-join-btn')).toBeInTheDocument();
  });

  it('joining flips to full mode in place, with no navigation', async () => {
    renderCircle();
    await screen.findByText(publicCircle.name);

    fireEvent.click(document.getElementById('circle-preview-join-btn'));

    await waitFor(() => expect(document.getElementById('circle-preview-join-btn')).not.toBeInTheDocument());
    expect(document.getElementById('circle-preview-feed')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(await screen.findByText("You're a member")).toBeInTheDocument();
  });
});
