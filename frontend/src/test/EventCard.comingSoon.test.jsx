import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EventCard from '../components/EventCard';
import { renderWithProviders } from './renderWithProviders';

const liveEvent = {
  id: 'evt-live-1',
  provider_id: 'prov-live',
  provider_name: 'Boston Day Spa',
  provider_is_coming_soon: false,
  service_name: 'Facial',
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  capacity: 10,
  spots_remaining: 4,
  price_etb: 1500,
  urgency: 'medium',
};

const comingSoonEvent = {
  ...liveEvent,
  id: 'evt-coming-soon-1',
  provider_id: 'prov-coming-soon',
  provider_name: 'Not Launched Yet Studio',
  provider_is_coming_soon: true,
};

const freeEvent = {
  ...liveEvent,
  id: 'evt-free-1',
  provider_id: 'prov-free',
  provider_name: 'Bole Burners',
  price_etb: 0,
  capacity: 50,
  spots_remaining: 47,
  // Three calendar days out, so the countdown is deterministic.
  starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
};

function renderCard(event, variant) {
  return renderWithProviders(
    <Routes>
      <Route path="/explore" element={<EventCard event={event} variant={variant} />} />
      <Route path="/event/:eventId/rsvp" element={<div>RSVP Screen</div>} />
    </Routes>,
    { route: '/explore' }
  );
}

// WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — only a live host is
// actionable; every coming-soon host's event card loses its CTA.
describe('EventCard — coming-soon gating (list variant)', () => {
  it('a live paid host shows an RSVP button', () => {
    renderCard(liveEvent, 'list');
    expect(screen.getByRole('button', { name: /rsvp/i })).toBeInTheDocument();
    expect(document.getElementById(`event-coming-soon-${liveEvent.id}`)).toBeNull();
  });

  it('a coming-soon host has no CTA, only a disabled Coming soon badge', () => {
    renderCard(comingSoonEvent, 'list');
    expect(screen.queryByRole('button', { name: /rsvp/i })).toBeNull();
    const badge = document.getElementById(`event-coming-soon-${comingSoonEvent.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toBeDisabled();
  });
});

describe('EventCard — coming-soon gating (carousel variant)', () => {
  it('a live paid host shows an RSVP button', () => {
    renderCard(liveEvent, 'carousel');
    expect(screen.getByRole('button', { name: /rsvp/i })).toBeInTheDocument();
  });

  it('a coming-soon host has no CTA', () => {
    renderCard(comingSoonEvent, 'carousel');
    expect(screen.queryByRole('button', { name: /rsvp/i })).toBeNull();
    expect(document.getElementById(`event-coming-soon-${comingSoonEvent.id}`)).toBeDisabled();
  });
});

// A free community session has no capacity worth reporting — a run club
// doesn't sell out — so "47 left out of 50" is invented urgency. The pill
// carries the one fact that does change the decision: how soon it is.
describe('EventCard — free events show a countdown, not spots', () => {
  it('replaces the spots-left pill with the days-left countdown (list)', () => {
    renderCard(freeEvent, 'list');
    expect(screen.getByText('3 days left')).toBeInTheDocument();
    expect(screen.queryByText(/left out of/i)).toBeNull();
  });

  it('replaces the spots-left pill with the days-left countdown (carousel)', () => {
    renderCard(freeEvent, 'carousel');
    expect(screen.getByText('3 days left')).toBeInTheDocument();
    expect(screen.queryByText(/spots left out of/i)).toBeNull();
  });

  it('shows no RSVP button — there is nothing to pay or reserve', () => {
    renderCard(freeEvent, 'list');
    expect(screen.queryByRole('button', { name: /rsvp/i })).toBeNull();
  });

  it('still reads as Free rather than ETB 0', () => {
    renderCard(freeEvent, 'list');
    expect(screen.getByText(/Free/)).toBeInTheDocument();
  });
});

describe('EventCard — paid events route to RSVP', () => {
  it('opens the RSVP screen rather than a booking flow', () => {
    renderCard(liveEvent, 'list');
    fireEvent.click(screen.getByRole('button', { name: /rsvp/i }));
    expect(screen.getByText('RSVP Screen')).toBeInTheDocument();
  });
});
