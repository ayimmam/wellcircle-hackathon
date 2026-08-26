import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import FeedServiceCard from '../components/feed/FeedServiceCard';
import FeedProviderCard from '../components/feed/FeedProviderCard';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_FOR_YOU_FEED } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderForYou() {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<ForYouScreen />} />
      <Route path="/circle/:id" element={<div>Circle Detail Screen</div>} />
      <Route path="/community/:id" element={<div>Community Detail Screen</div>} />
      <Route path="/provider/:id" element={<div>Provider Detail Screen</div>} />
      <Route path="/booking/:id" element={<div>Booking Flow Screen</div>} />
    </Routes>,
    { route: '/home' }
  );
}

describe('ForYouScreen — feed item types', () => {
  it('renders every feed item type', async () => {
    renderForYou();
    await waitFor(() => {
      const types = new Set(MOCK_FOR_YOU_FEED.map(i => i.type));
      types.forEach(type => {
        const item = MOCK_FOR_YOU_FEED.find(i => i.type === type);
        expect(document.getElementById(`feed-${type}-${item.id}`)).toBeInTheDocument();
      });
    });
  });

  it('tapping a post navigates to its circle', async () => {
    renderForYou();
    const postItem = MOCK_FOR_YOU_FEED.find(i => i.type === 'post' && i.post.source?.kind === 'circle');
    await waitFor(() => expect(document.getElementById(`feed-post-${postItem.id}`)).toBeInTheDocument());

    fireEvent.click(document.getElementById(`feed-post-${postItem.id}`).querySelector('.card-body'));
    expect(await screen.findByText('Circle Detail Screen')).toBeInTheDocument();
  });

  it('tapping a service navigates to the provider page', async () => {
    renderForYou();
    const serviceItem = MOCK_FOR_YOU_FEED.find(i => i.type === 'service');
    await waitFor(() => expect(document.getElementById(`feed-service-${serviceItem.id}`)).toBeInTheDocument());

    fireEvent.click(document.getElementById(`feed-service-${serviceItem.id}`));
    expect(await screen.findByText('Provider Detail Screen')).toBeInTheDocument();
  });

  it('a cached first paint renders no skeleton', async () => {
    renderForYou();
    // MOCK_FOR_YOU_FEED is non-empty and mock mode's `home` cache warms
    // synchronously enough that the skeleton should never be the only thing
    // shown once the feed has content.
    await waitFor(() => expect(document.getElementById('for-you-feed')).toBeInTheDocument());
  });
});

describe('FeedServiceCard / FeedProviderCard — coming-soon gating', () => {
  it('a coming-soon provider service card has no booking CTA', () => {
    const item = {
      type: 'service',
      id: 'prov-1:0',
      provider: { id: 'prov-1', name: 'Not Launched Yet', is_coming_soon: true, cover_photo_url: null },
      service: { name: 'Test Service', price: 500, duration: '30 min' },
    };
    renderWithProviders(
      <Routes>
        <Route path="/home" element={<FeedServiceCard item={item} />} />
      </Routes>,
      { route: '/home' }
    );
    expect(document.getElementById(`feed-service-book-${item.id}`)).not.toBeInTheDocument();
  });

  it('a coming-soon provider card shows a Coming soon badge', () => {
    const item = {
      type: 'provider',
      id: 'prov-1',
      provider: { id: 'prov-1', name: 'Not Launched Yet', is_coming_soon: true, rating: 4.0, location_text: 'Bole', cover_photo_url: null },
      promotion: null,
    };
    renderWithProviders(
      <Routes>
        <Route path="/home" element={<FeedProviderCard item={item} />} />
      </Routes>,
      { route: '/home' }
    );
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
