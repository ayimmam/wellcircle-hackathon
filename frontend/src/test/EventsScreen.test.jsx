import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EventsScreen from '../pages/EventsScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_EVENTS, MOCK_PAST_EVENTS } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderEvents(route = '/events') {
  return renderWithProviders(
    <Routes>
      <Route path="/events" element={<EventsScreen />} />
      <Route path="/provider/:id" element={<div>Provider Detail Screen</div>} />
      <Route path="/explore" element={<div>Explore Screen</div>} />
    </Routes>,
    { route }
  );
}

describe('EventsScreen', () => {
  it('lists upcoming events grouped by how soon they are', async () => {
    renderEvents();
    // Boston's boosted event is 3 days out, so it lands in "This week".
    expect(await screen.findByText('Sunset Hammam & Massage Evening')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
  });

  it('keeps past events out of the Upcoming tab', async () => {
    renderEvents();
    await screen.findByText('Sunset Hammam & Massage Evening');
    MOCK_PAST_EVENTS.forEach(e => {
      expect(screen.queryByText(e.service_name)).not.toBeInTheDocument();
    });
  });

  it('the Past tab shows recaps with attendance, and no booking CTA', async () => {
    renderEvents();
    fireEvent.click(await screen.findByText('Past'));

    const recap = await screen.findByText('Members Facial & Sauna Morning');
    expect(recap).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    // A past session can't be booked — offering the CTA anyway is the dead end
    // this tab exists to avoid.
    expect(screen.queryByText('Book This Session')).not.toBeInTheDocument();
    MOCK_EVENTS.forEach(e => {
      expect(screen.queryByText(e.service_name)).not.toBeInTheDocument();
    });
  });

  it('deep-links straight to the Past tab', async () => {
    renderEvents('/events?tab=past');
    expect(await screen.findByText('Members Facial & Sauna Morning')).toBeInTheDocument();
  });

  it('a recap routes to the provider so the interest lands somewhere', async () => {
    renderEvents('/events?tab=past');
    fireEvent.click(await screen.findByText('Members Facial & Sauna Morning'));
    expect(await screen.findByText('Provider Detail Screen')).toBeInTheDocument();
  });

  it('filters to a single provider when deep-linked from a recap card', async () => {
    const bostonId = MOCK_PAST_EVENTS[0].provider_id;
    renderEvents(`/events?provider=${bostonId}`);
    await screen.findByText('Sunset Hammam & Massage Evening');
    // Shanti's upcoming event belongs to a different provider and is excluded.
    await waitFor(() => {
      expect(screen.queryByText('Sunrise Rooftop Yoga')).not.toBeInTheDocument();
    });
  });
});
