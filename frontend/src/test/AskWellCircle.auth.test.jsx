import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';
import { getToken } from '../api/client';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getToken: vi.fn() };
});

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

const SESSION_RESPONSE = {
  session_id: 'server-session-1',
  experience: 'first_visit',
  welcome: {
    text: "🌿 Welcome to Well Circle — I'm Circler, your personal wellness concierge.",
    cards: [
      { id: 'events', label: 'Wellness events this week', prompt: 'Wellness events this week', needs_location: false },
    ],
  },
  history: [],
  profile_name: null,
  anonymous_token: null,
  memory_available: true,
};

const CHAT_RESPONSE = {
  reply: 'Here are some options.',
  data_source: 'live',
  session_id: 'server-session-1',
  anonymous_token: null,
};

function isSessionRequest(url) {
  return String(url).includes('/ai/concierge/session');
}

function chatCalls() {
  return global.fetch.mock.calls.filter(
    ([url, options]) => !isSessionRequest(url) && options?.method === 'POST',
  );
}

beforeEach(() => {
  localStorage.clear();
  getToken.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openChat() {
  renderWithProviders(<AskWellCircle />);
  fireEvent.click(document.querySelector('.fab-ask'));
  await screen.findByText(/I'm Circler/);
}

describe('AskWellCircle — credential transport', () => {
  it('sends the backend user JWT as a Bearer header', async () => {
    getToken.mockReturnValue('signed-user-jwt');
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) return Promise.resolve(response(SESSION_RESPONSE));
      return Promise.resolve(response(CHAT_RESPONSE));
    });

    await openChat();
    fireEvent.click(screen.getByText('Wellness events this week'));

    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const headers = chatCalls()[0][1].headers;
    expect(headers.Authorization).toBe('Bearer signed-user-jwt');
    expect(headers['X-Circler-Anonymous-Token']).toBeUndefined();
  });

  it('stores and reuses the server-issued anonymous credential from bootstrap', async () => {
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) {
        return Promise.resolve(
          response({
            ...SESSION_RESPONSE,
            session_id: 'anon-session-1',
            anonymous_token: 'signed-anon-token',
          }),
        );
      }
      return Promise.resolve(
        response({ ...CHAT_RESPONSE, session_id: 'anon-session-1' }),
      );
    });

    await openChat();

    await waitFor(() =>
      expect(localStorage.getItem('concierge_anonymous_token')).toBe(
        'signed-anon-token',
      )
    );

    fireEvent.click(screen.getByText('Wellness events this week'));
    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const firstHeaders = chatCalls()[0][1].headers;
    expect(firstHeaders.Authorization).toBeUndefined();
    expect(firstHeaders['X-Circler-Anonymous-Token']).toBe('signed-anon-token');

    const input = screen.getByPlaceholderText('Ask about wellness services...');
    fireEvent.change(input, { target: { value: 'second question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(chatCalls()).toHaveLength(2));
    const secondHeaders = chatCalls()[1][1].headers;
    const secondBody = JSON.parse(chatCalls()[1][1].body);
    expect(secondHeaders['X-Circler-Anonymous-Token']).toBe('signed-anon-token');
    expect(secondHeaders.Authorization).toBeUndefined();
    expect(secondBody.session_id).toBe('anon-session-1');
  });

  it('does not replace a grounded fallback answer with an unrelated provider', async () => {
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) {
        return Promise.resolve(
          response({ ...SESSION_RESPONSE, anonymous_token: 'anon' }),
        );
      }
      if (String(url).includes('/providers')) {
        return Promise.resolve(
          response({
            providers: [
              { id: 'live-1', name: 'Unrelated Live Gym', category: 'gym' },
            ],
          }),
        );
      }
      return Promise.resolve(
        response({
          reply: 'Bole Wellness Hub is listed at ETB 800-2500.',
          data_source: 'fallback',
          session_id: 'server-session-1',
          provider_id: 'fb-001',
          provider_name: 'Bole Wellness Hub',
        }),
      );
    });

    await openChat();
    fireEvent.click(screen.getByText('Wellness events this week'));

    expect(
      await screen.findByText('Bole Wellness Hub is listed at ETB 800-2500.'),
    ).toBeInTheDocument();
    const providerLookups = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('/providers'),
    );
    expect(providerLookups).toHaveLength(0);
    expect(screen.queryByText('Unrelated Live Gym')).not.toBeInTheDocument();
  });

  it('does not downgrade an invalid user token to anonymous', async () => {
    getToken.mockReturnValue('expired-user-jwt');
    global.fetch = vi.fn().mockResolvedValue(
      response({ detail: 'Invalid or expired authentication token' }, {
        ok: false,
        status: 401,
      }),
    );

    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));

    expect(await screen.findByText(/Your session has expired/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer expired-user-jwt');
    expect(headers['X-Circler-Anonymous-Token']).toBeUndefined();
    expect(chatCalls()).toHaveLength(0);
  });

  it('starts a fresh session after a 403 without reusing the old id', async () => {
    localStorage.setItem('concierge_session_id', 'legacy-session');
    localStorage.setItem('concierge_anonymous_token', 'old-anon-token');
    let sessionAttempts = 0;

    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) {
        sessionAttempts += 1;
        if (sessionAttempts === 1) {
          return Promise.resolve(
            response({ detail: 'This conversation belongs to another session' }, {
              ok: false,
              status: 403,
            }),
          );
        }
        return Promise.resolve(response(SESSION_RESPONSE));
      }
      return Promise.resolve(response(CHAT_RESPONSE));
    });

    await openChat();

    await waitFor(() => expect(sessionAttempts).toBe(2));
    const retryUrl = global.fetch.mock.calls[1][0];
    expect(retryUrl).not.toContain('session_id=');
    expect(localStorage.getItem('concierge_session_id')).toBe('server-session-1');
  });
});
