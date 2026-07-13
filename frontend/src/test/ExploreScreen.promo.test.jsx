import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ExploreScreen from '../pages/ExploreScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const promoProvider = MOCK_PROVIDERS.find(p => p.active_promotion);

describe('ExploreScreen promo surfacing (presale loop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the promo headline on the provider card', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    expect(
      await screen.findByText(new RegExp(promoProvider.active_promotion.headline))
    ).toBeInTheDocument();
  });

  it('fires promo_view once per promo-bearing provider', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('promo_view', expect.objectContaining({
        provider_id: promoProvider.id,
        surface: 'explore_card',
        discount_pct: promoProvider.active_promotion.discount_pct,
        audience: 'first_time',
      }))
    );
    const promoViews = track.mock.calls.filter(([event]) => event === 'promo_view');
    expect(promoViews).toHaveLength(1); // only one mock provider carries a promo
  });
});
