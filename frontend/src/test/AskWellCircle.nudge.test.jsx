import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AskWellCircle from '../components/AskWellCircle';
import { track } from '../analytics';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'nudge-member' } }) }));
vi.mock('../analytics', () => ({ track: vi.fn() }));

const renderChat = (searchActive = false) => render(
  <MemoryRouter><AskWellCircle searchActive={searchActive} /></MemoryRouter>,
);

describe('Circler discovery nudge', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('waits, then shows a dismissible tip that stays dismissed on another visit', () => {
    const first = renderChat();
    expect(screen.queryByText('Need a hand finding your fit?')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Need a hand finding your fit?')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('circler_nudge_view', expect.any(Object));
    fireEvent.click(screen.getByLabelText('Dismiss Circler tip'));
    first.unmount();
    renderChat();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Need a hand finding your fit?')).not.toBeInTheDocument();
  });

  it('does not show while searching', () => {
    renderChat(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Need a hand finding your fit?')).not.toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith('circler_nudge_view', expect.anything());
  });

  it('opens chat from the tip and records the nudge source', () => {
    renderChat();
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: /Need a hand finding your fit/ }));
    expect(screen.queryByText('Need a hand finding your fit?')).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('circler_opened', { source: 'explore_nudge', nudged: true });
    expect(localStorage.getItem('wc:circler-intro:v1:nudge-member')).toBe('1');
  });
});
