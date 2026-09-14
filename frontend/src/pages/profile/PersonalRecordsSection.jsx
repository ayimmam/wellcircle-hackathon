import { useState } from 'react';
import Icon from '../../components/Icon';

// Free-form "PR" list (5K time, longest streak, whatever the member wants
// to show off) — label/value pairs rather than a fixed schema, since wellness
// PRs vary wildly by activity. Shown on the public profile too (see
// PublicProfile.jsx), gated by the same profile-visibility setting as the
// rest of the profile.
export default function PersonalRecordsSection({ t, user, updateProfile, showToast }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const records = user.personal_records || [];

  const save = async (nextRecords) => {
    setSaving(true);
    try {
      await updateProfile({ personal_records: nextRecords });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addRecord = async () => {
    if (!label.trim() || !value.trim()) return;
    const next = [...records, { id: `pr-${Date.now()}`, label: label.trim(), value: value.trim() }];
    await save(next);
    setLabel('');
    setValue('');
    setAdding(false);
  };

  const removeRecord = async (id) => {
    await save(records.filter(r => r.id !== id));
  };

  return (
    <div className="profile-section">
      <div className="profile-section-title">{t('Personal Records')}</div>
      <div className="profile-card">
        {records.length === 0 && !adding && (
          <p className="text-sm text-secondary mb-12">{t('Add a 5K time, a longest streak, or any PR you want others to see.')}</p>
        )}
        {records.map(r => (
          <div key={r.id} className="confirmation-row">
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.label}</span>
            <div className="flex items-center gap-8">
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{r.value}</span>
              <button
                type="button"
                aria-label={t('Remove {{label}}', { label: r.label })}
                onClick={() => removeRecord(r.id)}
                disabled={saving}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
        ))}

        {adding ? (
          <div className="flex gap-8 mt-8">
            <input
              type="text"
              className="input"
              placeholder={t('5K, Longest streak…')}
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{ flex: 1 }}
              aria-label={t('Record label')}
              autoFocus
            />
            <input
              type="text"
              className="input"
              placeholder={t('24:10, 30 days…')}
              value={value}
              onChange={e => setValue(e.target.value)}
              style={{ flex: 1 }}
              aria-label={t('Record value')}
            />
            <button className="btn btn-primary btn-sm" onClick={addRecord} disabled={saving || !label.trim() || !value.trim()} id="save-pr-btn">
              {t('Add')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setLabel(''); setValue(''); }}>
              {t('Cancel')}
            </button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm mt-8" onClick={() => setAdding(true)} id="add-pr-btn">
            <Icon name="plus" size={14} /> {t('Add a PR')}
          </button>
        )}
      </div>
    </div>
  );
}
