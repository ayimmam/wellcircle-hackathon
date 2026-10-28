import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../App';
import { ThemeProvider } from '@shared/context/ThemeContext';
import { ROUTE_CASES } from '@shared/test/routeCases';
import '@shared/i18n';

const ADMIN_USER = { id: 'test-admin', telegram_id: 628489806, name: 'Test Admin', is_provider: true, is_super_admin: true, is_onboarded: true, points_balance: 500, joined_communities: [] };
vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: ADMIN_USER, setUser: vi.fn(), loading: false, error: null, login: vi.fn(), refreshUser: vi.fn().mockResolvedValue(ADMIN_USER), onboard: vi.fn().mockResolvedValue(ADMIN_USER), updateProfile: vi.fn().mockResolvedValue(ADMIN_USER), logout: vi.fn() }),
}));
vi.mock('@shared/analytics', () => ({ initAnalytics: vi.fn(), identifyUser: vi.fn(), track: vi.fn() }));
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('the same app destinations render in a browser', () => {
  it.each(ROUTE_CASES)('%s (%s)', async (_label, path) => {
    const { container } = render(<MemoryRouter initialEntries={[path]}><ThemeProvider><AppShell /></ThemeProvider></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.route-fallback')).toBeNull(), { timeout: 8000 });
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(container.querySelector('.error-boundary')).toBeNull();
    expect(container.querySelector('.app-shell')).toBeInTheDocument();
  });
});
