import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitFeedback } from '../api/client';
import { showToast } from './Toast';

/**
 * Bottom-sheet overlay for reporting a bug — same local-overlay pattern as
 * BookingFlow's multi-day modal (no portal needed). Can be opened bare (from
 * Profile) or pre-wired with a caught error (from ErrorBoundary).
 */
export default function BugReportSheet({ error, onClose }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const context = {
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    error: error?.message ?? null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback({ type: 'bug', message: message.trim(), context });
      showToast(t("Thanks — we're on it."), 'success');
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="bug-report-modal"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 360, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="card-body">
          <h3 className="card-title mb-16">{t('Report a bug')}</h3>
          <textarea
            className="input"
            id="bug-report-message"
            rows={4}
            style={{ width: '100%', resize: 'vertical' }}
            placeholder={t('What went wrong?')}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-sm text-secondary mt-8">
            {t('We\'ll include this page and some technical details automatically.')}
          </p>
          <div className="flex gap-8 mt-16">
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!message.trim() || submitting}
              id="bug-report-submit-btn"
            >
              {t('Submit')}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
