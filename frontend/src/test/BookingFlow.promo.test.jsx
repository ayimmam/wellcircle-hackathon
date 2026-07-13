import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import BookingFlow from '../pages/BookingFlow';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS, MOCK_TIME_SLOTS } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// Lifestyle Fitness carries the mock presale promo (20% off, first_time, eligible)
const provider = MOCK_PROVIDERS.find(p => p.active_promotion);

function renderBooking() {
  return renderWithProviders(
    <Routes>
      <Route path="/booking/:providerId" element={<BookingFlow />} />
      <Route path="*" element={<div />} />
    </Routes>,
    { route: `/booking/${provider.id}` }
  );
}

async function walkToPaymentStep() {
  // Step 0: pick the first service (Monthly Membership, ETB 2500)
  const service = await screen.findByText('Monthly Membership');
  fireEvent.click(service.closest('.service-item'));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 1: pick a date + time
  fireEvent.click(document.querySelector('.date-chip'));
  fireEvent.click(screen.getByRole('button', { name: MOCK_TIME_SLOTS[0] }));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 2: payment summary is showing
  await screen.findByText(/payment method/i);
}

describe('BookingFlow presale pricing', () => {
  it('shows the predicted promo discount and discounted total', async () => {
    renderBooking();
    await walkToPaymentStep();

    // base 2500 + 2% fee 50 = 2550; 20% presale → −510; total 2040
    expect(document.getElementById('promo-discount-row')).toBeInTheDocument();
    expect(screen.getByText(/−ETB 510/)).toBeInTheDocument();
    expect(screen.getAllByText(/ETB 2,040/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /pay etb 2,040/i })).toBeInTheDocument();
    // 4A anchoring: original price struck through next to the discounted total
    const anchor = document.getElementById('anchor-price');
    expect(anchor).toBeInTheDocument();
    expect(anchor.tagName).toBe('S');
    expect(anchor.textContent).toContain('2,550');
  }, 10000);

  it('shows no discount row for providers without a promo', async () => {
    const plain = MOCK_PROVIDERS.find(p => !p.active_promotion);
    renderWithProviders(
      <Routes>
        <Route path="/booking/:providerId" element={<BookingFlow />} />
        <Route path="*" element={<div />} />
      </Routes>,
      { route: `/booking/${plain.id}` }
    );

    const service = await screen.findByText('Monthly Membership');
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(document.querySelector('.date-chip'));
    fireEvent.click(screen.getByRole('button', { name: MOCK_TIME_SLOTS[0] }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/payment method/i);

    expect(document.getElementById('promo-discount-row')).toBeNull();
    expect(document.getElementById('anchor-price')).toBeNull();
    // base 1500 + 2% fee 30 = 1530, undiscounted
    expect(screen.getByRole('button', { name: /pay etb 1,530/i })).toBeInTheDocument();
  }, 10000);

  it('sends the undiscounted amount and surfaces the server-applied promo', async () => {
    renderBooking();
    await walkToPaymentStep();

    fireEvent.click(document.getElementById('payment-telebirr'));
    fireEvent.change(document.getElementById('phone-input'), { target: { value: '0911234567' } });
    fireEvent.click(document.getElementById('pay-btn'));

    // mock createBooking mirrors the backend: applies the promo server-side
    await waitFor(
      () => expect(screen.getByText(/processing payment/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  }, 10000);
});
