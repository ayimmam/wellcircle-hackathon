import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from './SmartImage';
import Icon from './Icon';
import { clickableDivProps } from '../utils/a11y';

/**
 * A single recap row for a past event — the "what you missed" list on the
 * Events screen's Past tab, and shared with Explore's Events view (WS4:
 * Explore defaults to Events, with a Past section below Upcoming). No
 * booking CTA; it's social proof, and taps through to the provider's page
 * to see what's coming up next.
 */
export default function PastEventRow({ event }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const when = new Date(event.starts_at);

  return (
    <div
      className="card mb-12 events-past-row"
      {...clickableDivProps(() => navigate(`/provider/${event.provider_id}`))}
      style={{ cursor: 'pointer' }}
      aria-label={event.service_name}
      id={`past-event-${event.id}`}
    >
      <div className="events-past-thumb">
        <SmartImage
          src={event.provider_cover_photo_url}
          alt=""
          width={96}
          style={{ height: '100%', width: '100%', objectFit: 'cover', filter: 'grayscale(0.35) brightness(0.8)' }}
          fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
        />
      </div>
      <div className="events-past-body">
        <div className="text-xs text-secondary">{event.provider_name}</div>
        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{event.service_name}</div>
        <div className="inline-icon-text text-xs text-tertiary" style={{ marginTop: 4, gap: 10, flexWrap: 'wrap' }}>
          <span className="inline-icon-text"><Icon name="clock" size={12} /> {when.toLocaleDateString()}</span>
          {event.attendee_count > 0 && (
            <span className="inline-icon-text"><Icon name="users" size={12} /> {event.attendee_count} {t('went')}</span>
          )}
        </div>
      </div>
      <Icon name="chevron-right" size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </div>
  );
}
