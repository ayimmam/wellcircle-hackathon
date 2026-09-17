import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('adds a typed comment to the thread instantly, before the request resolves (WS7)', async () => {
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);
    const runPost = (await screen.findByText(/just finished a 5k run/i)).closest('.post-card');

    // 'Comment' toggle button carries the count, e.g. "Comment (1)".
    fireEvent.click(within(runPost).getByText(/^Comment/));
    const input = within(runPost).getByPlaceholderText('Write a comment...');
    fireEvent.change(input, { target: { value: 'Great job out there!' } });
    fireEvent.click(within(runPost).getByText('Send'));

    // No await on the network call — this is the state right after the tap.
    expect(within(runPost).getByText('Great job out there!')).toBeInTheDocument();
    // The composer closed and cleared, same as before.
    expect(within(runPost).queryByPlaceholderText('Write a comment...')).toBeNull();
  });

  it('adds a typed reply nested under its parent comment instantly (WS7)', async () => {
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);
    await screen.findByText(/just finished a 5k run/i);
    const niceRow = screen.getByText('Nice pace!').closest('.comment-row');

    fireEvent.click(within(niceRow).getByText('Reply'));
    const input = screen.getByPlaceholderText('Write a reply...');
    fireEvent.change(input, { target: { value: 'Agreed, well done!' } });
    fireEvent.click(screen.getByText('Send'));

    expect(screen.getByText('Agreed, well done!')).toBeInTheDocument();
  });

  it('offers a "Create first post" CTA that opens the composer when the feed is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostFeed circleId="no-such-circle" />);

    const cta = await screen.findByRole('button', { name: /create first post/i });
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();

    await user.click(cta);
    expect(screen.getByPlaceholderText(/share an update/i).tagName).toBe('TEXTAREA');
  });
});
