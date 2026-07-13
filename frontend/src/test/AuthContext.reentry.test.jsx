import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const providerId = MOCK_PROVIDERS[0].id;

function stubTelegram(startParam) {
  window.Telegram = {
    WebApp: {
      initData: 'test-init-data',
      initDataUnsafe: startParam ? { start_param: startParam } : {},
      expand: vi.fn(),
      ready: vi.fn(),
    },
  };
}

describe('AuthContext re-entry deep link (bot nudge → reentry_open)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    delete window.Telegram;
  });

  it('tracks reentry_open with the promo provider id', async () => {
    stubTelegram(`reentry_promo_${providerId}`);
    renderWithProviders(<div />);
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('reentry_open', {
        source: 'bot_nudge',
        provider_id: providerId,
      })
    );
  });

  it('tracks a bare reentry param without a provider id', async () => {
    stubTelegram('reentry');
    renderWithProviders(<div />);
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('reentry_open', { source: 'bot_nudge' })
    );
  });

  it('does not fire reentry_open for circle invite links', async () => {
    stubTelegram('circle_ABC123');
    renderWithProviders(<div />);
    // wait for auth to settle (app_open fires after login)
    await waitFor(() => expect(track).toHaveBeenCalledWith('app_open', expect.anything()));
    const reentry = track.mock.calls.filter(([event]) => event === 'reentry_open');
    expect(reentry).toHaveLength(0);
  });
});
