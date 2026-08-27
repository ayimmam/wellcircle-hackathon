import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selfOnboardProvider, initiateSubscription, getSubscriptionStatus } from '../api/client';
import { INTEREST_CATEGORIES } from '../data/mock';
import { showToast } from '../components/Toast';
import usePolling from '../hooks/usePolling';
import Icon from '../components/Icon';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

const STEPS = ['Invite Code', 'Basic Info', 'Services & Photos', 'Payment Setup', 'Review'];

export default function ProviderOnboard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useTelegramBackButton(() => {
    if (step > 0) setStep(s => s - 1);
    else navigate(-1);
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    provider_invite_code: '',
    name: '',
    category: 'yoga',
    description: '',
    location_text: '',
    lat: '',
    lng: '',
    price_range: 'ETB 500-2000',
    services: [],
    cover_photo_url: '',
    photos: [],
    terms: false,
    guidelines: false,
    payment_method: 'telebirr',
    payment_account: '',
    subscription_plan: 'starter',
  });
  const [serviceDraft, setServiceDraft] = useState({ name: '', price: '', duration: '' });
  const [subPollId, setSubPollId] = useState(null);
  const [subPollStartedAt, setSubPollStartedAt] = useState(null);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // B4: was a raw setInterval + setTimeout pair; usePolling standardizes the
  // hidden-tab pause and unmount cleanup. Fire-and-forget by design (matches
  // prior behavior) — it just stops polling once active or after 120s.
  usePolling(async () => {
    if (!subPollId) return;
    try {
      const st = await getSubscriptionStatus(subPollId);
      if (st.status === 'active' || st.status === 'success') {
        setSubPollId(null);
        return;
      }
    } catch { /* ignore */ }
    if (subPollStartedAt && Date.now() - subPollStartedAt > 120000) {
      setSubPollId(null);
    }
  }, 3000, Boolean(subPollId));

  const addService = () => {
    if (!serviceDraft.name || !serviceDraft.price) return;
    update('services', [...form.services, {
      name: serviceDraft.name,
      price: parseInt(serviceDraft.price, 10),
      duration: serviceDraft.duration || '60 min'
    }]);
    setServiceDraft({ name: '', price: '', duration: '' });
  };

  const next = () => {
    if (step === 0 && !form.provider_invite_code.trim()) {
      showToast('Enter your invite code', 'error');
      return;
    }
    if (step === 1 && (!form.name || !form.location_text)) {
      showToast('Fill in required fields', 'error');
      return;
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.terms || !form.guidelines) {
      showToast('Please accept terms and guidelines', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await selfOnboardProvider({
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      });
      const paidPlans = ['starter', 'growth', 'pro'];
      if (paidPlans.includes(form.subscription_plan) && res.provider_id) {
        const sub = await initiateSubscription({
          plan: form.subscription_plan,
          payment_method: form.payment_method === 'mpesa' ? 'mpesa' : 'telebirr',
          phone_number: form.payment_account,
          provider_id: res.provider_id,
        });
        if (sub.to_pay_url && window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(sub.to_pay_url);
        }
        if (sub.subscription_id) {
          setSubPollId(sub.subscription_id);
          setSubPollStartedAt(Date.now());
        }
      }
      setDone(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="page onboard-page" id="provider-onboard-screen">
        <div className="card text-center">
          <div className="card-body">
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✓</div>
            <h2 className="card-title mb-12">Application Submitted</h2>
            <p className="text-secondary mb-8">Your application is pending review by our admin team.</p>
            <p className="text-secondary mb-8">Expected timeline: 24-48 hours</p>
            <p className="text-sm text-secondary mb-24">You'll be notified when approved via this app or Telegram.</p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/home')}>Return to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page onboard-page" id="provider-onboard-screen">
      <button className="btn btn-icon btn-secondary mb-16" onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} aria-label="Go back"><Icon name="chevron-left" size={20} /></button>
      <h1 className="section-title mb-8">Become a Wellness Provider</h1>
      <p className="text-secondary text-sm mb-16">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      <div className="progress-bar mb-24">
        <div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step === 0 && (
        <div className="form-stack">
          <p className="text-secondary">Enter your invitation code to start</p>
          <input className="input" placeholder="INVITE-________" value={form.provider_invite_code} onChange={e => update('provider_invite_code', e.target.value.toUpperCase())} aria-label="Invitation code" autoComplete="off" spellCheck={false} />
          <p className="text-sm text-secondary">Don't have a code? Contact: admin@wellcircle.et</p>
        </div>
      )}

      {step === 1 && (
        <div className="form-stack">
          <input className="input" placeholder="Studio/Business Name *" value={form.name} onChange={e => update('name', e.target.value)} aria-label="Studio/Business name" autoComplete="off" />
          <select className="input" value={form.category} onChange={e => update('category', e.target.value)} aria-label="Category">
            {INTEREST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea className="input" rows={3} placeholder="Description" value={form.description} onChange={e => update('description', e.target.value)} aria-label="Description" />
          <input className="input" placeholder="Location *" value={form.location_text} onChange={e => update('location_text', e.target.value)} aria-label="Location" autoComplete="off" />
          <input className="input" type="number" inputMode="decimal" placeholder="Latitude" value={form.lat} onChange={e => update('lat', e.target.value)} aria-label="Latitude" />
          <input className="input" type="number" inputMode="decimal" placeholder="Longitude" value={form.lng} onChange={e => update('lng', e.target.value)} aria-label="Longitude" />
        </div>
      )}

      {step === 2 && (
        <div className="form-stack">
          <p className="text-sm text-secondary">Add services your studio offers</p>
          <input className="input" placeholder="Service Name" value={serviceDraft.name} onChange={e => setServiceDraft(d => ({ ...d, name: e.target.value }))} aria-label="Service name" autoComplete="off" />
          <input className="input" type="number" inputMode="numeric" placeholder="Price (ETB)" value={serviceDraft.price} onChange={e => setServiceDraft(d => ({ ...d, price: e.target.value }))} aria-label="Service price in ETB" />
          <input className="input" placeholder="Duration" value={serviceDraft.duration} onChange={e => setServiceDraft(d => ({ ...d, duration: e.target.value }))} aria-label="Service duration" autoComplete="off" />
          <button className="btn btn-secondary btn-sm" onClick={addService}>Add Service</button>
          {form.services.map((s, i) => (
            <div key={i} className="chip">{s.name} | ETB {s.price} | {s.duration}</div>
          ))}
          <input className="input" placeholder="Cover Photo URL" value={form.cover_photo_url} onChange={e => update('cover_photo_url', e.target.value)} aria-label="Cover photo URL" autoComplete="off" />
          <select className="input" value={form.price_range} onChange={e => update('price_range', e.target.value)} aria-label="Price range">
            <option>ETB 500-2000</option>
            <option>ETB 800-3000</option>
            <option>ETB 1000-5000</option>
          </select>
        </div>
      )}

      {step === 3 && (
        <div className="form-stack">
          <p className="text-secondary text-sm">How would you like to receive payments from bookings?</p>
          <select className="input" value={form.payment_method} onChange={e => update('payment_method', e.target.value)} aria-label="Payout method">
            <option value="telebirr">Telebirr</option>
            <option value="mpesa">M-Pesa</option>
            <option value="cbe">CBE Birr</option>
          </select>
          <input className="input" placeholder="Account Number or Phone *" value={form.payment_account} onChange={e => update('payment_account', e.target.value)} aria-label="Payout account number or phone" autoComplete="off" />

          <div className="card card-warning mt-16">
            <div className="card-body">
              <h4 className="font-bold mb-4 text-sm card-warning-title">Boost your visibility</h4>
              <p className="text-xs text-secondary mb-8">Subscribe to a premium plan to be featured on the Explore page and boost your upcoming events.</p>
              <select className="input" value={form.subscription_plan} onChange={e => update('subscription_plan', e.target.value)} aria-label="Subscription plan">
                <option value="starter">Starter — 500 ETB/mo</option>
                <option value="growth">Growth — 1,500 ETB/mo</option>
                <option value="pro">Pro — 3,000 ETB/mo (Featured)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="form-stack">
          <div className="card mt-8"><div className="card-body">
            <p><strong>Studio:</strong> {form.name}</p>
            <p><strong>Category:</strong> {form.category} | {form.location_text}</p>
            <p><strong>Services:</strong> {form.services.length}</p>
            <p><strong>Price Range:</strong> {form.price_range}</p>
            <p><strong>Payout:</strong> {form.payment_method} ({form.payment_account})</p>
            <p><strong>Plan:</strong> {form.subscription_plan}</p>
          </div></div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.terms} onChange={e => update('terms', e.target.checked)} />
            <span>Terms of Service</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.guidelines} onChange={e => update('guidelines', e.target.checked)} />
            <span>Community Guidelines</span>
          </label>
        </div>
      )}

      <div className="flex gap-12 mt-24">
        {step < 4 ? (
          <button className="btn btn-primary btn-block" onClick={next}>Next</button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  );
}
