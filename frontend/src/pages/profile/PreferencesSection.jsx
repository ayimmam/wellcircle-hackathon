import Icon from '../../components/Icon';
import { ACCENTS } from '../../context/ThemeContext';
import { effectiveTimeFormat, formatSlot } from '../../utils/timeFormat';

export default function PreferencesSection({
  t, i18n, user,
  theme, setTheme, accent, setAccent,
  updateProfile, showToast,
}) {
  return (
    <>
      {/* Appearance — deliberately first in Preferences. It is the one
          setting people change for fun rather than out of need. */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Appearance')}</div>
        <div className="profile-card">
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              id="theme-light-btn"
            >
              <Icon name="sun" size={16} /> {t('Light')}
            </button>
            <button
              type="button"
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              id="theme-dark-btn"
            >
              <Icon name="moon" size={16} /> {t('Dark')}
            </button>
          </div>
          <div className="accent-swatches" role="group" aria-label={t('Accent color')}>
            {ACCENTS.map(({ key, swatch }) => (
              <button
                key={key}
                type="button"
                className={`accent-swatch ${accent === key ? 'active' : ''}`}
                style={{ background: swatch }}
                onClick={() => setAccent(key)}
                aria-label={key}
                aria-pressed={accent === key}
                id={`accent-${key}-btn`}
              >
                {accent === key && <Icon name="check" size={16} style={{ color: '#fff' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Time Format */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Time Format')}</div>
        <div className="profile-card">
          <div className="theme-toggle" role="group" aria-label="Time format">
            <button
              type="button"
              className={`theme-toggle-btn ${effectiveTimeFormat(user) === '12h' ? 'active' : ''}`}
              onClick={() => updateProfile({ time_format: '12h' }).then(() => showToast('Time format updated', 'success'))}
              id="time-format-12h-btn"
            >
              {`12-hour (${formatSlot('14:00', '12h')})`}
            </button>
            <button
              type="button"
              className={`theme-toggle-btn ${effectiveTimeFormat(user) === '24h' ? 'active' : ''}`}
              onClick={() => updateProfile({ time_format: '24h' }).then(() => showToast('Time format updated', 'success'))}
              id="time-format-24h-btn"
            >
              {`24-hour (${formatSlot('14:00', '24h')})`}
            </button>
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Language')}</div>
        <div className="profile-card">
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-label={t('Language')}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.95rem', cursor: 'pointer', outline: 'none' }}
          >
            <option value="en">English</option>
            <option value="am">አማርኛ (Amharic)</option>
            <option value="fr">Français (French)</option>
            <option value="it">Italiano (Italian)</option>
          </select>
        </div>
      </div>
    </>
  );
}
