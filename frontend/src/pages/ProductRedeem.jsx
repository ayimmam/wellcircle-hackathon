import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProduct, redeemProduct } from '../api/client';
import { showToast } from '../components/Toast';

export default function ProductRedeem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [product, setProduct] = useState(null);
  const [address, setAddress] = useState({ fullName: '', phone: '', line1: '', neighborhood: 'Bole', city: 'Addis Ababa' });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(id).then(setProduct).catch(() => navigate('/products')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !product) {
    return <div className="page"><div className="skeleton" style={{ height: 200 }} /></div>;
  }

  const balance = user?.points_balance ?? 0;
  const insufficient = balance < product.price_etb;

  const handleRedeem = async () => {
    if (insufficient) return;
    if (product.shipping_required) {
      if (!address.line1 || !address.fullName) {
        showToast('Please fill in delivery address', '⚠️');
        return;
      }
    }
    setSubmitting(true);
    try {
      const delivery = product.shipping_required
        ? `${address.city}, ${address.neighborhood}, ${address.line1} (${address.fullName}, ${address.phone})`
        : undefined;
      const res = await redeemProduct(id, { delivery_address: delivery });
      setResult(res);
      refreshUser();
    } catch (err) {
      showToast(err.message, '❌');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (result?.redemption_code) {
      navigator.clipboard.writeText(result.redemption_code);
      showToast('Copied to clipboard', '✅');
    }
  };

  if (result) {
    return (
      <div className="page">
        <div className="card text-center">
          <div className="card-body">
            <div style={{ fontSize: '2.5rem' }}>✓</div>
            <h2 className="card-title mt-12">Redeemed Successfully</h2>
            {result.redemption_code && (
              <div className="voucher-box mt-16">
                <code>{result.redemption_code}</code>
                <button className="btn btn-secondary btn-sm mt-8" onClick={copyCode}>Copy to Clipboard</button>
              </div>
            )}
            <p className="mt-16">New Balance: <strong>{result.details.new_balance} Points 🌿</strong></p>
            {result.details.provider_instructions && (
              <p className="text-sm text-secondary mt-12">{result.details.provider_instructions}</p>
            )}
            <div className="flex gap-12 mt-24">
              <button className="btn btn-primary" onClick={() => navigate('/products')}>Browse More</button>
              <button className="btn btn-secondary" onClick={() => navigate('/home')}>Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn btn-icon btn-secondary mb-16" onClick={() => navigate(-1)}>←</button>
      <h2 className="section-title mb-16">Confirm Redemption</h2>

      <div className="card mb-16">
        <div className="card-body">
          <p><strong>Product:</strong> {product.name}</p>
          <p><strong>Cost:</strong> {product.price_etb} Points 🌿</p>
          <p><strong>Your Balance:</strong> {balance} Points 🌿</p>
        </div>
      </div>

      {insufficient ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div className="card-body">
            <p style={{ color: 'var(--danger)' }}><strong>Insufficient Points</strong></p>
            <p className="text-sm">You need {product.price_etb} but only have {balance}.</p>
            <button className="btn btn-secondary btn-block mt-16" onClick={() => navigate('/products')}>Browse More</button>
          </div>
        </div>
      ) : product.shipping_required ? (
        <div className="form-stack">
          <h3 className="section-subtitle">Enter Delivery Address</h3>
          <input className="input" placeholder="Full Name" value={address.fullName} onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))} />
          <input className="input" placeholder="Phone" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} />
          <input className="input" placeholder="Address Line 1" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} />
          <input className="input" placeholder="Neighborhood" value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))} />
          <input className="input" placeholder="City" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
          <div className="flex gap-12">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRedeem} disabled={submitting}>
              {submitting ? 'Processing...' : 'Confirm Redemption'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary btn-block" onClick={handleRedeem} disabled={submitting}>
          {submitting ? 'Processing...' : `Confirm Redemption (${product.price_etb} pts)`}
        </button>
      )}
    </div>
  );
}
