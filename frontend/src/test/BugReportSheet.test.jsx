import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BugReportSheet from '../components/BugReportSheet';
import '../i18n';

vi.mock('../api/client', () => ({
  submitFeedback: vi.fn().mockResolvedValue({ id: 'mock-fb-1' }),
}));

import { submitFeedback } from '../api/client';

describe('BugReportSheet', () => {
  it('renders a message textarea and submit/cancel controls', () => {
    render(<BugReportSheet onClose={() => {}} />);
    expect(document.getElementById('bug-report-message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables submit until a message is typed', () => {
    render(<BugReportSheet onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    fireEvent.change(document.getElementById('bug-report-message'), { target: { value: 'It crashed' } });
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('submits with type "bug" and the current route in context, then closes', async () => {
    const onClose = vi.fn();
    render(<BugReportSheet onClose={onClose} />);
    fireEvent.change(document.getElementById('bug-report-message'), { target: { value: 'Booking button does nothing' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await vi.waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    const call = submitFeedback.mock.calls[0][0];
    expect(call.type).toBe('bug');
    expect(call.message).toBe('Booking button does nothing');
    expect(call.context).toHaveProperty('route');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('includes the caught error message in context when opened from ErrorBoundary', async () => {
    render(<BugReportSheet error={new Error('kaboom internal detail')} onClose={() => {}} />);
    fireEvent.change(document.getElementById('bug-report-message'), { target: { value: 'It crashed' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await vi.waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(submitFeedback.mock.calls[0][0].context.error).toBe('kaboom internal detail');
  });
});
