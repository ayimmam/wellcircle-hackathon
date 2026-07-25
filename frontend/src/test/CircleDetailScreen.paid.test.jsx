import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CircleDetailScreen from '../pages/CircleDetailScreen';
import { MOCK_CIRCLES, MOCK_CIRCLE_SUBSCRIPTIONS, MOCK_USER } from '../data/mock';
import { renderWithProviders } from './renderWithProviders';

describe('CircleDetailScreen paid circles', () => {
  const paidCircle = MOCK_CIRCLES.find(item => item.is_paid);
  const originalOwner = paidCircle.owner_id;
  const originalSubscriptionCircle = MOCK_CIRCLE_SUBSCRIPTIONS[0].circle_id;
  afterEach(() => {
    paidCircle.owner_id = originalOwner;
    MOCK_CIRCLE_SUBSCRIPTIONS[0].circle_id = originalSubscriptionCircle;
  });

  it('shows monthly pricing and opens the receipt subscription flow', async () => {
    const circle = paidCircle;
    renderWithProviders(
      <Routes><Route path="/circle/:id" element={<CircleDetailScreen />} /></Routes>,
      { route: `/circle/${circle.id}` },
    );
    expect(await screen.findByText(`ETB ${circle.price_etb}/month`, {}, { timeout: 4000 })).toBeInTheDocument();
    const subscribe = screen.getByRole('button', { name: `Subscribe (ETB ${circle.price_etb}/mo)` });
    fireEvent.click(subscribe);
    expect(screen.getByRole('heading', { name: `Subscribe for ETB ${circle.price_etb}/month` })).toBeInTheDocument();
    expect(screen.getByText(/upload your receipt/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revenue' })).toBeNull();
  });

  it('uploads a receipt and moves the subscription to awaiting approval', async () => {
    const { container } = renderWithProviders(
      <Routes><Route path="/circle/:id" element={<CircleDetailScreen />} /></Routes>,
      { route: `/circle/${paidCircle.id}` },
    );
    fireEvent.click(await screen.findByRole('button', { name: `Subscribe (ETB ${paidCircle.price_etb}/mo)` }));
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['receipt'], 'circle-receipt.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit receipt' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit receipt' }));

    expect(await screen.findByText(/Subscription: pending approval/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receipt awaiting approval' })).toBeDisabled();
  });

  it('shows revenue and receipt controls only to the circle owner', async () => {
    paidCircle.owner_id = MOCK_USER.id;
    MOCK_CIRCLE_SUBSCRIPTIONS[0].circle_id = paidCircle.id;
    renderWithProviders(
      <Routes><Route path="/circle/:id" element={<CircleDetailScreen />} /></Routes>,
      { route: `/circle/${paidCircle.id}` },
    );
    const revenueTab = await screen.findByRole('button', { name: 'Revenue' });
    fireEvent.click(revenueTab);

    expect(await screen.findByText('Your earnings (95%)')).toBeInTheDocument();
    expect(screen.getByText('Platform fee (5%)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View receipt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });
});
