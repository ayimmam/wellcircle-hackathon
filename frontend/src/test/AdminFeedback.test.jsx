import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AdminFeedback from '../pages/admin/AdminFeedback';
import { renderWithProviders } from './renderWithProviders';
import { submitFeedback } from '../api/client';

describe('AdminFeedback', () => {
  it('lists a submitted bug report with its type badge, message, and route context', async () => {
    await submitFeedback({ type: 'bug', message: 'Booking button does nothing', context: { route: '/booking/123' } });
    renderWithProviders(<AdminFeedback />, { route: '/admin/feedback' });

    await screen.findByText('Booking button does nothing');
    expect(document.querySelector('.badge')?.textContent).toBe('Bug');
    expect(screen.getByText(/\/booking\/123/)).toBeInTheDocument();
  });

  it('filters by type when a type chip is selected', async () => {
    await submitFeedback({ type: 'health_app_request', message: 'Please support Strava' });
    renderWithProviders(<AdminFeedback />, { route: '/admin/feedback' });
    await screen.findByText('Please support Strava');

    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    await screen.findByText('Booking button does nothing');
    expect(screen.queryByText('Please support Strava')).toBeNull();
  });

  it('updates status via the select and reflects it without a full page reload', async () => {
    renderWithProviders(<AdminFeedback />, { route: '/admin/feedback' });
    const item = await screen.findByText('Booking button does nothing');
    const card = item.closest('.card');
    const select = card.querySelector('select');

    fireEvent.change(select, { target: { value: 'resolved' } });
    await waitFor(() => expect(select.value).toBe('resolved'));
  });
});
