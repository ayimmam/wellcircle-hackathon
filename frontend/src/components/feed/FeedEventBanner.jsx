import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { clickableDivProps } from '../../utils/a11y';
import { isFreeEvent, daysLeftLabel } from '../../utils/eventTiming';

/**
 * Full-bleed event banner for a boosted/featured event — the "event
 * banners" the marketing team asked for.
 *
 * Paid and free events are different cards behind one component:
 *
 *  - **Paid** keeps a CTA, which opens the RSVP screen
 *    (`/event/:eventId/rsvp`) — price plus the host's contact, since
 *    WellCircle takes no money for events. Its description stays behind a
 *    toggle so the button is never pushed below the fold.
 *  - **Free** has nothing to arrange, so it gets no button at all. With the
 *    button gone there is room to show the description outright rather than
 *    making the reader tap to see what the session is, and the only fact
 *    that changes their decision — how soon it is — is shown instead.
 */
export default function FeedEventBanner({ item, priority = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { event, provider } = item;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isFree = isFreeEvent(event);
  const daysLeft = daysLeftLabel(event.starts_at, t);

  const rsvp = () => navigate(`/event/${event.id}/rsvp`, {
    // The card already holds everything the RSVP screen renders, so handing
    // it over means that screen paints with no request of its own.
    state: {
      event: {
        ...event,
        provider_name: event.provider_name ?? provider.name,
        provider_cover_photo_url: event.provider_cover_photo_url ?? provider.cover_photo_url,
        provider_contact_phone: event.provider_contact_phone ?? provider.contact_phone,
        provider_contact_telegram: event.provider_contact_telegram ?? provider.contact_telegram,
        provider_contact_instagram: event.provider_contact_instagram ?? provider.contact_instagram,
        provider_contact_website: event.provider_contact_website ?? provider.contact_website,
      },
    },
  });

  // A coming-soon host's event is still worth showing (it's what fills the
  // feed pre-launch), but there's nothing to arrange yet — the card opens the
  // provider page instead (WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).
  // A free event's card opens the host too: there is no RSVP screen to go to.
  const openProvider = () => navigate(`/provider/${provider.id}`);
  const cardTap = (provider.is_coming_soon || isFree) ? openProvider : rsvp;

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
          <span className="truncate" style={{ fontSize: '1.1rem', fontWeight: 800, display: 'block' }}>{event.service_name}</span>
          <span className="inline-icon-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Icon name="calendar" size={12} /> {new Date(event.starts_at).toLocaleString()} · {provider.name}
          </span>
        </div>
      </div>
      <div className="card-body">
        {isFree ? (
          <>
            {daysLeft && (
              <div
                className="inline-icon-text mb-8"
                style={{ fontSize: '0.8rem', fontWeight: 700 }}
                id={`feed-event-days-left-${item.id}`}
              >
                <Icon name="clock" size={14} /> {daysLeft}
              </div>
            )}
            {event.description && (
              <p
                id={`feed-event-details-${item.id}`}
                className="text-xs text-secondary"
                style={{ whiteSpace: 'pre-wrap', margin: 0 }}
              >
                {event.description}
              </p>
            )}
          </>
        ) : (
          <>
            {event.description && (
              <div style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className="feed-event-details-toggle"
                  onClick={(e) => { e.stopPropagation(); setDetailsOpen(v => !v); }}
                  aria-expanded={detailsOpen}
                  aria-controls={`feed-event-details-${item.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    background: 'none', border: 'none', padding: 0,
                    color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={14} />
                  {detailsOpen ? t('Hide details') : t('Event details')}
                </button>
                {detailsOpen && (
                  <p
                    id={`feed-event-details-${item.id}`}
                    className="text-xs text-secondary"
                    style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}
                  >
                    {event.description}
                  </p>
                )}
              </div>
            )}
            {provider.is_coming_soon ? (
              <button className="btn btn-secondary btn-block" disabled id={`feed-event-coming-soon-${item.id}`}>
                {t('Coming soon')}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" onClick={(e) => { e.stopPropagation(); rsvp(); }} id={`feed-event-rsvp-${item.id}`}>
                {t('RSVP')} · ETB {Number(event.price_etb).toLocaleString()}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
