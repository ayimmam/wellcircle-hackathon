import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import AdminTrainerVerifications from '../pages/admin/AdminTrainerVerifications';
import AdminPaidCircles from '../pages/admin/AdminPaidCircles';
import { renderWithProviders } from './renderWithProviders';

describe('launch admin review screens', () => {
  it('shows trainer credentials, receipt, and review controls', async () => {
    renderWithProviders(<AdminTrainerVerifications />, { route: '/admin/trainers' });
    expect(await screen.findByText('Dawit Bekele')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View certificate' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View receipt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('shows paid-circle qualification and monthly price', async () => {
    renderWithProviders(<AdminPaidCircles />, { route: '/admin/paid-circles' });
    expect(await screen.findByText('Zen Seekers')).toBeInTheDocument();
    expect(screen.getByText(/112 members · ETB 250\/month/)).toBeInTheDocument();
    expect(screen.getByText(/1,?320/)).toBeInTheDocument();
  });
});
