import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NearYouSection from '../components/NearYouSection';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const providers = [
  { id: 'p1', name: 'Bole Studio', location_text: 'Bole Sub-City, Addis Ababa', rating: 4.5, category: 'gym', price_range: 'ETB 100', cover_photo_url: '' },
  { id: 'p2', name: 'Kazanchis Gym', location_text: 'Kazanchis', rating: 4.2, category: 'gym', price_range: 'ETB 100', cover_photo_url: '' },
];
const events = [
  { id: 'e1', provider_id: 'p1', provider_name: 'Bole Studio', service_name: 'Morning Yoga', price_etb: 100, capacity: 10, spots_remaining: 3, starts_at: new Date().toISOString() },
];

function renderSection(props) {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<NearYouSection {...props} />} />
    </Routes>,
    { route: '/home' }
  );
}

describe('NearYouSection', () => {
  it('renders the location nudge when no neighbourhood is set', () => {
    renderSection({ user: { location_neighborhood: null }, providers, events });
    expect(document.getElementById('location-nudge')).toBeInTheDocument();
  });

  it('shows matching providers and events for a set neighbourhood', () => {
    renderSection({ user: { location_neighborhood: 'Bole' }, providers, events });
    expect(document.getElementById('location-nudge')).toBeNull();
    expect(screen.getAllByText('Bole Studio').length).toBeGreaterThan(0);
    expect(screen.queryByText('Kazanchis Gym')).toBeNull();
    expect(screen.getByText('Morning Yoga')).toBeInTheDocument();
  });

  it('shows a browse-all line when the neighbourhood matches nothing', () => {
    renderSection({ user: { location_neighborhood: 'Piassa' }, providers, events });
    expect(document.getElementById('near-you-empty')).toBeInTheDocument();
    expect(screen.getByText(/Nothing in Piassa yet/)).toBeInTheDocument();
  });
});
