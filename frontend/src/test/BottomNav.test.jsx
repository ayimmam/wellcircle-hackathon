import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { renderWithProviders } from './renderWithProviders';

function LocationProbe() {
  // BottomNav navigates via router; render it plus a probe of the active route.
  return (
    <>
      <Routes>
        <Route path="*" element={<div data-testid="page" />} />
      </Routes>
      <BottomNav />
    </>
  );
}

describe('BottomNav', () => {
  it('renders the four primary tabs on a main route', () => {
    renderWithProviders(<LocationProbe />, { route: '/home' });
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    ['Home', 'Explore', 'Community', 'Profile'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('is hidden on the splash route', () => {
    renderWithProviders(<LocationProbe />, { route: '/' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('is hidden on onboarding and admin routes', () => {
    const { unmount } = renderWithProviders(<LocationProbe />, { route: '/onboarding' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<LocationProbe />, { route: '/admin/analytics' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the current tab active', () => {
    renderWithProviders(<LocationProbe />, { route: '/explore' });
    expect(screen.getByText('Explore').closest('.nav-item')).toHaveClass('active');
    expect(screen.getByText('Home').closest('.nav-item')).not.toHaveClass('active');
  });

  it('navigates to a tab when tapped', async () => {
    renderWithProviders(<LocationProbe />, { route: '/home' });
    await userEvent.click(screen.getByText('Profile'));
    expect(screen.getByText('Profile').closest('.nav-item')).toHaveClass('active');
  });
});
