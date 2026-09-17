import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderForYou() {
  return renderWithProviders(
    <Routes><Route path="/home" element={<ForYouScreen />} /></Routes>,
    { route: '/home' }
  );
}

// WS2 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the chatbot moved to
// Explore; the "+" composer took its spot, and posting is instant.
describe('ForYouScreen — "+" post composer', () => {
  it('shows the post composer FAB, not the chatbot one', async () => {
    renderForYou();
    await waitFor(() => expect(document.getElementById('for-you-feed')).toBeInTheDocument());
    expect(document.getElementById('post-composer-fab')).toBeInTheDocument();
    expect(document.getElementById('ask-wellcircle-fab')).toBeNull();
  });

  it('adds a typed post to the top of the feed instantly, before the request resolves', async () => {
    renderForYou();
    await waitFor(() => expect(document.getElementById('for-you-feed')).toBeInTheDocument());
    // The composer needs the signed-in user (author info for the optimistic
    // card) — mock auth resolves independently of the feed data, and the
    // greeting text alone isn't a reliable signal (it falls back to "Hey,
    // there" while `user` is still null).
    await waitFor(() => expect(document.getElementById('points-badge')).toBeInTheDocument());

    fireEvent.click(document.getElementById('post-composer-fab'));
    fireEvent.change(document.getElementById('post-composer-textarea'), {
      target: { value: 'Feeling great after todays walk!' },
    });
    fireEvent.click(document.getElementById('post-composer-submit'));

    // No await on the network call — the composer already closed and the
    // card is already there, marked "Posting…".
    expect(document.getElementById('post-composer-sheet')).not.toBeInTheDocument();
    expect(screen.getByText('Feeling great after todays walk!')).toBeInTheDocument();
    expect(screen.getByText('Posting…')).toBeInTheDocument();

    // Once the mock request resolves, the pending indicator clears.
    await waitFor(() => expect(screen.queryByText('Posting…')).toBeNull());
  });

  it('submit is disabled with no text and no photo', async () => {
    renderForYou();
    await waitFor(() => expect(document.getElementById('for-you-feed')).toBeInTheDocument());
    fireEvent.click(document.getElementById('post-composer-fab'));
    expect(document.getElementById('post-composer-submit')).toBeDisabled();
  });
});
