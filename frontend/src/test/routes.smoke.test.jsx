import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../App';
import { ThemeProvider } from '../context/ThemeContext';
import { ROUTE_CASES } from './routeCases';
import '../i18n';

// Render every reachable screen with a logged-in super admin so guards pass and
// data-dependent screens have a user. We only assert the screen *mounts without
// crashing* (i.e. the ErrorBoundary fallback never appears) — this is the
// "every navigation destination renders" safety net.
const ADMIN_USER = {
  id: 'test-admin',
  telegram_id: 628489806, // matches a default super-admin id
  name: 'Test Admin',
  is_provider: true,
  is_super_admin: true,
  is_onboarded: true,
  points_balance: 500,
  joined_communities: [],
};

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: ADMIN_USER,
    setUser: vi.fn(),
    loading: false,
    error: null,
    login: vi.fn().mockResolvedValue({ user: ADMIN_USER }),
    refreshUser: vi.fn().mockResolvedValue(ADMIN_USER),
    onboard: vi.fn().mockResolvedValue(ADMIN_USER),
    updateProfile: vi.fn().mockResolvedValue(ADMIN_USER),
    logout: vi.fn(),
  }),
}));


describe('route smoke tests — every reachable screen mounts without crashing', () => {
  beforeEach(() => {
    // Keep expected async/console noise from screens out of the test output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each(ROUTE_CASES)('renders %s (%s)', async (_name, route) => {
    const { container } = render(
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </MemoryRouter>
    );

    // Wait for the lazy chunk to load (Suspense fallback clears).
    await waitFor(
      () => expect(container.querySelector('.route-fallback')).toBeNull(),
      { timeout: 8000 }
    );
    // Let mock data fetches resolve so any late render crash surfaces.
    await new Promise((r) => setTimeout(r, 500));

    // Expected error states (such as 404) are valid; a caught render crash is not.
    expect(container.querySelector('.error-boundary')).toBeNull();
    if (route === '/this-does-not-exist') {
      expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('href', 'https://t.me/well_circle');
    }
    // The app shell itself should still be mounted.
    expect(container.querySelector('.app-shell')).toBeInTheDocument();
  });
});
