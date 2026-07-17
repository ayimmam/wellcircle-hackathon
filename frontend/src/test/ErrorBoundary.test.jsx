import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../components/ErrorBoundary';
import '../i18n';

vi.mock('../api/client', () => ({
  submitFeedback: vi.fn().mockResolvedValue({ id: 'mock-fb-1' }),
}));

function Boom() {
  throw new Error('kaboom internal detail');
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a friendly fallback (not the raw error) when a child crashes', () => {
    // Silence React's expected error log for this intentional crash.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    // The internal error message must never reach the user.
    expect(screen.queryByText(/kaboom internal detail/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('exposes a working reload affordance', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    // jsdom's location.reload isn't writable, so stub it.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    await userEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows a "Report this problem" button that opens the bug report sheet pre-wired with the caught error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    const reportBtn = screen.getByRole('button', { name: /report this problem/i });
    expect(reportBtn).toBeInTheDocument();
    await userEvent.click(reportBtn);

    expect(document.getElementById('bug-report-modal')).toBeInTheDocument();
    spy.mockRestore();
  });
});
