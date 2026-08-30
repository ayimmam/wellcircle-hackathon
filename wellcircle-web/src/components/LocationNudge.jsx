import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';

/**
 * Shown wherever a neighbourhood-gated feature has nothing to show yet
 * (Home's "Near you" section, Explore's "Near me" filter). Routes to
 * Profile with a flag that auto-opens the neighbourhood picker sheet.
 */
export default function LocationNudge() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="card mb-24" id="location-nudge">
      <div className="card-body flex items-center gap-12">
        <Icon name="map-pin" size={20} />
        <span style={{ flex: 1, fontSize: '0.88rem' }}>
          {t('Set your neighbourhood to see events & studios near you')}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/profile', { state: { openNeighbourhood: true } })}
          id="location-nudge-btn"
        >
          {t('Choose area')}
        </button>
      </div>
    </div>
  );
}
