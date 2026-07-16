import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import BookingFlow from '../pages/BookingFlow';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS, getNextDays } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// Iron & Soul Gym: no promo, plain online booking — isolates multi-day math
// from the presale-discount interaction (covered separately below).
const provider = MOCK_PROVIDERS.find(p => p.name === 'Iron & Soul Gym');
const days = getNextDays(7);

function renderBooking() {
  return renderWithProviders(
    <Routes>
      <Route path="/booking/:providerId" element={<BookingFlow />} />
      <Route path="*" element={<div />} />
    </Routes>,
    { route: `/booking/${provider.id}` }
  );
}

async function pickServiceAndDates(dateCount) {
  const service = await screen.findByText('Day Pass'); // ETB 180
  fireEvent.click(service.closest('.service-item'));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  await screen.findByText('Pick a Date');
  for (let i = 0; i < dateCount; i++) {
    fireEvent.click(document.getElementById(`date-chip-${days[i].date}`));
  }
  fireEvent.click(screen.getByRole('button', { name: '09:00' }));
}

describe('BookingFlow multi-day selection', () => {
  it('toggles multiple date chips active and both stay selected', async () => {
    renderBooking();
    await pickServiceAndDates(2);
    expect(document.getElementById(`date-chip-${days[0].date}`).className).toContain('active');
    expect(document.getElementById(`date-chip-${days[1].date}`).className).toContain('active');
  });

  it('clicking an active chip again deselects just that day', async () => {
    renderBooking();
    await pickServiceAndDates(2);
    fireEvent.click(document.getElementById(`date-chip-${days[0].date}`));
    expect(document.getElementById(`date-chip-${days[0].date}`).className).not.toContain('active');
    expect(document.getElementById(`date-chip-${days[1].date}`).className).toContain('active');
  });

  it('order summary and Confirm button total scale with the number of days', async () => {
    renderBooking();
    await pickServiceAndDates(3);
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    await screen.findByText('Review & Confirm');

    // Day Pass: 180 + 2% fee (4, rounded) = 184/day × 3 = 552
    expect(screen.getByText('Service Amount (× 3 days)')).toBeInTheDocument();
    expect(screen.getByText('ETB 540')).toBeInTheDocument(); // 180 × 3
    expect(screen.getByText('Platform Fee (2%) (× 3 days)')).toBeInTheDocument();
    expect(screen.getByText(/ETB 552/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send booking request/i })).toBeInTheDocument();
  }, 10000);

  it('confirmation screen lists every selected date and the combined total', async () => {
    renderBooking();
    await pickServiceAndDates(2);
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    await screen.findByText('Review & Confirm');
    fireEvent.change(document.getElementById('phone-input'), { target: { value: '0911234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send booking request/i }));

    await waitFor(
      () => expect(screen.getByText('Booking Request Sent!')).toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(screen.getByText(`${days[0].date}, ${days[1].date}`)).toBeInTheDocument();
    // 184/day × 2 = 368 total
    expect(screen.getByText('ETB 368')).toBeInTheDocument();
  }, 10000);

  it('event bookings stay single-date — a second tap replaces, not adds', async () => {
    const providerWithEvent = MOCK_PROVIDERS[0];
    renderWithProviders(
      <Routes>
        <Route path="/booking/:providerId" element={<BookingFlow />} />
        <Route path="*" element={<div />} />
      </Routes>,
      { route: `/booking/${providerWithEvent.id}?event_id=evt-1` }
    );
    const service = await screen.findByText(providerWithEvent.services[0].name);
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    await screen.findByText('Pick a Date');

    fireEvent.click(document.getElementById(`date-chip-${days[0].date}`));
    fireEvent.click(document.getElementById(`date-chip-${days[1].date}`));

    expect(document.getElementById(`date-chip-${days[0].date}`).className).not.toContain('active');
    expect(document.getElementById(`date-chip-${days[1].date}`).className).toContain('active');
  });
});
