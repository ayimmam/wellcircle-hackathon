import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INTEREST_CATEGORIES, EXERCISE_FREQUENCIES } from '../data/mock';
import { promoApplies } from '../utils/promo';
import { track } from '../analytics';
import Icon from './Icon';

/**
 * One-time post-onboarding moment on Home (shown via route state
 * `justOnboarded`), doing two jobs:
 *  - IKEA effect: reflect the plan the user just built back at them
 *    (their interest, frequency, circles — plus the welcome points), with a
 *    soft progressive-profiling link to add their neighbourhood later.
 *  - Reciprocity: surface a "welcome gift" — the first provider promo the
 *    user is eligible for (first-time presale promos auto-apply at checkout).
 */
export default function WelcomeBanner({ user, providers }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const giftProvider = (providers || []).find(p => promoApplies(p.active_promotion));

  useEffect(() => {
    if (!giftProvider) return;
    track('promo_view', {
      provider_id: giftProvider.id,
      surface: 'welcome_gift',
      discount_pct: giftProvider.active_promotion.discount_pct,
      audience: giftProvider.active_promotion.audience,
    });
  }, [giftProvider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed || !user) return null;

  const interest = INTEREST_CATEGORIES.find(c => c.value === user.interest_category);
  const frequency = EXERCISE_FREQUENCIES.find(f => f.value === user.exercise_frequency);
  const circleCount = user.joined_communities?.length || 0;
  const promo = giftProvider?.active_promotion;

  return (
    <div className="card mb-24" style={{ border: '1px solid var(--accent)' }} id="welcome-banner">
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div className="flex items-center justify-between">
          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>🎉 Your plan is set</span>
          <button
            className="alert-banner-close"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss welcome banner"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 10px' }}>
          {interest ? `${interest.emoji} ${interest.label}` : 'Wellness'}
          {frequency ? ` · ${frequency.label.toLowerCase()}` : ''}
          {circleCount > 0 ? ` · ${circleCount} circle${circleCount === 1 ? '' : 's'} joined` : ''}
          {' · '}<b style={{ color: 'var(--accent)' }}>+20 pts earned</b>
        </p>

        {promo && (
          <button
            className="btn btn-block"
            style={{
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-subtle, rgba(0,0,0,0.04))', marginBottom: 10,
            }}
            onClick={() => navigate(`/provider/${giftProvider.id}`)}
            id="welcome-gift-card"
          >
            <span style={{ fontSize: '1.3rem' }}>🎁</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem' }}>
                Welcome gift: {promo.discount_pct}% off at {giftProvider.name}
              </span>
              {promo.valid_until && (
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Applied automatically at checkout · expires{' '}
                  {new Date(promo.valid_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        )}

        <button
          className="section-action inline-icon-text"
          style={{ fontSize: '0.78rem' }}
          onClick={() => { track('profile_prompt_click', { field: 'neighbourhood' }); navigate('/profile'); }}
          id="neighbourhood-prompt"
        >
          Add your neighbourhood for local alerts <Icon name="chevron-right" size={13} />
        </button>
      </div>
    </div>
  );
}
