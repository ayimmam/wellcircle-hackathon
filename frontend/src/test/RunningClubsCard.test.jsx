import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RunningClubsCard from '../components/feed/RunningClubsCard';
import RunningClubsScreen from '../pages/RunningClubsScreen';

function renderDirectory() { return render(<MemoryRouter><RunningClubsScreen /></MemoryRouter>); }

// This same suite also runs against the browser build's compile-time surface.
describe('Running communities', () => {
  it('keeps only the banner on Home and opens the directory on a separate page', () => {
    render(<MemoryRouter initialEntries={['/home']}><Routes>
      <Route path="/home" element={<RunningClubsCard />} />
      <Route path="/running-clubs" element={<RunningClubsScreen />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Choose a club' })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Explore Running Communities' }));
    expect(screen.getByRole('heading', { name: 'Running Communities' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7);
  });

  it('labels Hawassa and preserves its schedule, contact and callable number', () => {
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Hawassa Run LIT/ }));
    const detail = screen.getByRole('article');
    expect(detail).toHaveTextContent('Every Monday, Wednesday and Friday at 6:00 AM');
    expect(detail).toHaveTextContent('Medaniyalem Church, Hawassa');
    expect(detail).toHaveTextContent('Tedla Guye (@TEDLA GUYE)');
    expect(screen.getByRole('link', { name: 'Call 0938651675' })).toHaveAttribute('href', 'tel:+251938651675');
  });

  it('keeps fitness providers labeled as fitness and supplies both Powerplus phone numbers', () => {
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Powerplus Gym/ }));
    expect(screen.getByRole('article')).toHaveTextContent('Hawassa');
    expect(screen.getByRole('article')).toHaveTextContent('Fitness');
    expect(screen.getByRole('link', { name: 'Call 0942425050' })).toHaveAttribute('href', 'tel:+251942425050');
    expect(screen.getByRole('link', { name: 'Call 0967230500' })).toHaveAttribute('href', 'tel:+251967230500');
  });
  it('lists all seven communities without an API request and can collapse and reopen', () => {
    renderDirectory();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7);
    const trigger = screen.getByRole('button', { name: 'Choose a club' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('button', { name: /Bertusew Running Club/ })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('selects, switches and resets clubs while preserving the pinned banner', () => {
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Bertusew Running Club/ }));
    const detail = screen.getByRole('article', { name: 'Bertusew Running Club' });
    expect(within(detail).getByText(/Previous announcement/)).toBeInTheDocument();
    expect(within(detail).getByRole('link', { name: 'Join Telegram Community' })).toHaveAttribute('href', 'https://t.me/bertusewrunningclub');
    const trigger = screen.getByRole('button', { name: 'Bertusew Running Club' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Satenaw Running Club Addis Ababa/ }));
    expect(screen.queryByRole('article', { name: 'Bertusew Running Club' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Satenaw Running Club' })).toHaveTextContent('5:30 PM');
    expect(screen.getByRole('heading', { name: 'Running Communities' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to all clubs' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7);
  });

  it('shows missing contact links as useful handle text with no placeholder anchor', () => {
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Bole Burners Running Club/ }));
    expect(screen.getByRole('article')).toHaveTextContent('Find @boleburners on TikTok');
    expect(within(screen.getByRole('article')).queryByRole('link')).toBeNull();
  });

  it('opens Telegram natively only in an authenticated Mini App', () => {
    const openTelegramLink = vi.fn();
    const previous = window.Telegram;
    window.Telegram = { WebApp: { initData: 'signed-data', openTelegramLink } };
    try {
      renderDirectory();
      fireEvent.click(screen.getByRole('button', { name: /Satenaw Running Club/ }));
      const anchor = screen.getByRole('link', { name: 'Join Telegram Community' });
      expect(anchor).toHaveAttribute('target', '_blank');
      anchor.addEventListener('click', event => event.preventDefault());
      fireEvent.click(anchor);
      expect(openTelegramLink).toHaveBeenCalledTimes(import.meta.env.VITE_APP_SURFACE === 'web' ? 0 : 1);
    } finally { window.Telegram = previous; }
  });

  it('closes the club list with Escape and returns focus to its trigger', () => {
    renderDirectory();
    fireEvent.keyDown(screen.getByRole('button', { name: /Bertusew Running Club/ }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Choose a club' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Choose a club' })).toHaveFocus();
  });
});
