import { useState } from 'react';
import { createProviderPromotion } from '../api/client';
import { showToast } from './Toast';

// Basic promotion-creation stub for the provider dashboard (presale sprint).
// A flat % discount; "first-time visitors only" makes it a presale promo the
// backend auto-applies to eligible bookings.
export default function PromotionForm({ onCreated }) {
  const [headline, setHeadline] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [firstTimeOnly, setFirstTimeOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const discountNum = discountPct === '' ? null : Number(discountPct);
  const canSubmit =
    headline.trim().length > 0 &&
    validUntil !== '' &&
    (!firstTimeOnly || (discountNum !== null && discountNum > 0)) &&
    (discountNum === null || (discountNum >= 0 && discountNum <= 100));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const promo = await createProviderPromotion({
        headline: headline.trim(),
        discount_pct: discountNum,
        // date input → end of that day UTC, so "valid until Jul 26" includes Jul 26
        valid_until: `${validUntil}T23:59:59Z`,
        audience: firstTimeOnly ? 'first_time' : 'all',
      });
      showToast('Promotion created!', 'success');
      setHeadline('');
      setDiscountPct('');
      setValidUntil('');
      onCreated?.(promo);
    } catch (err) {
      showToast(err.message || 'Could not create promotion', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit} id="promotion-form">
      <div className="card-body">
        <h2 className="section-title mb-12">Create a Promotion</h2>

        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Headline
        </label>
        <input
          className="input"
          placeholder="Presale: 20% off your first visit"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          maxLength={255}
          id="promo-headline-input"
        />

        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', margin: '12px 0 6px' }}>
          Discount %
        </label>
        <input
          className="input"
          type="number"
          min="0"
          max="100"
          placeholder="20"
          value={discountPct}
          onChange={e => setDiscountPct(e.target.value)}
          id="promo-discount-input"
        />

        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', margin: '12px 0 6px' }}>
          Valid until
        </label>
        <input
          className="input"
          type="date"
          value={validUntil}
          onChange={e => setValidUntil(e.target.value)}
          id="promo-valid-until-input"
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', fontSize: '0.85rem' }}>
          <input
            type="checkbox"
            checked={firstTimeOnly}
            onChange={e => setFirstTimeOnly(e.target.checked)}
            id="promo-first-time-checkbox"
          />
          First-time visitors only (presale)
        </label>
        {firstTimeOnly && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Applied automatically at checkout for guests with no previous paid booking at your business.
          </p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={!canSubmit || submitting} id="promo-submit-btn">
          {submitting ? 'Creating…' : 'Create Promotion'}
        </button>
      </div>
    </form>
  );
}
