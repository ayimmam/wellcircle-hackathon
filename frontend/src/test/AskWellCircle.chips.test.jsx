import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

import { track } from '../analytics';

const CARDS = [
  { id: 'events', label: 'Wellness events this week', prompt: 'Wellness events this week', needs_location: false },
  { id: 'gyms', label: 'Affordable gyms around me', prompt: 'Affordable gyms around me', needs_location: true },
  { id: 'yoga', label: 'Yoga classes this week', prompt: 'Yoga classes this week', needs_location: false },
  { id: 'nutrition', label: 'Nutrition coaching options', prompt: 'Nutrition coaching options', needs_location: false },
];

const SESSION_RESPONSE = {
  session_id: 'server-session-1',
  experience: 'first_visit',
  welcome: {
    text: "🌿 Welcome to Well Circle — I'm Circler, your personal wellness concierge.",
    cards: CARDS,
  },
  history: [],
  profile_name: null,
  anonymous_token: 'anon-token-1',
  memory_available: true,
};

const CHAT_RESPONSE = {
  reply: 'Here are some options.',
  data_source: 'live',
  session_id: 'server-session-1',
  anonymous_token: null,
};

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn((url) => {
    if (isSessionRequest(url)) return Promise.resolve(response(SESSION_RESPONSE));
    return Promise.resolve(response(CHAT_RESPONSE));
  });
});

afterEach(() => {
  MOCK_USER.location_neighborhood = null;
  vi.restoreAllMocks();
});

describe('AskWellCircle — concierge quick-request chips', () => {
  it('loads a server-owned welcome and all four cards on a fresh conversation', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));

    await screen.findByText(/I'm Circler/);
    expect(document.getElementById('concierge-chips')).toBeInTheDocument();
    CARDS.forEach((card) => {
      expect(screen.getByText(card.label)).toBeInTheDocument();
    });
  });

  it('sends the Wellness events this week chip through the concierge API', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Wellness events this week'));

    await waitFor(() => expect(screen.getByText('Wellness events this week')).toBeInTheDocument());
    expect(track).toHaveBeenCalledWith('concierge_chip_click', { chip: 'Wellness events this week' });
    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const body = JSON.parse(chatCalls()[0][1].body);
    expect(body.message).toBe('Wellness events this week');
  });

  it('sends a non-location chip immediately without touching the input', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Yoga classes this week'));

    await waitFor(() => expect(screen.getByText('Yoga classes this week')).toBeInTheDocument());
    expect(track).toHaveBeenCalledWith('concierge_chip_click', { chip: 'Yoga classes this week' });
    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const body = JSON.parse(chatCalls()[0][1].body);
    expect(body.message).toBe('Yoga classes this week');
  });

  it('sends the location chip with the neighbourhood substituted when one is set', async () => {
    MOCK_USER.location_neighborhood = 'Bole';
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    // The mock auth login resolves slower (~800ms) than this component's own
    // render, so the chip's location check would otherwise race a still-null
    // user — wait past that before tapping the chip.
    await new Promise(r => setTimeout(r, 850));
    fireEvent.click(screen.getByText('Affordable gyms around me'));

    await waitFor(() => expect(chatCalls()).toHaveLength(1));
    const body = JSON.parse(chatCalls()[0][1].body);
    expect(body.message).toBe('Affordable gyms around Bole');
  });

  it('renders a calendar pill when the concierge returns an event', async () => {
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) return Promise.resolve(response(SESSION_RESPONSE));
      return Promise.resolve(response({
        reply: 'Weekend Restorative Yoga is this Saturday.',
        data_source: 'live',
        event_id: 'fe-002',
        event_name: 'Weekend Restorative Yoga',
        event_provider_id: 'fb-002',
      }));
    });

    renderWithProviders(<><AskWellCircle /><LocationProbe /></>);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);
    fireEvent.click(screen.getByText('Yoga classes this week'));

    fireEvent.click(await screen.findByText('Weekend Restorative Yoga'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/booking/fb-002?event_id=fe-002',
    );
  });

  it('opens the events list when an event came from fallback ids', async () => {
    global.fetch = vi.fn((url) => {
      if (isSessionRequest(url)) return Promise.resolve(response(SESSION_RESPONSE));
      return Promise.resolve(response({
        reply: 'Weekend Restorative Yoga is this Saturday.',
        data_source: 'fallback',
        event_id: 'fe-002',
        event_name: 'Weekend Restorative Yoga',
        event_provider_id: 'fb-002',
      }));
    });

    renderWithProviders(<><AskWellCircle /><LocationProbe /></>);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);
    fireEvent.click(screen.getByText('Yoga classes this week'));

    fireEvent.click(await screen.findByText('Weekend Restorative Yoga'));
    expect(screen.getByTestId('location')).toHaveTextContent('/events');
  });

  it('prefills (does not auto-send) the location chip when no neighbourhood is set', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Affordable gyms around me'));

    expect(chatCalls()).toHaveLength(0);
    expect(screen.getByPlaceholderText('Ask about wellness services...').value).toBe('Affordable gyms around ');
  });
});
