import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AskWellCircle from '../components/AskWellCircle';
import { track } from '../analytics';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../analytics', () => ({ track: vi.fn() }));

const greeting = "Hey, I'm Circler. Let's find your next wellness plan.";
const renderChat = (searchActive = false) => render(
  <MemoryRouter><AskWellCircle searchActive={searchActive} /></MemoryRouter>,
);

describe('Circler discovery nudge', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('waits four seconds, disappears after seven seconds, and only appears once per session', () => {
    const first = renderChat();
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText(greeting)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('circler_nudge_view', expect.any(Object));
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    first.unmount();
    const second = renderChat();
    act(() => vi.advanceTimersByTime(11000));
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    second.unmount();
    sessionStorage.clear();
    renderChat();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText(greeting)).toBeInTheDocument();
  });

  it('does not show while searching', () => {
    renderChat(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith('circler_nudge_view', expect.anything());
  });

  it('immediately hides the bubble and opens chat when the pill is tapped', () => {
    renderChat();
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Circler' }));
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Circler chat' })).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('circler_opened', { source: 'explore_fab', nudged: true });
  });

  it('cancels a pending bubble when chat is opened before the delay', () => {
    const first = renderChat();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Circler' }));
    first.unmount();
    renderChat();
    act(() => vi.advanceTimersByTime(11000));
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
  });
});
