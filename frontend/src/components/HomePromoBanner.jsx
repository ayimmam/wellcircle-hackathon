import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promoApplies, expiryLabel } from '../utils/promo';
import { track, getFeatureFlag, onFeatureFlags } from '../analytics';
import Icon from './Icon';

export const HOME_PROMO_FLAG_KEY = 'home-promo-banner-prominence';

/**
 * Experiment: does a persistent, above-the-fold promo banner on Home (vs.
 * today's baseline, where a presale promo only surfaces on Provider Detail /
 * Explore cards, or once via WelcomeBanner right after onboarding) lift
 * booking conversion for the promo's provider?
 *
 * Control renders nothing — identical to current behavior. Suppressed
 * whenever WelcomeBanner's one-time post-onboarding "welcome gift" is also
 * showing, so the same promo never appears twice on the same screen.
 */
export default function HomePromoBanner({ providers, suppressed = false }) {
  const navigate = useNavigate();
  const [variant, setVariant] = useState(() => getFeatureFlag(HOME_PROMO_FLAG_KEY, 'control'));

  useEffect(() => onFeatureFlags(() => setVariant(getFeatureFlag(HOME_PROMO_FLAG_KEY, 'control'))), []);

  const giftProvider = (providers || []).find(p => promoApplies(p.active_promotion));
  const shouldShow = variant === 'test' && !suppressed && !!giftProvider;

  useEffect(() => {
    if (!shouldShow) return;
    track('promo_view', {
      provider_id: giftProvider.id,
      surface: 'home_banner',
      discount_pct: giftProvider.active_promotion.discount_pct,
      audience: giftProvider.active_promotion.audience,
    });
  }, [shouldShow, giftProvider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shouldShow) return null;

  const promo = giftProvider.active_promotion;

  return (
    <div className="card mb-24" style={{ border: '1px solid var(--accent)' }} id="home-promo-banner">
      <button
        className="btn btn-block"
        style={{
          textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-subtle, rgba(0,0,0,0.04))',
        }}
        onClick={() => navigate(`/provider/${giftProvider.id}`)}
        id="home-promo-banner-cta"
      >
        <span style={{ fontSize: '1.3rem' }}>🏷️</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem' }}>
            {promo.headline || `${promo.discount_pct}% off at ${giftProvider.name}`}
          </span>
          {expiryLabel(promo.valid_until) && (
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {expiryLabel(promo.valid_until)}
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}
