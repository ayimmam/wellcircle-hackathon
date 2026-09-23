import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import FeedEventBanner from '../components/feed/FeedEventBanner';
import { renderWithProviders } from './renderWithProviders';

const liveItem = {
  id: 'evt-live-1',
  event: {
    id: 'evt-live-1',
    service_name: 'Facial',
    description: 'A 60-minute signature facial.',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    price_etb: 1500,
  },
  provider: {
    id: 'prov-live',
    name: 'Boston Day Spa',
    is_coming_soon: false,
    cover_photo_url: null,
  },
};

const freeItem = {
  id: 'evt-free-1',
  event: {
    id: 'evt-free-1',
    service_name: 'Riverside Morning Run',
    description: 'Free morning group run, all paces welcome.',
    // Three calendar days out, so the countdown is deterministic.
    starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    price_etb: 0,
  },
  provider: {
    id: 'prov-free',
    name: 'Bole Burners',
    is_coming_soon: false,
    cover_photo_url: null,
  },
};

const comingSoonItem = {
  id: 'evt-coming-soon-1',
  event: {
    id: 'evt-coming-soon-1',
    service_name: 'Group Ride',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    price_etb: 800,
  },
  provider: {
    id: 'prov-coming-soon',
    name: 'Not Launched Yet Club',
    is_coming_soon: true,
    cover_photo_url: null,
  },
};

function renderBanner(item) {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<FeedEventBanner item={item} />} />
      <Route path="/event/:eventId/rsvp" element={<div>RSVP Screen</div>} />
      <Route path="/provider/:id" element={<div>Provider Detail Page</div>} />
    </Routes>,
    { route: '/home' }
  );
}

describe('FeedEventBanner — paid events RSVP', () => {
  it('a paid event shows an RSVP button carrying the price, and opens the RSVP screen', () => {
    renderBanner(liveItem);
    const btn = document.getElementById(`feed-event-rsvp-${liveItem.id}`);
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('1,500');
    fireEvent.click(document.getElementById(`feed-event-${liveItem.id}`));
    expect(screen.getByText('RSVP Screen')).toBeInTheDocument();
  });

  it('keeps a paid event’s description behind the details toggle', () => {
    renderBanner(liveItem);
    expect(screen.queryByText(liveItem.event.description)).toBeNull();
    fireEvent.click(screen.getByText('Event details'));
    expect(screen.getByText(liveItem.event.description)).toBeInTheDocument();
  });
});

// A free community session has nothing to pay and nothing to reserve, so it
// loses the CTA. The space goes to the two things that do matter: how soon it
// is, and what it actually is.
describe('FeedEventBanner — free events', () => {
  it('shows no RSVP button', () => {
    renderBanner(freeItem);
    expect(document.getElementById(`feed-event-rsvp-${freeItem.id}`)).toBeNull();
  });

  it('shows the days-left countdown in place of the CTA', () => {
    renderBanner(freeItem);
    const countdown = document.getElementById(`feed-event-days-left-${freeItem.id}`);
    expect(countdown).toBeInTheDocument();
    expect(countdown.textContent).toContain('3 days left');
  });

  it('shows the description expanded, with no details toggle to tap', () => {
    renderBanner(freeItem);
    expect(screen.getByText(freeItem.event.description)).toBeInTheDocument();
    expect(screen.queryByText('Event details')).toBeNull();
  });

  it('opens the host’s page on tap — there is no RSVP screen to go to', () => {
    renderBanner(freeItem);
    fireEvent.click(document.getElementById(`feed-event-${freeItem.id}`));
    expect(screen.getByText('Provider Detail Page')).toBeInTheDocument();
  });
});

// WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — a coming-soon host's
// feed event banner loses its CTA, and the whole card opens the provider
// page (info only) instead.
describe('FeedEventBanner — coming-soon gating', () => {
  it('a coming-soon host shows a disabled Coming soon badge instead of RSVP', () => {
    renderBanner(comingSoonItem);
    expect(document.getElementById(`feed-event-rsvp-${comingSoonItem.id}`)).toBeNull();
    const badge = document.getElementById(`feed-event-coming-soon-${comingSoonItem.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toBeDisabled();
  });

  it('a coming-soon host card opens the provider page on tap', () => {
    renderBanner(comingSoonItem);
    fireEvent.click(document.getElementById(`feed-event-${comingSoonItem.id}`));
    expect(screen.getByText('Provider Detail Page')).toBeInTheDocument();
  });
});

// The "Event" pill used to sit above the title on every banner. It labelled
// an event card as an event — the calendar line, the date and the host name
// underneath already say that — so it was pure decoration in the most
// valuable strip of the feed.
describe('FeedEventBanner — no redundant Event pill', () => {
  it('renders no "Event" label chip', () => {
    renderBanner(liveItem);
    expect(screen.queryByText('Event')).toBeNull();
  });
});
