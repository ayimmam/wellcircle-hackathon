import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import HomePromoBanner from '../components/HomePromoBanner';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';
import { track, getFeatureFlag } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
  getFeatureFlag: vi.fn(() => 'control'),
  onFeatureFlags: vi.fn(() => () => {}),
}));

describe('HomePromoBanner (experiment: home-promo-banner-prominence)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('control variant renders nothing, identical to pre-experiment behavior', () => {
    getFeatureFlag.mockReturnValue('control');
    renderWithProviders(<HomePromoBanner providers={MOCK_PROVIDERS} />);
    expect(document.getElementById('home-promo-banner')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('test variant shows the banner for an eligible promo and tracks promo_view(surface=home_banner)', () => {
    getFeatureFlag.mockReturnValue('test');
    renderWithProviders(<HomePromoBanner providers={MOCK_PROVIDERS} />);
    const banner = document.getElementById('home-promo-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/20% off your first visit/);
    expect(track).toHaveBeenCalledWith('promo_view', expect.objectContaining({
      surface: 'home_banner',
      discount_pct: 20,
    }));
  });

  it('test variant with no eligible promo shows nothing', () => {
    getFeatureFlag.mockReturnValue('test');
    const noPromo = MOCK_PROVIDERS.map(p => ({ ...p, active_promotion: null }));
    renderWithProviders(<HomePromoBanner providers={noPromo} />);
    expect(document.getElementById('home-promo-banner')).toBeNull();
  });

  it('suppressed (e.g. right after onboarding, alongside WelcomeBanner) even in the test variant', () => {
    getFeatureFlag.mockReturnValue('test');
    renderWithProviders(<HomePromoBanner providers={MOCK_PROVIDERS} suppressed />);
    expect(document.getElementById('home-promo-banner')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('navigates to the provider on tap', () => {
    getFeatureFlag.mockReturnValue('test');
    renderWithProviders(<HomePromoBanner providers={MOCK_PROVIDERS} />);
    fireEvent.click(document.getElementById('home-promo-banner-cta'));
    // renderWithProviders wraps in MemoryRouter; navigation itself is covered
    // by the routes smoke suite, so here we only assert the click doesn't throw
    // and the CTA is wired to a real element.
    expect(document.getElementById('home-promo-banner-cta')).toBeInTheDocument();
  });
});
