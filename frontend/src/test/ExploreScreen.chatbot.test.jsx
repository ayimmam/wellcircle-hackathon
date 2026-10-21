import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import ExploreScreen from '../pages/ExploreScreen';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../api/client', async (importOriginal) => ({
  ...await importOriginal(),
  getEvents: vi.fn().mockResolvedValue({ events: [] }),
}));

// WS2 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the chatbot FAB moved
// from Home to Explore, where the "+" post composer took its old spot.
describe('ExploreScreen — chatbot FAB', () => {
  it('renders the Ask Circler pill', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    expect(await screen.findByLabelText('Ask Circler')).toBeInTheDocument();
  });
  it('opens the same chat from the empty events state', async () => {
    renderWithProviders(<ExploreScreen />, { route: '/explore' });
    const empty = await screen.findByText("Not sure what fits you? Let's figure it out.");
    fireEvent.click(within(empty.parentElement).getByRole('button', { name: 'Ask Circler' }));
    expect(screen.getByRole('dialog', { name: 'Circler chat' })).toBeInTheDocument();
    expect(document.getElementById('ask-wellcircle-fab')).toBeNull();
  });
});
