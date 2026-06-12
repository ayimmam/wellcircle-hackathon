import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

export default function ProviderCard({ provider, compact = false }) {
  const navigate = useNavigate();

  return (
    <div
      className={`card provider-card ${compact ? '' : ''}`}
      onClick={() => navigate(`/provider/${provider.id}`)}
      id={`provider-card-${provider.id}`}
    >
      <img
        className="card-cover"
        src={provider.cover_photo_url}
        alt={provider.name}
        loading="lazy"
      />
      <div className="card-body">
        <div className="provider-card-info">
          <span className="provider-card-name">{provider.name}</span>
          <span className="provider-card-rating inline-icon-text"><Icon name="star" size={14} /> {provider.rating}</span>
        </div>
        <div className="provider-card-meta">
          <span className={`category-badge ${provider.category}`}>{provider.category}</span>
          <span>{provider.price_range}</span>
        </div>
        {!compact && (
          <div className="provider-card-meta" style={{ marginTop: 6 }}>
            <span className="inline-icon-text"><Icon name="map-pin" size={14} /> {provider.location_text?.split(',')[0]}</span>
            {provider.member_count > 0 && <span className="inline-icon-text"><Icon name="users" size={14} /> {provider.member_count}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
