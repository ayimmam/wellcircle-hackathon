import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const PROD_SESSION = 'https://well-circle-concierge.vercel.app/ai/concierge/session';

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) };
}

const SESSION_OK = {
  session_id: 's-1',
  experience: 'first_visit',
  welcome: { text: 'Welcome!', cards: [] },
  history: [],
  anonymous_token: 'anon-token-1',
};

async function openChat(search, fetchImpl) {
  if (search !== undefined) window.history.replaceState(null, '', search);
  global.fetch = vi.fn(fetchImpl);
  renderWithProviders(<AskWellCircle />);
  fireEvent.click(document.querySelector('.fab-ask'));
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('AskWellCircle — concierge endpoint override', () => {
  it('?api= rewrites the concierge URL for local testing', async () => {
    const sessionUrls = [];
    await openChat('/root?api=http://127.0.0.1:8000/ai/concierge', (url) => {
      sessionUrls.push(String(url));
      return Promise.resolve(response({ ...SESSION_OK }));
    });
    await screen.findByText('Welcome!');
    expect(
      sessionUrls.some((u) => u.startsWith('http://127.0.0.1:8000/ai/concierge/session')),
    ).toBe(true);
    expect(sessionUrls.some((u) => u.startsWith(PROD_SESSION))).toBe(false);
  });

  it('a non-http(s) ?api= value keeps the production endpoint', async () => {
    const sessionUrls = [];
    await openChat('/root?api=javascript:alert(1)', (url) => {
      sessionUrls.push(String(url));
      return Promise.resolve(response({ ...SESSION_OK }));
    });
    await screen.findByText('Welcome!');
    expect(sessionUrls.some((u) => u.startsWith(PROD_SESSION))).toBe(true);
  });

  it('without ?api= the production endpoint stays the default', async () => {
    const sessionUrls = [];
    await openChat('/', (url) => {
      sessionUrls.push(String(url));
      return Promise.resolve(response({ ...SESSION_OK }));
    });
    await screen.findByText('Welcome!');
    expect(sessionUrls.some((u) => u.startsWith(PROD_SESSION))).toBe(true);
  });
});

describe('AskWellCircle — conversation load retry', () => {
  it('a failed bootstrap shows the error plus a retry affordance, and retrying recovers', async () => {
    const fail = { ok: false, status: 503, json: () => Promise.resolve({ detail: 'x' }) };
    await openChat('/', () => Promise.resolve(fail));

    expect(
      await screen.findByText("I couldn't load your conversation. Please try again."),
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.id).toBe('concierge-retry-load');

    // After the backend recovers, the welcome renders and the retry affordance
    // disappears.
    global.fetch = vi.fn(() => Promise.resolve(response({ ...SESSION_OK })));
    fireEvent.click(retry);
    expect(await screen.findByText('Welcome!')).toBeInTheDocument();
    expect(document.getElementById('concierge-retry-load')).toBeNull();
  });

  it('an auth failure shows the expiry message without a retry affordance', async () => {
    const unauthorized = { ok: false, status: 401, json: () => Promise.resolve({ detail: 'x' }) };
    await openChat('/', () => Promise.resolve(unauthorized));

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    // AUTH_REQUIRED offers no retry: re-sending the same unauthenticated
    // request cannot recover it.
    expect(document.getElementById('concierge-retry-load')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
