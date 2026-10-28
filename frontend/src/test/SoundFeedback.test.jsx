import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import SoundFeedback from '../components/SoundFeedback';
import ReactionPicker from '../components/ReactionPicker';
import { playSound, unlockSound } from '../utils/sound';

vi.mock('../utils/sound', () => ({
  playSound: vi.fn(), unlockSound: vi.fn(),
  getSoundEnabled: () => true, subscribeSound: () => () => {}, setSoundEnabled: vi.fn(),
}));

describe('interface sound interactions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps initial entry silent and plays the swoosh on a page change', () => {
    render(<MemoryRouter initialEntries={['/home']}><SoundFeedback /><Link to="/running-clubs">Clubs</Link></MemoryRouter>);
    expect(playSound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Clubs'));
    expect(playSound).toHaveBeenCalledWith('navigate');
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('plays the like cue for a short press without adding a generic tap', () => {
    const react = vi.fn();
    render(<MemoryRouter><SoundFeedback /><ReactionPicker onReact={react} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'React' });
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button, { detail: 1 });
    expect(react).toHaveBeenCalledExactlyOnceWith('❤️');
    expect(unlockSound).toHaveBeenCalled();
    expect(playSound).toHaveBeenCalledExactlyOnceWith('like');
  });

  it('supports keyboard/assistive activation and uses a tap when removing a like', () => {
    const react = vi.fn();
    render(<MemoryRouter><ReactionPicker onReact={react} viewerReactions={['❤️']} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'React' }), { detail: 0 });
    expect(react).toHaveBeenCalledExactlyOnceWith('❤️');
    expect(playSound).toHaveBeenCalledExactlyOnceWith('tap');
  });
});
