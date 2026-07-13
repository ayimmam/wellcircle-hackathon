import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PromotionForm from '../components/PromotionForm';
import { createProviderPromotion } from '../api/client';

vi.mock('../api/client', () => ({
  createProviderPromotion: vi.fn(),
}));

function fill({ headline = 'Presale: 20% off your first visit', discount = '20', date = '2026-07-26' } = {}) {
  fireEvent.change(screen.getByPlaceholderText(/Presale: 20% off/), { target: { value: headline } });
  fireEvent.change(screen.getByPlaceholderText('20'), { target: { value: discount } });
  fireEvent.change(document.getElementById('promo-valid-until-input'), { target: { value: date } });
}

describe('PromotionForm (provider dashboard stub)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProviderPromotion.mockResolvedValue({ id: 'promo-1', is_active: true });
  });

  it('submits a presale promotion with audience=first_time by default', async () => {
    render(<PromotionForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /create promotion/i }));

    await waitFor(() => expect(createProviderPromotion).toHaveBeenCalledTimes(1));
    expect(createProviderPromotion).toHaveBeenCalledWith({
      headline: 'Presale: 20% off your first visit',
      discount_pct: 20,
      valid_until: '2026-07-26T23:59:59Z',
      audience: 'first_time',
    });
  });

  it('submits audience=all when first-time-only is unchecked', async () => {
    render(<PromotionForm />);
    fill();
    fireEvent.click(document.getElementById('promo-first-time-checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create promotion/i }));

    await waitFor(() => expect(createProviderPromotion).toHaveBeenCalledTimes(1));
    expect(createProviderPromotion.mock.calls[0][0].audience).toBe('all');
  });

  it('blocks a presale promo without a discount (mirrors backend 422)', () => {
    render(<PromotionForm />);
    fill({ discount: '' });
    const submit = screen.getByRole('button', { name: /create promotion/i });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(createProviderPromotion).not.toHaveBeenCalled();
  });

  it('notifies the parent and clears the form after creation', async () => {
    const onCreated = vi.fn();
    render(<PromotionForm onCreated={onCreated} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /create promotion/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'promo-1', is_active: true }));
    expect(screen.getByPlaceholderText(/Presale: 20% off/).value).toBe('');
  });
});
