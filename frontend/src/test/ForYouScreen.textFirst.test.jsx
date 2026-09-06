import { describe, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_FOR_YOU_FEED } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

/**
 * For You opens on two requests fired together: `/home/lite`, which answers
 * from a single keyset query over posts, and `/home/bootstrap`, which cannot
 * answer until the provider directory, every provider's services and both
 * event queries are done. The screen must paint the first without waiting for
 * the second — that gap is seconds on a cold serverless function.
 *
 * This lives in its own file on purpose: within one file, a previous test's
 * in-flight mock request can resolve into the cache after the next test's
 * `clearAll`, which would warm the bootstrap and hide exactly the window under
 * test here.
 */
describe('ForYouScreen — text-first paint', () => {
  it('renders posts while the provider-backed cards are still loading', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/home" element={<ForYouScreen />} />
      </Routes>,
      { route: '/home' }
    );

    const post = MOCK_FOR_YOU_FEED.find(i => i.type === 'post');
    const service = MOCK_FOR_YOU_FEED.find(i => i.type === 'service');

    await waitFor(() => expect(document.getElementById(`feed-post-${post.id}`)).toBeInTheDocument());
    // No skeleton once there is real text on the screen, and nothing that
    // needs a provider record yet.
    expect(document.getElementById('for-you-feed-skeleton')).not.toBeInTheDocument();
    expect(document.getElementById(`feed-service-${service.id}`)).not.toBeInTheDocument();

    // ...and the full payload still fills in behind it.
    await waitFor(() => expect(document.getElementById(`feed-service-${service.id}`)).toBeInTheDocument());
  });
});
