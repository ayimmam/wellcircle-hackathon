import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { cacheKeys } from '../api/client';
import { peek, write } from '../api/cache';
import useNotificationRealtime from '../hooks/useNotificationRealtime';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    getNotificationRealtimeCredentials: async () => ({
      enabled: true, url: 'https://test.supabase.co', anon_key: 'public-key', token: 'user-token',
    }),
    getNotificationUnreadCount: async () => 1,
  };
});

class FakeSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];
  readyState = 1;
  sent = [];

  constructor(url) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(message) { this.sent.push(JSON.parse(message)); }
  close() { this.readyState = 3; this.onclose?.(); }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeSocket.instances = [];
});

describe('private notification stream', () => {
  it('joins the user channel and displays the first insert without waiting for reconciliation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    write(cacheKeys.unread(), 0);
    const { unmount } = renderHook(() => useNotificationRealtime('user-123'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    const socket = FakeSocket.instances[0];
    expect(socket.url).toContain('wss://test.supabase.co/realtime/v1/websocket');
    act(() => socket.onopen());
    expect(socket.sent[0].topic).toBe('realtime:user-notifications:user-123');
    expect(socket.sent[0].payload.config.private).toBe(true);

    act(() => socket.onmessage({ data: JSON.stringify({
      topic: 'realtime:user-notifications:user-123', event: 'phx_reply', ref: '1',
      payload: { status: 'ok' },
    }) }));
    act(() => socket.onmessage({ data: JSON.stringify({
      topic: 'realtime:user-notifications:user-123', event: 'broadcast',
      payload: { event: 'INSERT', payload: { new: { id: 'notification-1', is_read: false } } },
    }) }));
    expect(peek(cacheKeys.unread())?.data).toBe(1);

    // Replayed messages cannot double the badge.
    act(() => socket.onmessage({ data: JSON.stringify({
      topic: 'realtime:user-notifications:user-123', event: 'broadcast',
      payload: { event: 'INSERT', payload: { new: { id: 'notification-1', is_read: false } } },
    }) }));
    expect(peek(cacheKeys.unread())?.data).toBe(1);
    unmount();
  });
});
