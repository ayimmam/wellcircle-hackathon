import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ExploreScreen from '../pages/ExploreScreen';
import { renderWithProviders } from './renderWithProviders';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// WS4 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — Explore opens on
// Events, with a Past events section below Upcoming, and the pill that used
// to say "Studios" now says "Providers".
describe('ExploreScreen — Events default + Past events', () => {
  it('opens on the Events tab by default, not Providers', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    expect(await screen.findByRole('button', { name: 'Events' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Providers' })).not.toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Studios' })).toBeNull();
  });

  it('shows a Past events section under Upcoming, with a recap and no booking CTA', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    await screen.findByText('Past events');
    // A real seeded past event from MOCK_PAST_EVENTS.
    expect(screen.getByText('Members Facial & Sauna Morning')).toBeInTheDocument();
    // Recap rows link out to the provider rather than offering to book.
    expect(document.getElementById('past-event-evt-boston-past-01')).toBeInTheDocument();
  });

  it('fires explore_view with the events view on first load', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    await screen.findByText('Past events');
    expect(track).toHaveBeenCalledWith('explore_view', expect.objectContaining({ view: 'events' }));
  });

  it('applies the category filter to both Upcoming and Past', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    await screen.findByText('Past events');
    expect(screen.getByText('Members Facial & Sauna Morning')).toBeInTheDocument(); // spa

    fireEvent.click(document.getElementById('filter-yoga'));

    // A spa past event no longer matches the yoga filter…
    expect(screen.queryByText('Members Facial & Sauna Morning')).toBeNull();
    // …while a yoga one still does.
    expect(await screen.findByText('Full Moon Rooftop Flow')).toBeInTheDocument();
  });
});
