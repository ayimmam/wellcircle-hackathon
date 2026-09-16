import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NotificationsScreen from '../pages/NotificationsScreen';
import { renderWithProviders } from './renderWithProviders';

const { NOTIFS, markReadSpy, markAllSpy } = vi.hoisted(() => ({
  NOTIFS: [
    { id: 'n1', title: 'Circle activity', body: 'Someone posted', type: 'join', is_read: false, created_at: new Date().toISOString(), action_url: '/community/abc' },
    { id: 'n2', title: 'Points awarded', body: '+10 points', type: 'points_awarded', is_read: false, created_at: new Date().toISOString() },
  ],
  markReadSpy: vi.fn(),
  markAllSpy: vi.fn(),
}));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    getNotifications: async () => ({ notifications: NOTIFS, unread_count: 2 }),
    markNotificationRead: (...args) => {
      markReadSpy(...args);
      return new Promise(() => {}); // never resolves — proves the UI doesn't wait on it
    },
    markAllNotificationsRead: (...args) => {
      markAllSpy(...args);
      return new Promise(() => {});
    },
  };
});

function renderScreen() {
  return renderWithProviders(
    <Routes>
      <Route path="/notifications" element={<NotificationsScreen />} />
      <Route path="/community/abc" element={<div>Community Detail Page</div>} />
    </Routes>,
    { route: '/notifications' }
  );
}

// WS7 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — mark read / read all
// never wait on the network to update the UI.
describe('NotificationsScreen — optimistic mark read', () => {
  beforeEach(() => {
    markReadSpy.mockClear();
    markAllSpy.mockClear();
  });

  it('marks a tapped notification read and navigates instantly, before the request resolves', async () => {
    renderScreen();
    const row = await screen.findByLabelText('Circle activity');

    fireEvent.click(row);

    // The request was fired but never resolves (mocked) — navigation already
    // happened, which is only possible if the click handler didn't await it.
    expect(markReadSpy).toHaveBeenCalledWith('n1');
    expect(await screen.findByText('Community Detail Page')).toBeInTheDocument();
  });

  it('a second tap on an already-read notification does not re-fire the read request', async () => {
    renderScreen();
    const row = await screen.findByLabelText('Points awarded');

    fireEvent.click(row);
    expect(markReadSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(row);
    // Still 1 — the state genuinely flipped to read (not just a pending
    // network call), or this would have fired again.
    expect(markReadSpy).toHaveBeenCalledTimes(1);
  });

  it('Mark all read flips every row instantly and hides its own button, before the request resolves', async () => {
    renderScreen();
    const row1 = await screen.findByLabelText('Circle activity');
    const row2 = screen.getByLabelText('Points awarded');
    const markAllBtn = screen.getByText('Mark all read');

    fireEvent.click(markAllBtn);

    expect(markAllSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Mark all read')).toBeNull(); // no unread left

    // Confirm the underlying state genuinely flipped (not just the button
    // visibility) — tapping either row now should not fire a read request,
    // since both are already marked read.
    fireEvent.click(row1);
    fireEvent.click(row2);
    expect(markReadSpy).not.toHaveBeenCalled();
  });
});
