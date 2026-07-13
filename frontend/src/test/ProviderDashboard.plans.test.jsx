import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProviderDashboard from '../pages/ProviderDashboard';
import { ThemeProvider } from '../context/ThemeContext';
import '../i18n';

const PROVIDER_USER = {
  id: 'prov-owner',
  telegram_id: 628489806,
  name: 'Owner',
  is_provider: true,
  is_onboarded: true,
  points_balance: 0,
  joined_communities: [],
};

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: PROVIDER_USER,
    setUser: vi.fn(),
    loading: false,
    error: null,
    login: vi.fn().mockResolvedValue({ user: PROVIDER_USER }),
    refreshUser: vi.fn().mockResolvedValue(PROVIDER_USER),
    onboard: vi.fn(),
    updateProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

describe('ProviderDashboard subscription plans (4C anchoring)', () => {
  it('anchors with Pro first, badges Growth as most popular, adds per-day framing', async () => {
    render(
      <MemoryRouter initialEntries={['/provider-dashboard']}>
        <ThemeProvider>
          <ProviderDashboard />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Subscriptions'));
    await waitFor(() => expect(document.getElementById('plan-pro')).toBeInTheDocument(), { timeout: 4000 });

    // Anchoring: descending price order — Pro's card precedes Growth precedes Starter
    const pro = document.getElementById('plan-pro');
    const growth = document.getElementById('plan-growth');
    const starter = document.getElementById('plan-starter');
    expect(pro.compareDocumentPosition(growth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(growth.compareDocumentPosition(starter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Social proof badge on Growth
    expect(document.getElementById('most-popular-plan')).toBeInTheDocument();
    expect(growth.textContent).toContain('Most popular');
    expect(pro.textContent).not.toContain('Most popular');

    // Per-day reframing: 1500/30 = 50, 3000/30 = 100
    expect(growth.textContent).toContain('≈ 50 ETB/day');
    expect(pro.textContent).toContain('≈ 100 ETB/day');
    // Pro leads with its differentiator
    expect(pro.textContent).toContain('Featured placement in Explore');
  });
});
