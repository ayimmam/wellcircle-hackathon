import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cacheKeys, getEvents, getPastEvents } from '../api/client';
import useResource from '../hooks/useResource';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import EventCard from '../components/EventCard';
import SmartImage from '../components/SmartImage';
import Icon from '../components/Icon';

const WEEK_MS = 7 * 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Recap row for the Past tab — same intent-capture idea as the feed card. */
function PastEventRow({ event }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const when = new Date(event.starts_at);

  return (
    <div
      className="card mb-12 events-past-row"
      onClick={() => navigate(`/provider/${event.provider_id}`)}
      style={{ cursor: 'pointer' }}
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

function Group({ title, events }) {
  if (events.length === 0) return null;
  return (
    <div className="mb-20">
      <div className="profile-section-title">{title}</div>
      {events.map(e => <EventCard key={e.id} event={e} />)}
    </div>
  );
}

/**
 * Events had no screen of its own — they only ever appeared as a carousel
 * inside Explore, which meant no shareable URL, no way to see anything past
 * the first few, and no home for the recaps that make the next event feel
 * worth booking.
 */
export default function EventsScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useTelegramBackButton(() => navigate('/home'));

  const [params, setParams] = useSearchParams();
  const providerFilter = params.get('provider') || null;
  const [tab, setTab] = useState(params.get('tab') === 'past' ? 'past' : 'upcoming');

  const selectTab = (next) => {
    setTab(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'past') nextParams.set('tab', 'past');
    else nextParams.delete('tab');
    setParams(nextParams, { replace: true });
  };

  // A 90-day window so "Later" isn't an empty promise — the default /events
  // window is a week, which is shorter than most studios plan ahead.
  const upcomingParams = useMemo(() => {
    const to = new Date();
    to.setDate(to.getDate() + 90);
    to.setHours(23, 59, 59, 0);
    return { to: to.toISOString(), limit: 50 };
  }, []);

  const { data: upcomingData, loading: loadingUpcoming } = useResource(
    cacheKeys.events(upcomingParams),
    () => getEvents(upcomingParams),
  );
  const { data: pastData, loading: loadingPast } = useResource(
    cacheKeys.pastEvents({ limit: 20 }),
    () => getPastEvents({ limit: 20 }),
  );

  const byProvider = (list) => (providerFilter ? list.filter(e => e.provider_id === providerFilter) : list);

  const upcoming = byProvider(upcomingData?.events || [])
    .slice()
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const past = byProvider(pastData?.events || [])
    .slice()
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));

  const weekEnd = startOfToday() + WEEK_MS;
  const thisWeek = upcoming.filter(e => new Date(e.starts_at).getTime() < weekEnd);
  const later = upcoming.filter(e => new Date(e.starts_at).getTime() >= weekEnd);

  const providerName = providerFilter
    ? (upcoming[0]?.provider_name || past[0]?.provider_name)
    : null;

  const loading = tab === 'upcoming' ? loadingUpcoming : loadingPast;
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="page" id="events-screen">
      <h1 className="section-title mb-4">{t('Events')}</h1>
      <p className="text-sm text-secondary mb-16">
        {t('Sessions and gatherings hosted by providers around Addis.')}
      </p>

      {providerFilter && (
        <button
          className="chip active mb-16"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete('provider');
            setParams(next, { replace: true });
          }}
          id="events-clear-provider-filter"
        >
          {providerName || t('This provider')} <Icon name="x" size={12} />
        </button>
      )}

      <div className="filter-chips mb-16" role="tablist">
        <button
          className={`chip ${tab === 'upcoming' ? 'active' : ''}`}
          onClick={() => selectTab('upcoming')}
          role="tab"
          aria-selected={tab === 'upcoming'}
          id="events-tab-upcoming"
        >
          {t('Upcoming')}
        </button>
        <button
          className={`chip ${tab === 'past' ? 'active' : ''}`}
          onClick={() => selectTab('past')}
          role="tab"
          aria-selected={tab === 'past'}
          id="events-tab-past"
        >
          {t('Past')}
        </button>
      </div>

      {loading && list.length === 0 ? (
        <>
          <div className="skeleton" style={{ height: 130, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 130 }} />
        </>
      ) : list.length === 0 ? (
        <div className="empty-state" id="events-empty">
          <Icon name="calendar" size={32} style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-secondary" style={{ marginTop: 10 }}>
            {tab === 'upcoming'
              ? t('No events scheduled yet. Providers post them here first.')
              : t('No past events to show yet.')}
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/explore')}>
            {t('Browse providers')}
          </button>
        </div>
      ) : tab === 'upcoming' ? (
        <>
          <Group title={t('This week')} events={thisWeek} />
          <Group title={t('Later')} events={later} />
        </>
      ) : (
        <>
          <p className="text-xs text-tertiary mb-12">
            {t('What you missed — tap a provider to see what they have coming up.')}
          </p>
          {past.map(e => <PastEventRow key={e.id} event={e} />)}
        </>
      )}
    </div>
  );
}
