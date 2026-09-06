import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import PostFeed from '../components/PostFeed';
import { renderWithProviders } from './renderWithProviders';

// Zen Circle (33333333-0000-0000-0000-000000000001) — mock post #1 carries
// run stats + a comment with a nested reply (see src/data/mock.js).
const CIRCLE_ID = '33333333-0000-0000-0000-000000000001';

describe('PostFeed — Strava-style activity', () => {
  it('renders a run post with its distance/duration stats', async () => {
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);

    expect(await screen.findByText(/just finished a 5k run/i)).toBeInTheDocument();
    expect(screen.getByText(/Run · 5 km · 28 min/)).toBeInTheDocument();
  });

  it('renders a top-level comment with its reply nested underneath', async () => {
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);

    await screen.findByText(/just finished a 5k run/i);
    expect(screen.getByText('Nice pace!')).toBeInTheDocument();
    expect(screen.getByText('Thanks! Trying to beat it next week.')).toBeInTheDocument();
  });

  it('gifts points via the coin icon rather than an emoji label', async () => {
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);

    await screen.findByText(/just finished a 5k run/i);
    const giftButtons = screen.getAllByTitle(/Gift Legacy Points/);
    expect(giftButtons.length).toBeGreaterThan(0);
    giftButtons.forEach(btn => expect(btn.querySelector('svg.icon')).toBeTruthy());
  });

  it('pre-fills the composer with a join-intro draft and consumes it once', async () => {
    const onDraftConsumed = vi.fn();
    renderWithProviders(
      <PostFeed circleId={CIRCLE_ID} initialDraft="Hi I'm Meron, I'm glad to join you guys!" onDraftConsumed={onDraftConsumed} />
    );

    await screen.findByText(/just finished a 5k run/i);
    expect(screen.getByDisplayValue("Hi I'm Meron, I'm glad to join you guys!")).toBeInTheDocument();
    expect(onDraftConsumed).toHaveBeenCalledTimes(1);
  });
});
