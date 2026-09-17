import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import ExploreScreen from '../pages/ExploreScreen';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// WS2 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the chatbot FAB moved
// from Home to Explore, where the "+" post composer took its old spot.
describe('ExploreScreen — chatbot FAB', () => {
  it('renders the Ask WellCircle FAB', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    expect(await screen.findByLabelText('Ask WellCircle')).toBeInTheDocument();
  });
});
