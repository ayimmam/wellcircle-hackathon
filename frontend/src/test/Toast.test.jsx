import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ToastContainer, { showToast } from '../components/Toast';

describe('Toast', () => {
  afterEach(() => {
    // Each showToast() schedules a real setTimeout to clear itself; let any
    // pending one from a previous test finish so tests don't bleed into
    // each other via the module-level `activeTimeout`/`currentToastRef`.
    act(() => { showToast(''); });
  });

  it('renders a normal message', () => {
    render(<ToastContainer />);
    act(() => { showToast('Joined the circle', 'success'); });
    expect(screen.getByText('Joined the circle')).toBeInTheDocument();
  });

  it('is a no-op for a falsy message — nothing renders, nothing throws', () => {
    const { container } = render(<ToastContainer />);
    act(() => { showToast('', 'error'); });
    expect(container.querySelector('.toast-container')).toBeNull();
    act(() => { showToast(undefined, 'error'); });
    expect(container.querySelector('.toast-container')).toBeNull();
    act(() => { showToast(null, 'error'); });
    expect(container.querySelector('.toast-container')).toBeNull();
  });

  it('this is exactly what absorbs a network-noise error network-wide: the ' +
     'client wraps a timeout/offline failure into an empty-message Error, ' +
     'and the ~70 `showToast(err.message || \'fallback\', ...)` call sites ' +
     'either show their own fallback or, with none, show nothing', () => {
    render(<ToastContainer />);
    const noiseError = new Error('');
    act(() => { showToast(noiseError.message || undefined, 'error'); });
    expect(screen.queryByText(/taking longer than usual/i)).not.toBeInTheDocument();
    act(() => { showToast(noiseError.message || 'Could not load bookings', 'error'); });
    expect(screen.getByText('Could not load bookings')).toBeInTheDocument();
    expect(screen.queryByText(/taking longer than usual/i)).not.toBeInTheDocument();
  });
});
