import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import WelcomeBanner from '../components/WelcomeBanner';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const USER = {
  id: 'u1',
  interest_category: 'gym',
  exercise_frequency: 'sometimes',
  joined_communities: ['c1', 'c2'],
};

describe('WelcomeBanner (IKEA reflection + reciprocity gift)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reflects the plan the user built + welcome points', () => {
    renderWithProviders(<WelcomeBanner user={USER} providers={[]} />);
    expect(screen.getByText(/Your plan is set/)).toBeInTheDocument();
    expect(screen.getByText(/Gym · sometimes · 2 circles joined/)).toBeInTheDocument();
    expect(screen.getByText('+20 pts earned')).toBeInTheDocument();
  });

  it('shows the welcome gift for an eligible promo and tracks promo_view', () => {
    renderWithProviders(<WelcomeBanner user={USER} providers={MOCK_PROVIDERS} />);
    const gift = document.getElementById('welcome-gift-card');
    expect(gift).toBeInTheDocument();
    expect(gift.textContent).toMatch(/Welcome gift: 20% off at Lifestyle Fitness Center/);
    expect(track).toHaveBeenCalledWith('promo_view', expect.objectContaining({
      surface: 'welcome_gift',
      discount_pct: 20,
    }));
  });

  it('hides the gift when no provider has an eligible promo', () => {
    const noPromo = MOCK_PROVIDERS.map(p => ({ ...p, active_promotion: null }));
    renderWithProviders(<WelcomeBanner user={USER} providers={noPromo} />);
    expect(document.getElementById('welcome-gift-card')).toBeNull();
    const promoViews = track.mock.calls.filter(([e]) => e === 'promo_view');
    expect(promoViews).toHaveLength(0);
  });

  it('progressive profiling link tracks and is dismissible', () => {
    renderWithProviders(<WelcomeBanner user={USER} providers={[]} />);
    fireEvent.click(document.getElementById('neighbourhood-prompt'));
    expect(track).toHaveBeenCalledWith('profile_prompt_click', { field: 'neighbourhood' });

    fireEvent.click(screen.getByLabelText('Dismiss welcome banner'));
    expect(document.getElementById('welcome-banner')).toBeNull();
  });
});
