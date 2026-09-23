import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EventRsvp from '../pages/EventRsvp';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_EVENTS } from '../data/mock';

const paidEvent = {
  id: 'evt-rsvp-1',
  provider_id: 'prov-1',
  provider_name: 'Guzo Adwa Hiking',
  service_name: 'Merete-Wegeram Meskel Trip',
  description: '3 days / 2 nights, departing 6:00 AM.',
  starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
  price_etb: 24000,
  provider_cover_photo_url: null,
  provider_contact_phone: '0942545470',
  provider_contact_instagram: 'guzo_adwa_hiking',
};

function renderRsvp(event) {
  return renderWithProviders(
    <Routes>
      <Route path="/event/:eventId/rsvp" element={<EventRsvp />} />
      <Route path="/provider/:id" element={<div>Provider Detail Page</div>} />
    </Routes>,
    { route: `/event/${event.id}/rsvp`, state: { event } },
  );
}

describe('EventRsvp', () => {
  it('leads with the price — it is the thing being arranged', async () => {
    renderRsvp(paidEvent);
    expect(await screen.findByText('ETB 24,000')).toBeInTheDocument();
  });

  it('says plainly that WellCircle does not take the payment', async () => {
    renderRsvp(paidEvent);
    expect(await screen.findByText(/does not collect or hold payment/i)).toBeInTheDocument();
  });

  it('renders each channel the host published, as a tappable link', async () => {
    renderRsvp(paidEvent);
    const phone = await screen.findByText('0942545470');
    expect(phone.closest('a')).toHaveAttribute('href', 'tel:0942545470');
    const instagram = screen.getByText('@guzo_adwa_hiking');
    expect(instagram.closest('a')).toHaveAttribute('href', 'https://instagram.com/guzo_adwa_hiking');
  });

  it('renders no row for a channel the host did not publish', async () => {
    renderRsvp(paidEvent);
    await screen.findByText('0942545470');
    // This host gave a phone and an Instagram handle, no Telegram channel.
    expect(screen.queryByText('Telegram')).toBeNull();
    expect(screen.queryByText('Website')).toBeNull();
  });

  it('says so rather than showing an empty card when no channel is on file', async () => {
    renderRsvp({ ...paidEvent, provider_contact_phone: null, provider_contact_instagram: null });
    expect(await screen.findByText(/hasn't shared a contact yet/i)).toBeInTheDocument();
  });

  it('has no slot picker — the event date is already fixed', async () => {
    renderRsvp(paidEvent);
    await screen.findByText('ETB 24,000');
    expect(screen.queryByText('Pick a Date')).toBeNull();
    expect(screen.queryByText(/choose a time/i)).toBeNull();
  });

  it('loads the event by id when opened cold, with no router state', async () => {
    // A forwarded link has none of the state a tapped card would carry.
    const seeded = MOCK_EVENTS.find(e => e.price_etb > 0);
    renderWithProviders(
      <Routes>
        <Route path="/event/:eventId/rsvp" element={<EventRsvp />} />
      </Routes>,
      { route: `/event/${seeded.id}/rsvp` },
    );
    expect(await screen.findByText(seeded.service_name)).toBeInTheDocument();
  });
});
