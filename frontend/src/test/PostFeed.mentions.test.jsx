import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostFeed from '../components/PostFeed';
import { renderWithProviders } from './renderWithProviders';

// Zen Circle — getCircleLeaderboard is circle-agnostic in mock mode and
// always returns MOCK_LEADERBOARD (src/data/mock.js), whose members include
// telegram_handle 'tesfa' for Yonas.
const CIRCLE_ID = '33333333-0000-0000-0000-000000000001';

describe('PostFeed — @mention autocomplete', () => {
  it('suggests circle members as "@" is typed, and inserts the picked handle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);
    await screen.findByText(/just finished a 5k run/i);

    await user.click(document.querySelector('.input.flex.items-center'));
    const composer = screen.getByPlaceholderText(/type @ to mention someone/i);
    await user.type(composer, 'great run with @te');

    await waitFor(() => expect(document.getElementById('mention-suggestions')).toBeInTheDocument());
    const suggestion = within(document.getElementById('mention-suggestions')).getByRole('button', { name: /yonas/i });
    await user.click(suggestion);

    await waitFor(() => expect(composer).toHaveValue('great run with @tesfa '));
    expect(document.getElementById('mention-suggestions')).not.toBeInTheDocument();
  });

  it('renders a posted @mention as a link to the mentioned member\'s profile', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostFeed circleId={CIRCLE_ID} />);
    await screen.findByText(/just finished a 5k run/i);

    await user.click(document.querySelector('.input.flex.items-center'));
    const composer = screen.getByPlaceholderText(/type @ to mention someone/i);
    await user.type(composer, 'great run with @te');
    await waitFor(() => expect(document.getElementById('mention-suggestions')).toBeInTheDocument());
    await user.click(within(document.getElementById('mention-suggestions')).getByRole('button', { name: /yonas/i }));
    await user.click(screen.getByRole('button', { name: /^post$/i }));

    const mentionLink = await screen.findByRole('button', { name: '@tesfa' });
    expect(mentionLink).toBeInTheDocument();
  });
});
