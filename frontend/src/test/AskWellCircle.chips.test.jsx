import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_USER } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

import { track } from '../analytics';

beforeEach(() => {
  localStorage.removeItem('concierge_messages');
  localStorage.removeItem('concierge_is_first');
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ reply: 'Here are some options.', intro: '', data_source: 'live' }),
  });
});

afterEach(() => {
  MOCK_USER.location_neighborhood = null;
  vi.restoreAllMocks();
});

describe('AskWellCircle — concierge quick-request chips', () => {
  it('shows the chip row on a fresh conversation (just the greeting)', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));

    await screen.findByText(/I'm Circler/);
    expect(document.getElementById('concierge-chips')).toBeInTheDocument();
    expect(screen.getByText('Wellness events this week')).toBeInTheDocument();
    expect(screen.queryByText('Best-rated spas')).not.toBeInTheDocument();
  });

  it('sends the Wellness events this week chip through the concierge API', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Wellness events this week'));

    await waitFor(() => expect(screen.getByText('Wellness events this week')).toBeInTheDocument());
    expect(track).toHaveBeenCalledWith('concierge_chip_click', { chip: 'Wellness events this week' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.message).toBe('Wellness events this week');
  });

  it('sends a non-location chip immediately without touching the input', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Nutrition coaching options'));

    await waitFor(() => expect(screen.getByText('Nutrition coaching options')).toBeInTheDocument());
    expect(track).toHaveBeenCalledWith('concierge_chip_click', { chip: 'Nutrition coaching options' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.message).toBe('Nutrition coaching options');
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

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.message).toBe('Affordable gyms around Bole');
  });

  it('renders a calendar pill when the concierge returns an event', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        reply: 'Weekend Restorative Yoga is this Saturday.',
        intro: '',
        data_source: 'live',
        event_id: 'fe-002',
        event_name: 'Weekend Restorative Yoga',
        event_provider_id: 'fb-002',
      }),
    });

    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);
    fireEvent.click(screen.getByText('Yoga classes this week'));

    expect(await screen.findByText('Weekend Restorative Yoga')).toBeInTheDocument();
  });

  it('prefills (does not auto-send) the location chip when no neighbourhood is set', async () => {
    renderWithProviders(<AskWellCircle />);
    fireEvent.click(document.querySelector('.fab-ask'));
    await screen.findByText(/I'm Circler/);

    fireEvent.click(screen.getByText('Affordable gyms around me'));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Ask about wellness services...').value).toBe('Affordable gyms around ');
  });
});
