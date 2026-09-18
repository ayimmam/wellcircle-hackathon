import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { clickableDivProps } from '../../utils/a11y';

/**
 * A single provider service surfaced in the For You feed. Tapping the card
 * navigates to the provider's detail page (the owner's explicit
 * requirement); a secondary CTA jumps straight into booking that service,
 * matching ProviderDetail.jsx's service-row behaviour.
 */
export default function FeedServiceCard({ item, priority = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { provider, service } = item;
  const comingSoon = !!provider.is_coming_soon;

  return (
    <div
      className="card mb-12"
      style={{ cursor: 'pointer' }}
      {...clickableDivProps(() => navigate(`/provider/${provider.id}`))}
      aria-label={provider.name}
      id={`feed-service-${item.id}`}
    >
      <div style={{ height: 160, overflow: 'hidden' }}>
        <SmartImage
          src={service.photo_url || provider.cover_photo_url}
          alt={service.name}
          width={430}
          priority={priority}
          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
          fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
        />
      </div>
      <div className="card-body">
        <div className="inline-icon-text truncate" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Icon name="map-pin" size={12} /> {provider.name}
        </div>
        <div className="truncate" style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>{service.name}</div>
        {service.description && (
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {service.description.length > 100 ? `${service.description.slice(0, 100)}…` : service.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-8">
          <span style={{ fontWeight: 700 }}>
            {service.price != null ? `ETB ${service.price.toLocaleString()}` : t('Price on enquiry')}
          </span>
          {!comingSoon && (
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/booking/${provider.id}`, { state: { selectedService: service } });
              }}
              id={`feed-service-book-${item.id}`}
            >
              {t('Book Now')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
