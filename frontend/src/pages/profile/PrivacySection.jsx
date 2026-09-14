import Icon from '../../components/Icon';
import { clickableDivProps } from '../../utils/a11y';
import { NEIGHBOURHOODS } from '../../data/mock';

export default function PrivacySection({
  t, user, updateProfile, showToast,
  showNeighbourhoodSheet, setShowNeighbourhoodSheet, handleNeighbourhoodSelect,
}) {
  return (
    <>
      <div className="profile-section">
        <div className="profile-section-title">Profile Visibility</div>
        <div className="profile-card">
          <div className="privacy-options">
            {[
              ['public', 'Public', 'Anyone can see your activity'],
              ['followers', 'Followers only', 'Only followers see activity'],
              ['private', 'Private', 'Only you see activity'],
            ].map(([value, label, description]) => (
              <label className={`privacy-option ${user.profile_privacy === value ? 'selected' : ''}`} key={value}>
                <input type="radio" name="profile-privacy" value={value} checked={user.profile_privacy === value} onChange={() => updateProfile({ profile_privacy: value }).then(() => showToast('Profile visibility updated', 'success')).catch(err => showToast(err.message, 'error'))} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Neighbourhood Opt-in */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Local Alerts')}</div>
        <div
          className="neighbourhood-card"
          {...clickableDivProps(() => setShowNeighbourhoodSheet(true))}
          aria-label={t('Local Alerts')}
          id="neighbourhood-optin"
        >
          <span className="neighbourhood-icon"><Icon name="map-pin" size={20} /></span>
          <div className="neighbourhood-text">
            {user.location_neighborhood ? (
              <>
                <div className="neighbourhood-title inline-icon-text"><Icon name="check" size={14} strokeWidth={2.5} /> Showing alerts for {user.location_neighborhood}</div>
                <div className="neighbourhood-desc">Tap to change your neighbourhood</div>
              </>
            ) : (
              <>
                <div className="neighbourhood-title">Get local wellness alerts</div>
                <div className="neighbourhood-desc">Tell us your neighbourhood</div>
              </>
            )}
          </div>
          <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {/* Neighbourhood Bottom Sheet */}
      {showNeighbourhoodSheet && (
        <>
          <div className="sheet-overlay" onClick={() => setShowNeighbourhoodSheet(false)} />
          <div className="sheet" id="neighbourhood-sheet">
            <div className="sheet-handle" />
            <h3 className="sheet-title">Select your neighbourhood</h3>
            <div className="sheet-options">
              {NEIGHBOURHOODS.map(n => (
                <button
                  key={n}
                  className={`sheet-option ${user.location_neighborhood === n ? 'selected' : ''}`}
                  onClick={() => handleNeighbourhoodSelect(n)}
                >
                  <span className="inline-icon-text"><Icon name="map-pin" size={14} /> {n}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
