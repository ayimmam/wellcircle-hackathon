import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from '../SmartImage';
import Icon from '../Icon';

/**
 * Recap of an event that already happened. It can't be booked, so instead of
 * dropping it (or showing a dead "Book" button) it does the two things a past
 * event is actually good at: proving other members turned up, and catching the
 * "I'd have gone to that" reaction while it's live — the CTA sends that intent
 * to the provider's upcoming sessions rather than nowhere.
 */
export default function FeedPastEventCard({ item, priority = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { event, provider } = item;

  const openProvider = () => navigate(`/provider/${provider.id}`);
  const when = new Date(event.starts_at);
  const daysAgo = Math.max(1, Math.round((Date.now() - when.getTime()) / 86400000));

  return (
    <div
      className="card mb-12 feed-past-event"
      style={{ cursor: 'pointer' }}
      onClick={openProvider}
      id={`feed-past_event-${item.id}`}
    >
      <div style={{ position: 'relative', height: 150, overflow: 'hidden' }}>
        <SmartImage
          src={provider.cover_photo_url}
          alt={event.service_name}
          width={430}
          priority={priority}
          style={{ height: '100%', width: '100%', objectFit: 'cover', filter: 'grayscale(0.35) brightness(0.7)' }}
          fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
        />
        <span className="feed-past-badge">
          <Icon name="clock" size={12} /> {t('Happened')} · {daysAgo === 1 ? t('yesterday') : `${daysAgo} ${t('days ago')}`}
        </span>
      </div>

      <div className="card-body">
        <div className="inline-icon-text" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Icon name="map-pin" size={12} /> {provider.name}
        </div>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>{event.service_name}</div>

        {event.attendee_count > 0 && (
          <div className="inline-icon-text feed-past-proof" style={{ marginTop: 6 }}>
            <Icon name="users" size={13} />
            <span>
              <strong>{event.attendee_count}</strong> {t('members went')}
              {event.capacity && event.attendee_count >= event.capacity && ` · ${t('sold out')}`}
            </span>
          </div>
        )}

        <p className="text-xs text-secondary" style={{ marginTop: 8 }}>
          {t("Missed it? See what this provider has coming up next.")}
        </p>

        <button
          className="btn btn-secondary btn-block btn-sm"
          style={{ marginTop: 10 }}
          onClick={(e) => { e.stopPropagation(); navigate(`/events?provider=${provider.id}`); }}
          id={`feed-past-event-upcoming-${item.id}`}
        >
          <Icon name="calendar" size={14} /> {t('See upcoming sessions')}
        </button>
      </div>
    </div>
  );
}
