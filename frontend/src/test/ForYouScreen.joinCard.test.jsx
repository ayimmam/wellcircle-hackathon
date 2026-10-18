import { describe, it, expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function renderForYou(state) {
  return renderWithProviders(
    <Routes>
      <Route path="/home" element={<ForYouScreen />} />
    </Routes>,
    { route: '/home', state }
  );
}

describe('ForYouScreen — user-invoked share cards', () => {
  it('offers the join card after onboarding without opening it automatically', async () => {
    renderForYou({ justOnboarded: true });
    const share = await screen.findByRole('button', { name: /share progress/i });
    expect(document.getElementById('share-card-sheet')).toBeNull();
    fireEvent.click(share);
    expect(document.getElementById('share-card-sheet')).toBeInTheDocument();
    expect(document.getElementById('share-card-caption').textContent).toContain('Well Circle');
  });

  it('does not interrupt a normal Home visit with a join card', async () => {
    renderForYou();
    await screen.findByText(/Your wellness journey awaits/);
    expect(document.getElementById('share-card-sheet')).toBeNull();
  });

  it('opens the current streak image when the streak button is tapped', async () => {
    renderForYou();
    const streakButton = await screen.findByRole('button', { name: /share your 3-day streak/i });
    fireEvent.click(streakButton);
    expect(document.getElementById('share-card-caption').textContent).toContain('3-day streak');
  });
});
