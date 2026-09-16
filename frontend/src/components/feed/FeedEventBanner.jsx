import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { clickableDivProps } from '../../utils/a11y';

/**
 * Full-bleed event banner for a boosted/featured event — the "event
 * banners" the marketing team asked for. Routes the same way EventCard.jsx
 * does: /booking/:providerId?event_id=...
 */
export default function FeedEventBanner({ item, priority = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { event, provider } = item;

  const book = () => navigate(
    `/booking/${provider.id}?event_id=${event.id}`,
    { state: { eventId: event.id, eventServiceName: event.service_name, eventPrice: event.price_etb } },
  );
  // A coming-soon host's event is still worth showing (it's what fills the
  // feed pre-launch), but there's nothing to book yet — the card opens the
  // provider page instead (WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).
  const cardTap = provider.is_coming_soon ? () => navigate(`/provider/${provider.id}`) : book;

  return (
    <div className="card mb-12" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }} {...clickableDivProps(cardTap)} aria-label={event.service_name} id={`feed-event-${item.id}`}>
      <div style={{ position: 'relative', height: 180 }}>
        <SmartImage
          src={provider.cover_photo_url}
          alt={event.service_name}
          width={430}
          priority={priority}
          style={{ height: '100%', width: '100%', objectFit: 'cover', filter: 'brightness(0.55)' }}
          fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
        />
        <div
          className="image-card-overlay"
          style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        >
          <span className="badge-on-accent" style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', borderRadius: '99px', alignSelf: 'flex-start', marginBottom: 6 }}>
            {t('Event')}
          </span>
          <span className="truncate" style={{ fontSize: '1.1rem', fontWeight: 800, display: 'block' }}>{event.service_name}</span>
          <span className="inline-icon-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Icon name="calendar" size={12} /> {new Date(event.starts_at).toLocaleString()} · {provider.name}
          </span>
        </div>
      </div>
      <div className="card-body">
        {provider.is_coming_soon ? (
          <button className="btn btn-secondary btn-block" disabled id={`feed-event-coming-soon-${item.id}`}>
            {t('Coming soon')}
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={(e) => { e.stopPropagation(); book(); }} id={`feed-event-book-${item.id}`}>
            {t('Book This Session')}
          </button>
        )}
      </div>
    </div>
  );
}
