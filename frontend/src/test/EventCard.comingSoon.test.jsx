import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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

function renderCard(event, variant) {
  return renderWithProviders(
    <Routes>
      <Route path="/explore" element={<EventCard event={event} variant={variant} />} />
      <Route path="/booking/:providerId" element={<div>Booking Flow</div>} />
    </Routes>,
    { route: '/explore' }
  );
}

// WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — only Boston Day Spa is
// bookable; every other host's event card loses its Book button.
describe('EventCard — coming-soon gating (list variant)', () => {
  it('a live host still shows Book This Session', () => {
    renderCard(liveEvent, 'list');
    expect(screen.getByRole('button', { name: /book this session/i })).toBeInTheDocument();
    expect(document.getElementById(`event-coming-soon-${liveEvent.id}`)).toBeNull();
  });

  it('a coming-soon host has no booking CTA, only a disabled Coming soon badge', () => {
    renderCard(comingSoonEvent, 'list');
    expect(screen.queryByRole('button', { name: /book this session/i })).toBeNull();
    const badge = document.getElementById(`event-coming-soon-${comingSoonEvent.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toBeDisabled();
  });
});

describe('EventCard — coming-soon gating (carousel variant)', () => {
  it('a live host still shows Book This Session', () => {
    renderCard(liveEvent, 'carousel');
    expect(screen.getByRole('button', { name: /book this session/i })).toBeInTheDocument();
  });

  it('a coming-soon host has no booking CTA', () => {
    renderCard(comingSoonEvent, 'carousel');
    expect(screen.queryByRole('button', { name: /book this session/i })).toBeNull();
    expect(document.getElementById(`event-coming-soon-${comingSoonEvent.id}`)).toBeDisabled();
  });
});
