import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { isFreeEvent, daysLeftLabel } from '../utils/eventTiming';

/**
 * Event row/tile for the Events screen and provider pages.
 *
 * Paid events keep the spots-and-urgency treatment: capacity is real, and
 * how full a session is changes whether you act. Free community sessions
 * have no gate — a run club doesn't sell out — so "47 spots left out of 50"
 * is invented urgency. Those show how soon the session is instead, and get
 * no CTA at all, because there is nothing to pay and nothing to reserve.
 */
export default function EventCard({ event, variant = 'list' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isFree = isFreeEvent(event);
  const daysLeft = daysLeftLabel(event.starts_at, t);

  const urgencyClass =
    event.urgency === 'high' ? 'urgency-high'
    : event.urgency === 'medium' ? 'urgency-medium'
    : 'urgency-low';

  const fillPct = event.capacity
    ? Math.round(((event.capacity - event.spots_remaining) / event.capacity) * 100)
    : 0;

  // Community run clubs list free sessions — "ETB 0" reads like a pricing bug.
  const priceLabel = isFree ? 'Free' : `ETB ${event.price_etb}`;

  // Paid events hand off to the RSVP screen — price plus the host's contact.
  // WellCircle collects no money for events, so there is no checkout here.
  const rsvp = () => navigate(`/event/${event.id}/rsvp`, { state: { event } });

  // The pill to the right of the title: remaining spots when they mean
  // something, otherwise the countdown.
  const statusPill = isFree
    ? (daysLeft && (
        <span className="urgency-low" style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
          {daysLeft}
        </span>
      ))
    : (
      <span className={urgencyClass} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
        {event.spots_remaining} left out of {event.capacity}
      </span>
    );

  if (variant === 'carousel') {
    return (
      <div className="card" style={{ minWidth: '280px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {event.is_boosted && (
            <span className="badge-on-accent" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>Boosted</span>
          )}
          {isFree
            ? (daysLeft && (
                <span className="urgency-low" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
                  {daysLeft}
                </span>
              ))
            : (
              <span className={urgencyClass} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px' }}>
                {event.spots_remaining} spots left out of {event.capacity}
              </span>
            )}
        </div>
        <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 4 }}>{event.service_name}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{event.provider_name}</p>
        <p className="inline-icon-text" style={{ fontSize: '0.85rem', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <span className="inline-icon-text"><Icon name="calendar" size={14} /> {new Date(event.starts_at).toLocaleString()}</span>
          <span className="inline-icon-text"><Icon name="coins" size={14} /> {priceLabel}</span>
        </p>
        {event.provider_is_coming_soon ? (
          <button className="btn btn-secondary btn-block" disabled id={`event-coming-soon-${event.id}`}>Coming soon</button>
        ) : isFree ? null : (
          <button className="btn btn-primary btn-block" onClick={rsvp} id={`event-rsvp-${event.id}`}>RSVP</button>
        )}
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
          {statusPill}
        </div>
        <p className="text-xs text-secondary mb-8">
          {new Date(event.starts_at).toLocaleString()} · {priceLabel}
        </p>
        {/* The fill bar reads capacity; a free session has none to read. */}
        {!isFree && (
          <div className="admin-bar-track mb-12" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
            <div className="admin-bar-fill" style={{ width: `${fillPct}%`, height: '100%', borderRadius: 4 }} />
          </div>
        )}
        {event.provider_is_coming_soon ? (
          <button className="btn btn-secondary btn-sm btn-block" disabled id={`event-coming-soon-${event.id}`}>Coming soon</button>
        ) : isFree ? null : (
          <button className="btn btn-primary btn-sm btn-block" onClick={rsvp} id={`event-rsvp-${event.id}`}>RSVP</button>
        )}
      </div>
    </div>
  );
}
