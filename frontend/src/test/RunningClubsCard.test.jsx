import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RunningClubsCard from '../components/feed/RunningClubsCard';

// This same suite also runs against the browser build's compile-time surface.
describe('Pinned running clubs', () => {
  it('lists all four clubs without an API request and can collapse and reopen', () => {
    render(<RunningClubsCard />);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4);
    const trigger = screen.getByRole('button', { name: 'Choose a club' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('button', { name: /Bertusew Running Club/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Explore Running Communities' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('selects, switches and resets clubs while preserving the pinned banner', () => {
    render(<RunningClubsCard />);
    fireEvent.click(screen.getByRole('button', { name: /Bertusew Running Club/ }));
    const detail = screen.getByRole('article', { name: 'Bertusew Running Club' });
    expect(within(detail).getByText(/Previous announcement/)).toBeInTheDocument();
    expect(within(detail).getByRole('link', { name: 'Join Telegram Community' })).toHaveAttribute('href', 'https://t.me/bertusewrunningclub');
    const trigger = screen.getByRole('button', { name: 'Bertusew Running Club' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Satenaw Running Club Thursdays/ }));
    expect(screen.queryByRole('article', { name: 'Bertusew Running Club' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Satenaw Running Club' })).toHaveTextContent('5:30 PM');
    expect(screen.getByRole('heading', { name: /GreatRun 10K/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to all clubs' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4);
  });

  it('shows missing contact links as useful handle text with no placeholder anchor', () => {
    render(<RunningClubsCard />);
    fireEvent.click(screen.getByRole('button', { name: /Bole Burners Running Club/ }));
    expect(screen.getByRole('article')).toHaveTextContent('Find @boleburners on TikTok');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens Telegram natively only in an authenticated Mini App', () => {
    const openTelegramLink = vi.fn();
    const previous = window.Telegram;
    window.Telegram = { WebApp: { initData: 'signed-data', openTelegramLink } };
    try {
      render(<RunningClubsCard />);
      fireEvent.click(screen.getByRole('button', { name: /Satenaw Running Club/ }));
      const anchor = screen.getByRole('link', { name: 'Join Telegram Community' });
      expect(anchor).toHaveAttribute('target', '_blank');
      anchor.addEventListener('click', event => event.preventDefault());
      fireEvent.click(anchor);
      expect(openTelegramLink).toHaveBeenCalledTimes(import.meta.env.VITE_APP_SURFACE === 'web' ? 0 : 1);
    } finally { window.Telegram = previous; }
  });

  it('closes the club list with Escape and returns focus to its trigger', () => {
    render(<RunningClubsCard />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Bertusew Running Club/ }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Choose a club' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Choose a club' })).toHaveFocus();
  });
});
