import { useState, useEffect } from 'react';
import { useProviderPortalData } from '../../context/ProviderPortalDataContext';
import { getSubscriptionPlans, initiateSubscription, getSubscriptionStatus } from '../../api/client';
import { showToast } from '../../components/Toast';
import usePolling from '../../hooks/usePolling';
import { track } from '../../analytics';
import Icon from '../../components/Icon';
import { clickableDivProps } from '../../utils/a11y';

export default function ProviderPortalSubscriptions() {
  const { providerId } = useProviderPortalData();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [subPollId, setSubPollId] = useState(null);
  const [subPollStartedAt, setSubPollStartedAt] = useState(null);

  useEffect(() => {
    track('subscription_plan_view', {});
    getSubscriptionPlans()
      .then(pl => setPlans(pl.plans || []))
      .catch(err => showToast(err.message || 'Could not load plans', 'error'));
  }, []);

  usePolling(async () => {
    if (!subPollId) return;
    try {
      const st = await getSubscriptionStatus(subPollId);
      if (st.status === 'active' || st.status === 'success') {
        showToast('Subscription active!', 'success');
        setSubPollId(null);
        return;
      }
    } catch { /* keep polling */ }
    if (subPollStartedAt && Date.now() - subPollStartedAt > 120000) {
      setSubPollId(null);
    }
  }, 3000, Boolean(subPollId));

  return (
    <div id="provider-portal-subscriptions">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Subscription Plans</h1>
      </div>
      <div className="portal-grid-3 mb-24">
        {/* Anchoring: priciest plan first so Pro's 3,000 ETB frames Growth
            as the reasonable middle; per-day subline shrinks the ask */}
        {[...plans]
          .sort((a, b) => (b.amount_etb ?? b.price_etb ?? 0) - (a.amount_etb ?? a.price_etb ?? 0))
          .map(p => {
          const planId = p.plan_id || p.id;
          const monthly = p.amount_etb ?? p.price_etb;
          const isPopular = String(planId).toLowerCase().includes('growth') || /growth/i.test(p.name || '');
          return (
          <div
            key={planId}
            className={`card ${selectedPlan === planId ? 'border-primary' : ''}`}
            style={selectedPlan === planId ? { border: '2px solid var(--brand-primary)', cursor: 'pointer' } : { cursor: 'pointer' }}
            aria-label={p.name}
            {...clickableDivProps(() => { setSelectedPlan(planId); track('subscription_plan_select', { plan: planId }); })}
            id={`plan-${planId}`}
          >
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h3 className="card-title text-sm">{p.name}</h3>
                {isPopular && (
                  <span className="category-badge inline-icon-text" style={{ background: 'var(--accent)' }} id="most-popular-plan">
                    <Icon name="star" size={12} /> Most popular
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                {monthly?.toLocaleString()} ETB/mo
                {monthly > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6, fontSize: '0.75rem' }}>
                    ≈ {Math.round(monthly / 30)} ETB/day
                  </span>
                )}
              </p>
              <ul style={{ fontSize: '0.8rem', paddingLeft: '20px', marginTop: '8px' }}>
                {p.features.map((f, i) => <li key={i} style={{ color: 'var(--text-secondary)' }}>{f}</li>)}
              </ul>
            </div>
          </div>
        );})}
      </div>
      {selectedPlan && (
        <div className="card" style={{ padding: '16px', maxWidth: 380 }}>
          <h3 className="card-title mb-12">Pay with</h3>
          <div className="form-stack">
            <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} aria-label="Payment method">
              <option value="telebirr">Telebirr</option>
              <option value="mpesa">M-Pesa</option>
            </select>
            {paymentMethod === 'mpesa' && (
              <input className="input" type="tel" inputMode="tel" placeholder="Phone Number (e.g. 254...)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} aria-label="Phone number" autoComplete="tel" />
            )}
            <button className="btn btn-primary" onClick={async () => {
              try {
                track('subscription_initiated', { plan: selectedPlan, payment_method: paymentMethod });
                const res = await initiateSubscription({
                  plan: selectedPlan,
                  payment_method: paymentMethod,
                  phone_number: phoneNumber,
                  provider_id: providerId,
                });
                if (res.to_pay_url) window.open(res.to_pay_url, '_blank');
                if (res.subscription_id) {
                  setSubPollId(res.subscription_id);
                  setSubPollStartedAt(Date.now());
                }
                if (!res.to_pay_url) showToast('Subscription successful', 'success');
              } catch (err) { showToast(err.message, 'error'); }
            }}>
              Subscribe Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
