import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

export default function EventCard({ event, variant = 'list' }) {
  const navigate = useNavigate();

  const urgencyClass =
    event.urgency === 'high' ? 'urgency-high'
    : event.urgency === 'medium' ? 'urgency-medium'
    : 'urgency-low';

  const fillPct = event.capacity
    ? Math.round(((event.capacity - event.spots_remaining) / event.capacity) * 100)
    : 0;

  // Community run clubs list free sessions — "ETB 0" reads like a pricing bug.
  const priceLabel = event.price_etb ? `ETB ${event.price_etb}` : 'Free';

  const book = () => navigate(
    `/booking/${event.provider_id}?event_id=${event.id}`,
    {
      state: {
        eventId: event.id,
        eventServiceName: event.service_name,
        eventPrice: event.price_etb,
      },
    },
  );

  if (variant === 'carousel') {
    return (
      <div className="card" style={{ minWidth: '280px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {event.is_boosted && (
            <span className="badge-on-accent" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>Boosted</span>
          )}
          <span className={urgencyClass} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
            {event.spots_remaining} spots left out of {event.capacity}
          </span>
        </div>
        <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 4 }}>{event.service_name}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{event.provider_name}</p>
        <p className="inline-icon-text" style={{ fontSize: '0.85rem', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <span className="inline-icon-text"><Icon name="calendar" size={14} /> {new Date(event.starts_at).toLocaleString()}</span>
          <span className="inline-icon-text"><Icon name="coins" size={14} /> {priceLabel}</span>
        </p>
        <button className="btn btn-primary btn-block" onClick={book}>Book This Session</button>
      </div>
    );
  }

  return (
    <div className="card mb-12">
      <div className="card-body">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="card-title text-sm">{event.service_name}</h3>
            <p className="text-xs text-secondary">{event.provider_name || event.provider_category}</p>
          </div>
          <span className={urgencyClass} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
            {event.spots_remaining} left out of {event.capacity}
          </span>
        </div>
        <p className="text-xs text-secondary mb-8">
          {new Date(event.starts_at).toLocaleString()} · {priceLabel}
        </p>
        <div className="admin-bar-track mb-12" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
          <div className="admin-bar-fill" style={{ width: `${fillPct}%`, height: '100%', borderRadius: 4 }} />
        </div>
        <button className="btn btn-primary btn-sm btn-block" onClick={book}>Book This Session</button>
      </div>
    </div>
  );
}
