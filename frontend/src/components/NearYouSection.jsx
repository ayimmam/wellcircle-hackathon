import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProviderCard from './ProviderCard';
import EventCard from './EventCard';
import LocationNudge from './LocationNudge';
import { nearbyProviders, nearbyEvents } from '../utils/nearby';

/**
 * Home's "Near you in {area}" section. Exported as its own component (not
 * inlined in HomeScreen) so it's testable with plain props instead of
 * threading auth/location state through a full HomeScreen render.
 */
export default function NearYouSection({ user, providers, events }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const neighbourhood = user?.location_neighborhood;

  if (!neighbourhood) return <LocationNudge />;

  const matchedProviders = nearbyProviders(providers, neighbourhood).slice(0, 3);
  const matchedEvents = nearbyEvents(events, providers, neighbourhood).slice(0, 3);

  if (matchedProviders.length === 0 && matchedEvents.length === 0) {
    return (
      <div className="card mb-24" id="near-you-empty">
        <div className="card-body">
          <p className="text-sm text-secondary">
            {t('Nothing in {{area}} yet — browse all studios', { area: neighbourhood })}
            {' '}
            <button
              className="section-action"
              style={{ display: 'inline', padding: 0, background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer' }}
              onClick={() => navigate('/explore')}
            >
              {t('Browse')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="near-you-section">
      {matchedEvents.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">{t('Happening near you')}</h2>
          </div>
          <div className="h-scroll mb-16">
            {matchedEvents.map(e => (
              <EventCard key={e.id} event={e} variant="carousel" />
            ))}
          </div>
        </>
      )}
      {matchedProviders.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">{t('Near you in {{area}}', { area: neighbourhood })}</h2>
          </div>
          <div className="h-scroll mb-24">
            {matchedProviders.map(p => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
