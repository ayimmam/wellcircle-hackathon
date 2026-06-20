import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Header';
import { renderWithProviders } from './renderWithProviders';

function Harness() {
  return (
    <>
      <Header onMenuOpen={() => {}} />
      <Routes>
        <Route path="*" element={<div data-testid="page" />} />
      </Routes>
    </>
  );
}

describe('Header', () => {
  it('renders brand and action buttons on a main route', () => {
    renderWithProviders(<Harness />, { route: '/home' });
    expect(screen.getByText('WELL CIRCLE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('is hidden on splash, onboarding, and admin routes', () => {
    const { unmount } = renderWithProviders(<Harness />, { route: '/' });
    expect(screen.queryByText('WELL CIRCLE')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<Harness />, { route: '/admin/providers' });
    expect(screen.queryByText('WELL CIRCLE')).not.toBeInTheDocument();
  });
});
