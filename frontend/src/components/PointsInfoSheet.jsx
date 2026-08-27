import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import useDismissOnEscape from '../hooks/useDismissOnEscape';

/**
 * "How Legacy Points work" explainer — opened from the Home points badge.
 * Bottom-sheet pattern shared with the neighbourhood picker (see
 * ProfileScreen's `.sheet`/`.sheet-overlay` usage).
 */
export default function PointsInfoSheet({ onClose }) {
  const { t } = useTranslation();

  useDismissOnEscape(onClose);

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
        <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.88rem' }}>
          <li><strong>{t('Seed (0+ pts)')}</strong><br />{t('start here — check in daily to build your streak')}</li>
          <li><strong>{t('Sprout (100+ pts)')}</strong><br />{t('redeem vouchers in the store')}</li>
          <li><strong>{t('Grove (300+ pts)')}</strong><br />{t('unlock partner merch rewards')}</li>
          <li><strong>{t('Forest (700+ pts)')}</strong><br />{t('top-tier partner perks')}</li>
        </ul>
        <p className="text-secondary text-sm mt-12">
          {t('Points pause (−5/day) after 3 days away — stay active to keep them growing.')}
        </p>
      </div>
    </>
  );
}
