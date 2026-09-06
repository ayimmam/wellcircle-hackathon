import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../api/client';
import Icon from './Icon';

/**
 * C4: onboarding goal — one concrete near-term redemption target, so points
 * feel less abstract. Loyalty best practice: surface a first reward reachable
 * within a few interactions (LoyaltyLion/Yotpo). Picks the cheapest product
 * the backend already flags `is_recommended` for the user's interest category
 * (falls back to the cheapest product overall if none match).
 */
export default function FirstRewardCard({ pointsBalance }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProducts({ sort_by: 'price_asc', per_page: 50 })
      .then(res => {
        if (cancelled) return;
        const products = res.products || [];
        const recommended = products.filter(p => p.is_recommended);
        const pick = (recommended.length ? recommended : products)
          .slice()
          .sort((a, b) => (a.price_etb ?? a.points_cost) - (b.price_etb ?? b.points_cost))[0];
        setTarget(pick || null);
      })
      .catch(() => setTarget(null));
    return () => { cancelled = true; };
  }, []);

  if (!target) return null;

  const cost = target.price_etb ?? target.points_cost;
  const remaining = Math.max(0, cost - (pointsBalance || 0));
  const reached = remaining === 0;
  const pct = Math.min(100, Math.round(((pointsBalance || 0) / cost) * 100));

  return (
    <div
      className="card mb-24"
      style={{ padding: 16, cursor: 'pointer' }}
      onClick={() => navigate(`/products/${target.id}`)}
      id="first-reward-card"
    >
      <div className="flex items-center justify-between mb-8">
        <span className="flex items-center gap-6" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
          <Icon name={reached ? 'trophy' : 'star'} size={15} />
          {reached ? 'Reward unlocked!' : 'Your first reward'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{pointsBalance || 0}/{cost} pts</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        {reached
          ? `You have enough for ${target.name} — tap to redeem.`
          : `${remaining} more point${remaining === 1 ? '' : 's'} to unlock ${target.name}.`}
      </p>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
