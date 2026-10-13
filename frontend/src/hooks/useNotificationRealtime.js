import { useEffect, useState } from 'react';
import {
  getNotificationRealtimeCredentials, getNotificationUnreadCount, cacheKeys,
} from '../api/client';
import { peek, write, invalidate } from '../api/cache';

/** Listen to this user's private Supabase Broadcast channel while visible. */
export default function useNotificationRealtime(userId) {
  const [connection, setConnection] = useState({ userId: null, connected: false });
  useEffect(() => {
    if (!userId || typeof WebSocket === 'undefined') return undefined;

    let stopped = false;
    let socket;
    let heartbeat;
    let renewal;
    let retry;
    let reconcileTimer;
    let retryMs = 1000;
    let joined = false;
    let connecting = false;
    let ref = 0;
    const topic = `realtime:user-notifications:${userId}`;
    const seen = new Set();

    const send = (event, payload, destination = topic) => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      ref += 1;
      socket.send(JSON.stringify({ topic: destination, event, payload, ref: String(ref), join_ref: '1' }));
    };
    const reconcile = () => getNotificationUnreadCount({ force: true }).catch(() => {});
    const onChange = (message) => {
      const event = message.payload?.event;
      const row = message.payload?.payload?.new || message.payload?.payload?.record;
      if (event === 'INSERT' && row?.is_read === false && row?.id && !seen.has(row.id)) {
        seen.add(row.id);
        if (seen.size > 100) seen.delete(seen.values().next().value);
        const previous = peek(cacheKeys.unread())?.data;
        if (typeof previous === 'number') write(cacheKeys.unread(), previous + 1);
      }
      invalidate(cacheKeys.notifications());
      window.dispatchEvent(new Event('wellcircle:notification-changed'));
      clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(reconcile, 150);
    };

    const connect = async () => {
      if (stopped || document.hidden || connecting ||
          (socket && socket.readyState !== WebSocket.CLOSED)) return;
      connecting = true;
      try {
        const credentials = await getNotificationRealtimeCredentials();
        if (stopped || document.hidden || !credentials.enabled) {
          connecting = false;
          return;
        }
        const url = new URL('/realtime/v1/websocket', credentials.url);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('apikey', credentials.anon_key);
        url.searchParams.set('vsn', '1.0.0');
        socket = new WebSocket(url.toString());
        connecting = false;
        socket.onopen = () => {
          send('phx_join', {
            config: { private: true, broadcast: { ack: false, self: false }, presence: { enabled: false } },
            access_token: credentials.token,
          });
          heartbeat = setInterval(() => send('heartbeat', {}, 'phoenix'), 20000);
          renewal = setInterval(async () => {
            try {
              const fresh = await getNotificationRealtimeCredentials();
              if (fresh.enabled) send('access_token', { access_token: fresh.token });
            } catch { socket?.close(); }
          }, 10 * 60 * 1000);
        };
        socket.onmessage = ({ data }) => {
          let message;
          try { message = JSON.parse(data); } catch { return; }
          if (message.topic !== topic) return;
          if (message.event === 'phx_reply' && message.ref === '1') {
            if (message.payload?.status === 'ok') {
              joined = true;
              setConnection({ userId, connected: true });
              retryMs = 1000;
              reconcile();
            } else {
              socket.close();
            }
          }
          if (joined && message.event === 'broadcast') onChange(message);
          if (message.event === 'phx_error' || message.event === 'phx_close') socket.close();
        };
        socket.onclose = () => {
          joined = false;
          if (!stopped) setConnection({ userId, connected: false });
          clearInterval(heartbeat);
          clearInterval(renewal);
          if (!stopped && !document.hidden) {
            retry = setTimeout(connect, retryMs);
            retryMs = Math.min(retryMs * 2, 30000);
          }
        };
        socket.onerror = () => socket.close();
      } catch {
        connecting = false;
        if (!stopped && !document.hidden) {
          retry = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 30000);
        }
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(retry);
        socket?.close();
      } else if (!socket || socket.readyState === WebSocket.CLOSED) {
        clearTimeout(retry);
        connect();
      }
    };
    const initial = setTimeout(connect, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(retry);
      clearTimeout(initial);
      clearTimeout(reconcileTimer);
      clearInterval(heartbeat);
      clearInterval(renewal);
      socket?.close();
    };
  }, [userId]);
  return connection.userId === userId && connection.connected;
}
