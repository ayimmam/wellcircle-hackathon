import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import BookingFlow from '../pages/BookingFlow';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// Kuriftu Resort & Spa: every service is phone-booked (Jul 15 gap analysis)
const kuriftu = MOCK_PROVIDERS.find(p => p.name === 'Kuriftu Resort & Spa');

function renderBooking() {
  return renderWithProviders(
    <Routes>
      <Route path="/booking/:providerId" element={<BookingFlow />} />
      <Route path="*" element={<div />} />
    </Routes>,
    { route: `/booking/${kuriftu.id}` }
  );
}

describe('BookingFlow direct-contact booking (Kuriftu gap analysis)', () => {
  it('tags phone-booked services and skips date/payment steps', async () => {
    renderBooking();
    const service = await screen.findByText('Aroma Massage (90 min)');
    expect(service.closest('.service-item').textContent).toMatch(/Book directly/);

    fireEvent.click(service.closest('.service-item'));
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);

    // Lands on the contact screen, not the date/time step
    expect(await screen.findByText('Book Directly with Kuriftu Resort & Spa')).toBeInTheDocument();
    expect(screen.queryByText('Pick a Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Method')).not.toBeInTheDocument();
  });

  it('shows an email link (no fabricated phone number) and tracks analytics', async () => {
    renderBooking();
    const service = await screen.findByText('Deep Tissue Massage (50 min)');
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('Book Directly with Kuriftu Resort & Spa');

    await waitFor(() => expect(track).toHaveBeenCalledWith('booking_contact_requested', expect.objectContaining({
      has_phone: false,
      has_email: true,
    })));

    expect(document.getElementById('contact-call-btn')).toBeNull();
    const emailLink = document.getElementById('contact-email-btn');
    expect(emailLink).toBeInTheDocument();
    expect(emailLink.getAttribute('href')).toMatch(/^mailto:booking@kurifturesorts\.com/);

    fireEvent.click(emailLink);
    expect(track).toHaveBeenCalledWith('booking_contact_clicked', expect.objectContaining({ method: 'email' }));
  });

  it('Back returns to service selection without losing the pick', async () => {
    renderBooking();
    const service = await screen.findByText('Steam & Sauna');
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('Book Directly with Kuriftu Resort & Spa');

    fireEvent.click(screen.getByLabelText('Go back'));
    expect(await screen.findByText('Select a Service')).toBeInTheDocument();
    expect(service.closest('.service-item').className).toContain('selected');
  });

  it('online-booked providers are unaffected', async () => {
    const onlineProvider = MOCK_PROVIDERS.find(p => p.name === 'Lifestyle Fitness Center');
    renderWithProviders(
      <Routes>
        <Route path="/booking/:providerId" element={<BookingFlow />} />
        <Route path="*" element={<div />} />
      </Routes>,
      { route: `/booking/${onlineProvider.id}` }
    );
    const service = await screen.findByText('Monthly Membership');
    expect(service.closest('.service-item').textContent).not.toMatch(/Book directly/);
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    expect(await screen.findByText('Pick a Date')).toBeInTheDocument();
  });
});
