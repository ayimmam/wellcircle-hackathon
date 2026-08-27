import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';
import { clickableDivProps } from '../utils/a11y';

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

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '20px' }}>{t('Loading…')}</div>;

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
                <div key={label} className="mb-24">
                  <h2 className="section-title mb-12" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '4px' }}>
                    {t(label)}
                  </h2>
                  <div className="flex-col gap-12">
                    {items.map(n => {
                      const isUnread = !n.is_read;
                      // Choose an icon based on the type
                      let iconName = 'bell';
                      let iconColor = 'var(--brand-primary)';
                      let bgSoft = 'rgba(0, 122, 255, 0.1)';

                      if (n.type === 'checkin' || n.type === 'challenge_completed') {
                        iconName = 'check-circle';
                        iconColor = '#10b981'; // green
                        bgSoft = 'rgba(16, 185, 129, 0.1)';
                      } else if (n.type === 'join' || n.type === 'follower') {
                        iconName = 'users';
                        iconColor = '#8b5cf6'; // purple
                        bgSoft = 'rgba(139, 92, 246, 0.1)';
                      } else if (n.type === 'points_awarded' || n.type === 'reward') {
                        iconName = 'star';
                        iconColor = '#f59e0b'; // yellow/gold
                        bgSoft = 'rgba(245, 158, 11, 0.1)';
                      }

                      return (
                        <div
                          key={n.id}
                          className="card"
                          style={{
                            padding: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                            background: isUnread ? 'var(--bg-card)' : 'transparent',
                            border: isUnread ? '1px solid var(--border-color)' : '1px solid transparent',
                            boxShadow: isUnread ? '0 4px 12px rgba(0,0,0,0.03)' : 'none',
                            transition: 'transform 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          aria-label={n.title}
                          {...clickableDivProps(() => handleMarkRead(n.id, n.action_url))}
                          onMouseEnter={(e) => {
                            if(n.action_url) e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            if(n.action_url) e.currentTarget.style.transform = 'none';
                          }}
                        >
                          {/* Unread Indicator */}
                          {isUnread && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: 0,
                              width: '3px',
                              background: 'var(--brand-primary)'
                            }} />
                          )}

                          {/* Icon wrapper */}
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '16px',
                            background: bgSoft,
                            color: iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon name={iconName} size={24} strokeWidth={1.5} />
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px' }}>
                              <h3
                                style={{ 
                                  fontWeight: isUnread ? 700 : 600, 
                                  fontSize: '1rem', 
                                  color: 'var(--text-primary)', 
                                  margin: 0,
                                  lineHeight: 1.3
                                }}
                              >
                                {n.title}
                              </h3>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: isUnread ? 'var(--brand-primary)' : 'var(--text-tertiary)', 
                                whiteSpace: 'nowrap', 
                                fontWeight: isUnread ? 600 : 400 
                              }}>
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ 
                              fontSize: '0.9rem', 
                              color: isUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)', 
                              margin: 0, 
                              lineHeight: 1.4 
                            }}>
                              {n.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
