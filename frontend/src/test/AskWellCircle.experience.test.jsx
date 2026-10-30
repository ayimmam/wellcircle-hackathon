import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) };
}

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openChat() {
  renderWithProviders(<AskWellCircle />);
  fireEvent.click(document.querySelector('.fab-ask'));
}

describe('AskWellCircle — server-owned conversation experience', () => {
  it('restores an active conversation without repeating a greeting', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      response({
        session_id: 'active-session',
        experience: 'returning',
        welcome: null,
        history: [
          { role: 'user', content: 'I prefer yoga in Bole' },
          { role: 'assistant', content: 'Try Serenity Yoga Studio.' },
        ],
        profile_name: 'Selam',
        anonymous_token: null,
      }),
    );

    await openChat();

    expect(await screen.findByText('I prefer yoga in Bole')).toBeInTheDocument();
    expect(screen.getByText('Try Serenity Yoga Studio.')).toBeInTheDocument();
    expect(screen.queryByText(/Welcome to Well Circle/)).not.toBeInTheDocument();
    expect(document.getElementById('concierge-chips')).not.toBeInTheDocument();
  });

  it('shows the short fresh welcome and cards after expiry', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      response({
        session_id: 'expired-session',
        experience: 'expired',
        welcome: {
          text: 'Welcome back, Selam! Your previous conversation has expired, so let\'s start fresh.',
          cards: [
            { id: 'events', label: 'Wellness events this week', prompt: 'Wellness events this week', needs_location: false },
          ],
        },
        history: [],
        profile_name: 'Selam',
        anonymous_token: null,
      }),
    );

    await openChat();

    expect(await screen.findByText(/Welcome back, Selam!/)).toBeInTheDocument();
    expect(screen.getByText('Wellness events this week')).toBeInTheDocument();
    expect(screen.queryByText(/previous conversation/)).toBeInTheDocument();
  });

  it('does not send a fake initialization message when opened', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      response({
        session_id: 'first-session',
        experience: 'first_visit',
        welcome: { text: "🌿 Welcome to Well Circle — I'm Circler.", cards: [] },
        history: [],
        profile_name: null,
        anonymous_token: 'anon',
      }),
    );

    await openChat();
    await screen.findByText(/I'm Circler/);

    expect(chatCalls()).toHaveLength(0);
    const sessionBody = global.fetch.mock.calls[0][1];
    expect(sessionBody.method).toBeUndefined();
    expect(sessionBody.body).toBeUndefined();
  });

  it('posts a normal turn without is_first_message', async () => {
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) {
        return Promise.resolve(
          response({
            session_id: 'first-session',
            experience: 'first_visit',
            welcome: { text: "🌿 Welcome to Well Circle — I'm Circler.", cards: [] },
            history: [],
            profile_name: null,
            anonymous_token: 'anon',
          }),
        );
      }
      return Promise.resolve(
        response({ reply: 'Here is a match.', session_id: 'first-session' }),
      );
    });

    await openChat();
    await screen.findByText(/I'm Circler/);
    const input = screen.getByPlaceholderText('Ask about wellness services...');
    fireEvent.change(input, { target: { value: 'Find a spa' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const body = JSON.parse(chatCalls()[0][1].body);
    expect(body.message).toBe('Find a spa');
    expect(body.is_first_message).toBeUndefined();
  });
});
