import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client';

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id, actionUrl) => {
    try {
      const notif = notifications.find(n => n.id === id);
      if (!notif) return;
      if (!notif.is_read) {
        await markNotificationRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
      if (actionUrl) {
        navigate(actionUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>;

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="page" id="notifications-screen">
      <div className="flex items-center gap-12 mb-20" style={{ justifyContent: 'space-between' }}>
        <div className="flex items-center gap-12">
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>←</button>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Notifications</h1>
        </div>
        {hasUnread && (
          <button 
            onClick={handleMarkAllRead} 
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-col gap-12">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <div className="empty-state-text">No notifications yet.</div>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`card ${!n.is_read ? 'notification-unread' : ''}`}
              style={{ 
                padding: '16px',
                cursor: n.action_url ? 'pointer' : 'default',
              }}
              onClick={() => handleMarkRead(n.id, n.action_url)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <h3
                  className={!n.is_read ? 'notification-unread-title' : ''}
                  style={{ fontWeight: 700, fontSize: '1rem', color: n.is_read ? 'var(--text-primary)' : undefined }}
                >
                  {n.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
