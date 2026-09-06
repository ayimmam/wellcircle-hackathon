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

// Boston Day Spa: every service is phone-booked, priced on enquiry (B1 blocked)
const bostonDaySpa = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');

function renderBooking() {
  return renderWithProviders(
    <Routes>
      <Route path="/booking/:providerId" element={<BookingFlow />} />
      <Route path="*" element={<div />} />
    </Routes>,
    { route: `/booking/${bostonDaySpa.id}` }
  );
}

describe('BookingFlow direct-contact booking (Boston Day Spa pilot)', () => {
  it('tags phone-booked services and skips date/payment steps', async () => {
    renderBooking();
    const service = await screen.findByText('Massage Cave');
    expect(service.closest('.service-item').textContent).toMatch(/Book directly/);

    fireEvent.click(service.closest('.service-item'));
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);

    // Lands on the contact screen, not the date/time step
    expect(await screen.findByText('Book Directly with Boston Day Spa')).toBeInTheDocument();
    expect(screen.queryByText('Pick a Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Review & Confirm')).not.toBeInTheDocument();
  });

  it('shows both a call and an email link, call prioritized, and tracks analytics', async () => {
    renderBooking();
    const service = await screen.findByText('Facial');
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('Book Directly with Boston Day Spa');

    await waitFor(() => expect(track).toHaveBeenCalledWith('booking_contact_requested', expect.objectContaining({
      has_phone: true,
      has_email: true,
    })));

    // Call is primary (most people prefer calling); email is secondary
    const callLink = document.getElementById('contact-call-btn');
    expect(callLink).toBeInTheDocument();
    expect(callLink.className).toContain('btn-primary');
    expect(callLink.getAttribute('href')).toBe('tel:+251116623808');

    const emailLink = document.getElementById('contact-email-btn');
    expect(emailLink).toBeInTheDocument();
    expect(emailLink.className).toContain('btn-outline');
    expect(emailLink.getAttribute('href')).toMatch(/^mailto:booking@kurifturesorts\.com/);

    fireEvent.click(callLink);
    expect(track).toHaveBeenCalledWith('booking_contact_clicked', expect.objectContaining({ method: 'phone' }));
    fireEvent.click(emailLink);
    expect(track).toHaveBeenCalledWith('booking_contact_clicked', expect.objectContaining({ method: 'email' }));
  });

  it('Back returns to service selection without losing the pick', async () => {
    renderBooking();
    const service = await screen.findByText('Barber');
    fireEvent.click(service.closest('.service-item'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('Book Directly with Boston Day Spa');

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
