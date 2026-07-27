import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

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
          {!nativeBack && (
            <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Go back">
              <Icon name="chevron-left" size={20} />
            </button>
          )}
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{t('Notifications')}</h1>
        </div>
        {hasUnread && (
          <button 
            onClick={handleMarkAllRead} 
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('Mark all read')}
          </button>
        )}
      </div>

      <div className="flex-col gap-12">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="bell" size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">{t('No notifications yet.')}</div>
          </div>
        ) : (
          (() => {
            const sections = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Earlier': [] };
            const today = new Date();
            today.setHours(0,0,0,0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const thisWeek = new Date(today);
            thisWeek.setDate(thisWeek.getDate() - 7);

            notifications.forEach(n => {
              const date = new Date(n.created_at);
              if (date >= today) sections['Today'].push(n);
              else if (date >= yesterday) sections['Yesterday'].push(n);
              else if (date >= thisWeek) sections['This Week'].push(n);
              else sections['Earlier'].push(n);
            });

            return Object.entries(sections).map(([label, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={label} className="mb-16">
                  <h2 className="section-title mb-12" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t(label)}</h2>
                  <div className="flex-col gap-8">
                    {items.map(n => (
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
                            className={`flex items-center gap-6 ${!n.is_read ? 'notification-unread-title' : ''}`}
                            style={{ fontWeight: 700, fontSize: '1rem', color: n.is_read ? 'var(--text-primary)' : undefined, margin: 0 }}
                          >
                            {n.type === 'checkin' && <Icon name="check" size={16} />}
                            {n.type === 'join' && <Icon name="users" size={16} />}
                            {n.title}
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, marginTop: 4 }}>{n.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}
