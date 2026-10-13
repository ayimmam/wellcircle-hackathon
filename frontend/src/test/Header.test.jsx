import { describe, it, expect } from 'vitest';
import { screen, act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Header';
import { renderWithProviders } from './renderWithProviders';
import { write } from '../api/cache';
import { cacheKeys } from '../api/client';

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

  it('shows the first unread notification from the shared cache immediately', () => {
    renderWithProviders(<Harness />, { route: '/home' });
    act(() => write(cacheKeys.unread(), 1));
    expect(document.querySelector('.header-badge')).toHaveTextContent('1');
    act(() => write(cacheKeys.unread(), 0));
    expect(document.querySelector('.header-badge')).toBeNull();
  });
});
