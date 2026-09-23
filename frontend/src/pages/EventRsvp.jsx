import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getEvent } from '../api/client';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { track } from '../analytics';
import { effectiveTimeFormat } from '../utils/timeFormat';
import { useAuth } from '../context/AuthContext';

/**
 * RSVP for a paid event: the price, and the host's own channel to arrange it
 * through.
 *
 * WellCircle takes no money for events and is not party to the payment — the
 * community host collects it directly, exactly as they already do off the
 * platform. So this screen deliberately has no checkout, no slot picker and
 * no booking record: the event's date and time are already fixed on the
 * poster, and there is nothing for us to reserve. It ends at a phone number
 * or a Telegram channel, which is where the arrangement actually happens.
 *
 * Free events never reach here — their cards show a countdown instead of an
 * RSVP button, because there is nothing to pay and nothing to arrange.
 */

/** One tappable channel row. `href` null renders nothing at all — a dead row
 * is worse than a shorter list. */
function ContactRow({ icon, label, value, href, onClick }) {
  if (!value) return null;
  return (
    <a
      className="btn btn-outline btn-block"
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      style={{ justifyContent: 'flex-start', gap: 10, marginBottom: 8 }}
    >
      <Icon name={icon} size={18} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
      </span>
    </a>
  );
}

export default function EventRsvp() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const timeFormat = effectiveTimeFormat(user);

  // Tapping an event card hands the whole event over in router state, so the
  // screen paints with no request at all. A forwarded link or a refresh has
  // none of that, and falls back to fetching it.
  const [event, setEvent] = useState(location.state?.event || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (event || !eventId) return undefined;
    let alive = true;
    getEvent(eventId)
      .then(e => { if (alive) setEvent(e); })
      .catch(err => { if (alive) setError(err?.message || 'Could not load this event.'); });
    return () => { alive = false; };
  }, [eventId, event]);

  useEffect(() => {
    if (event) track('event_rsvp_viewed', { event_id: event.id, provider_id: event.provider_id });
  }, [event]);

  if (error) {
    return (
      <div className="page" id="event-rsvp-screen">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm mb-12">{t('This event could not be loaded.')}</p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/events')}>
              {t('Browse events')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page" id="event-rsvp-screen">
        <div className="skeleton" style={{ height: 160, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 80 }} />
      </div>
    );
  }

  const starts = new Date(event.starts_at);
  const dateLabel = starts.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const timeLabel = starts.toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
    hour12: timeFormat !== '24h',
  });

  const phone = event.provider_contact_phone;
  const telegram = event.provider_contact_telegram;
  const instagram = event.provider_contact_instagram;
  const website = event.provider_contact_website;
  const hasContact = Boolean(phone || telegram || instagram || website);

  const contacted = (method) => track('event_rsvp_contact_clicked', {
    event_id: event.id, provider_id: event.provider_id, method,
  });

  return (
    <div className="page" id="event-rsvp-screen">
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label={t('Go back')}>
          <Icon name="chevron-left" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('RSVP')}</h1>
        </div>
      </div>

      <div className="card mb-12" style={{ overflow: 'hidden' }}>
        {event.provider_cover_photo_url && (
          <SmartImage
            src={event.provider_cover_photo_url}
            alt={event.service_name}
            width={430}
            priority
            style={{ height: 160, width: '100%', objectFit: 'cover' }}
            fallback={<div style={{ height: 160, background: 'var(--bg-tertiary)' }} />}
          />
        )}
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 4 }}>{event.service_name}</h2>
          <p className="text-xs text-secondary mb-12">{event.provider_name}</p>

          <div className="confirmation-row">
            <span className="confirmation-label">{t('Date')}</span>
            <span className="confirmation-value">{dateLabel}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">{t('Time')}</span>
            <span className="confirmation-value">{timeLabel}</span>
          </div>
          <div className="confirmation-row" style={{ borderBottom: 'none' }}>
            <span className="confirmation-label">{t('Price')}</span>
            <span className="confirmation-value" style={{ fontWeight: 800 }}>
              ETB {Number(event.price_etb).toLocaleString()}
            </span>
          </div>

          {event.description && (
            <p className="text-xs text-secondary" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="card mb-12">
        <div className="card-body">
          <h3 className="card-title text-sm mb-8">{t('Arrange your spot with the host')}</h3>
          <p className="text-xs text-secondary mb-12">
            {t('Payment is arranged directly with {{name}}. WellCircle does not collect or hold payment for community events.', { name: event.provider_name })}
          </p>

          {hasContact ? (
            <>
              <ContactRow
                icon="smartphone"
                label={t('Call or text')}
                value={phone}
                href={phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : null}
                onClick={() => contacted('phone')}
              />
              <ContactRow
                icon="send"
                label={t('Telegram')}
                value={telegram ? `@${telegram}` : null}
                href={telegram ? `https://t.me/${telegram}` : null}
                onClick={() => contacted('telegram')}
              />
              <ContactRow
                icon="camera"
                label={t('Instagram')}
                value={instagram ? `@${instagram}` : null}
                href={instagram ? `https://instagram.com/${instagram}` : null}
                onClick={() => contacted('instagram')}
              />
              <ContactRow
                icon="info"
                label={t('Website')}
                value={website}
                href={website ? `https://${String(website).replace(/^https?:\/\//, '')}` : null}
                onClick={() => contacted('website')}
              />
            </>
          ) : (
            // Seeded hosts don't all have a channel on file yet. Saying so is
            // better than an empty card that looks broken.
            <p className="text-xs text-secondary" id="event-rsvp-no-contact">
              {t("This host hasn't shared a contact yet. Open their page for more.")}
            </p>
          )}

          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate(`/provider/${event.provider_id}`)}
            id="event-rsvp-provider-btn"
            style={{ marginTop: 4 }}
          >
            {t('View {{name}}', { name: event.provider_name })}
          </button>
        </div>
      </div>
    </div>
  );
}
