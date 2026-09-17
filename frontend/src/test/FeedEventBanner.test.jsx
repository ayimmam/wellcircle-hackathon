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

const comingSoonItem = {
  id: 'evt-coming-soon-1',
  event: {
    id: 'evt-coming-soon-1',
    service_name: 'Group Run',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    price_etb: 0,
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
      <Route path="/booking/:providerId" element={<div>Booking Flow</div>} />
      <Route path="/provider/:id" element={<div>Provider Detail Page</div>} />
    </Routes>,
    { route: '/home' }
  );
}

// WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — a coming-soon host's
// feed event banner loses its Book button, and the whole card opens the
// provider page (info only) instead of the booking flow.
describe('FeedEventBanner — coming-soon gating', () => {
  it('a live host shows Book This Session and books on tap', () => {
    renderBanner(liveItem);
    expect(document.getElementById(`feed-event-book-${liveItem.id}`)).toBeInTheDocument();
    fireEvent.click(document.getElementById(`feed-event-${liveItem.id}`));
    expect(screen.getByText('Booking Flow')).toBeInTheDocument();
  });

  it('a coming-soon host shows a disabled Coming soon badge instead of Book', () => {
    renderBanner(comingSoonItem);
    expect(document.getElementById(`feed-event-book-${comingSoonItem.id}`)).toBeNull();
    const badge = document.getElementById(`feed-event-coming-soon-${comingSoonItem.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toBeDisabled();
  });

  it('a coming-soon host card opens the provider page, not the booking flow, on tap', () => {
    renderBanner(comingSoonItem);
    fireEvent.click(document.getElementById(`feed-event-${comingSoonItem.id}`));
    expect(screen.getByText('Provider Detail Page')).toBeInTheDocument();
  });
});
