import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { clickableDivProps } from '../../utils/a11y';

/**
 * Provider highlight card — rating, location, active promotion headline.
 * Honors is_coming_soon: no booking CTA when true (this card has no CTA at
 * all, only the tap-through to the provider page).
 */
export default function FeedProviderCard({ item, priority = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { provider, promotion } = item;

  return (
    <div
      className="card mb-12"
      style={{ cursor: 'pointer' }}
      {...clickableDivProps(() => navigate(`/provider/${provider.id}`))}
      aria-label={provider.name}
      id={`feed-provider-${item.id}`}
    >
      <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
        <SmartImage
          src={provider.cover_photo_url}
          alt={provider.name}
          width={430}
          priority={priority}
          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
          fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
        />
        {provider.is_coming_soon && (
          <span className="category-badge" style={{ position: 'absolute', top: 10, left: 10, background: 'var(--text-tertiary)' }}>
            {t('Coming soon')}
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <span className="truncate" style={{ fontWeight: 700, minWidth: 0 }}>{provider.name}</span>
          <span className="inline-icon-text" style={{ flexShrink: 0 }}><Icon name="star" size={14} /> {provider.rating}</span>
        </div>
        <div className="inline-icon-text text-sm text-secondary truncate" style={{ marginTop: 4 }}>
          <Icon name="map-pin" size={12} /> {provider.location_text?.split(',')[0]}
        </div>
        {promotion && (
          <div className="inline-icon-text" style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 6 }}>
            <Icon name="ticket" size={12} /> {promotion.headline}
          </div>
        )}
      </div>
    </div>
  );
}
