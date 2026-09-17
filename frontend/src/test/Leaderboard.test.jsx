import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Leaderboard from '../components/Leaderboard';
import ToastContainer from '../components/Toast';
import { renderWithProviders } from './renderWithProviders';

const COMMUNITY_ID = '22222222-0000-0000-0000-000000000001';

// WS7 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — nudge/high-five have no
// per-user visible state, so the instant feedback is the confirmation toast
// itself, which now shows before the request resolves (mock createInteraction
// has a ~300ms delay).
describe('Leaderboard — optimistic nudge/high-five', () => {
  it('shows the confirmation toast immediately on tap, not after the request', async () => {
    renderWithProviders(<><Leaderboard communityId={COMMUNITY_ID} /><ToastContainer /></>);
    await screen.findByText('Dawit');

    const nudgeButtons = screen.getAllByText('👉');
    fireEvent.click(nudgeButtons[0]);

    // No await, no waitFor — synchronous, right after the click.
    expect(screen.getByText('Sent a nudge!')).toBeInTheDocument();
  });
});
