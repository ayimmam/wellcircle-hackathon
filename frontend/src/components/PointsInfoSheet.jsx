import { useTranslation } from 'react-i18next';
import Icon from './Icon';

/**
 * "How Legacy Points work" explainer — opened from the Home points badge.
 * Bottom-sheet pattern shared with the neighbourhood picker (see
 * ProfileScreen's `.sheet`/`.sheet-overlay` usage).
 */
export default function PointsInfoSheet({ onClose }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" id="points-info-sheet">
        <div className="sheet-handle" />
        <div className="flex items-center justify-between mb-16">
          <h3 className="sheet-title" style={{ marginBottom: 0 }}>{t('How Legacy Points Work')}</h3>
          <button
            className="btn btn-icon btn-secondary"
            onClick={onClose}
            aria-label={t('Close')}
            id="points-info-close-btn"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <ul style={{ paddingLeft: 18, margin: 0, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
          <li>🌱 <strong>{t('Seed (0+ pts)')}:</strong> {t('earn +10 per daily check-in')}</li>
          <li>🌿 <strong>{t('Sprout (100+ pts)')}:</strong> {t('redeem vouchers in the store')}</li>
          <li>🌳 <strong>{t('Grove (300+ pts)')}:</strong> {t('unlock partner merch rewards')}</li>
          <li>🌲 <strong>{t('Forest (700+ pts)')}:</strong> {t('top-tier partner perks')}</li>
        </ul>
        <p className="text-secondary text-sm mt-12">
          {t('Points pause (−5/day) after 3 days away — a check-in keeps them growing.')}
        </p>
      </div>
    </>
  );
}
