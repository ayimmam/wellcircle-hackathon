import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../App';
import { ThemeProvider } from '../context/ThemeContext';
import { MOCK_PROVIDERS, MOCK_COMMUNITIES, MOCK_CIRCLES, MOCK_PRODUCTS, MOCK_PUBLIC_USERS } from '../data/mock';
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

const providerId = MOCK_PROVIDERS[0].id;
const communityId = MOCK_COMMUNITIES[0].id;
const circleId = MOCK_CIRCLES[0].id;
const productId = MOCK_PRODUCTS[0].id;

const ROUTES = [
  ['Splash', '/'],
  ['Onboarding', '/onboarding'],
  ['Home', '/home'],
  ['Explore', '/explore'],
  ['Notifications', '/notifications'],
  ['My Bookings', '/my-bookings'],
  ['Community list', '/community'],
  ['Profile', '/profile'],
  ['Events', '/events'],
  ['Events (past tab)', '/events?tab=past'],
  ['About', '/about'],
  ['Trainer verification', '/trainer/verify'],
  ['Public profile', `/users/${MOCK_PUBLIC_USERS[0].id}`],
  ['Followers', `/users/${MOCK_PUBLIC_USERS[0].id}/followers`],
  ['Following', `/users/${MOCK_PUBLIC_USERS[0].id}/following`],
  ['Provider detail', `/provider/${providerId}`],
  ['Community detail', `/community/${communityId}`],
  ['Circle detail', `/circle/${circleId}`],
  ['Booking flow', `/booking/${providerId}`],
  ['Provider dashboard', '/provider-dashboard'],
  ['Provider onboard', '/provider-onboard'],
  ['Products store', '/products'],
  ['Product detail', `/products/${productId}`],
  ['Product redeem', `/products/${productId}/redeem`],
  ['My redemptions', '/users/me/redemptions'],
  ['Admin analytics', '/admin/analytics'],
  ['Admin providers', '/admin/providers'],
  ['Admin products', '/admin/products'],
  ['Admin reports', '/admin/reports'],
  ['Admin feedback', '/admin/feedback'],
  ['Admin trainers', '/admin/trainers'],
  ['Admin paid circles', '/admin/paid-circles'],
  ['Provider portal login', '/provider-portal/login'],
  ['Provider portal overview (redirects when signed out)', '/provider-portal/overview'],
  ['Provider portal bookings (redirects when signed out)', '/provider-portal/bookings'],
  ['Provider portal events (redirects when signed out)', '/provider-portal/events'],
  ['Provider portal products (redirects when signed out)', '/provider-portal/products'],
  ['Provider portal customers (redirects when signed out)', '/provider-portal/customers'],
  ['Provider portal promotions (redirects when signed out)', '/provider-portal/promotions'],
  ['Provider portal subscriptions (redirects when signed out)', '/provider-portal/subscriptions'],
  ['Unknown route fallback', '/this-does-not-exist'],
];

describe('route smoke tests — every reachable screen mounts without crashing', () => {
  beforeEach(() => {
    // Keep expected async/console noise from screens out of the test output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each(ROUTES)('renders %s (%s)', async (_name, route) => {
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

    // The ErrorBoundary fallback uses role="alert"; its presence means a crash.
    expect(screen.queryByRole('alert')).toBeNull();
    // The app shell itself should still be mounted.
    expect(container.querySelector('.app-shell')).toBeInTheDocument();
  });
});
