import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selfOnboardProvider } from '../api/client';
import { INTEREST_CATEGORIES } from '../data/mock';
import { showToast } from '../components/Toast';

const STEPS = ['Invite Code', 'Basic Info', 'Services & Photos', 'Review'];

export default function ProviderOnboard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
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
  });
  const [serviceDraft, setServiceDraft] = useState({ name: '', price: '', duration: '' });

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

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
      showToast('Enter your invite code', '⚠️');
      return;
    }
    if (step === 1 && (!form.name || !form.location_text)) {
      showToast('Fill in required fields', '⚠️');
      return;
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.terms || !form.guidelines) {
      showToast('Please accept terms and guidelines', '⚠️');
      return;
    }
    setSubmitting(true);
    try {
      await selfOnboardProvider({
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      });
      setDone(true);
    } catch (err) {
      showToast(err.message, '❌');
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
      <button className="btn btn-icon btn-secondary mb-16" onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}>←</button>
      <h1 className="section-title mb-8">Become a Wellness Provider</h1>
      <p className="text-secondary text-sm mb-16">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      <div className="progress-bar mb-24">
        <div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step === 0 && (
        <div className="form-stack">
          <p className="text-secondary">Enter your invitation code to start</p>
          <input className="input" placeholder="INVITE-________" value={form.provider_invite_code} onChange={e => update('provider_invite_code', e.target.value.toUpperCase())} />
          <p className="text-sm text-secondary">Don't have a code? Contact: admin@wellcircle.et</p>
        </div>
      )}

      {step === 1 && (
        <div className="form-stack">
          <input className="input" placeholder="Studio/Business Name *" value={form.name} onChange={e => update('name', e.target.value)} />
          <select className="input" value={form.category} onChange={e => update('category', e.target.value)}>
            {INTEREST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea className="input" rows={3} placeholder="Description" value={form.description} onChange={e => update('description', e.target.value)} />
          <input className="input" placeholder="Location *" value={form.location_text} onChange={e => update('location_text', e.target.value)} />
          <input className="input" placeholder="Latitude" value={form.lat} onChange={e => update('lat', e.target.value)} />
          <input className="input" placeholder="Longitude" value={form.lng} onChange={e => update('lng', e.target.value)} />
        </div>
      )}

      {step === 2 && (
        <div className="form-stack">
          <p className="text-sm text-secondary">Add services your studio offers</p>
          <input className="input" placeholder="Service Name" value={serviceDraft.name} onChange={e => setServiceDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="input" type="number" placeholder="Price (ETB)" value={serviceDraft.price} onChange={e => setServiceDraft(d => ({ ...d, price: e.target.value }))} />
          <input className="input" placeholder="Duration" value={serviceDraft.duration} onChange={e => setServiceDraft(d => ({ ...d, duration: e.target.value }))} />
          <button className="btn btn-secondary btn-sm" onClick={addService}>Add Service</button>
          {form.services.map((s, i) => (
            <div key={i} className="chip">{s.name} | ETB {s.price} | {s.duration}</div>
          ))}
          <input className="input" placeholder="Cover Photo URL" value={form.cover_photo_url} onChange={e => update('cover_photo_url', e.target.value)} />
          <select className="input" value={form.price_range} onChange={e => update('price_range', e.target.value)}>
            <option>ETB 500-2000</option>
            <option>ETB 800-3000</option>
            <option>ETB 1000-5000</option>
          </select>
        </div>
      )}

      {step === 3 && (
        <div className="form-stack">
          <div className="card"><div className="card-body">
            <p><strong>Studio:</strong> {form.name}</p>
            <p><strong>Category:</strong> {form.category} | {form.location_text}</p>
            <p><strong>Services:</strong> {form.services.length}</p>
            <p><strong>Price Range:</strong> {form.price_range}</p>
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
        {step < 3 ? (
          <button className="btn btn-primary btn-block" onClick={next}>Next</button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  );
}
