import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyRedemptions } from '../api/client';
import Icon from '../components/Icon';

const STATUS_ICONS = {
  pending: '···',
  confirmed: '✓',
  shipped: '⟳',
  delivered: '✓',
};

export default function MyRedemptions() {
  const navigate = useNavigate();
  const [redemptions, setRedemptions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyRedemptions()
      .then(res => setRedemptions(res.redemptions || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = redemptions.filter(r => {
    if (filter === 'pending') return r.delivery_status === 'pending';
    if (filter === 'delivered') return r.delivery_status === 'delivered';
    return true;
  });

  return (
    <div className="page">
      <button className="btn btn-icon btn-secondary mb-16" onClick={() => navigate(-1)} aria-label="Go back"><Icon name="chevron-left" size={20} /></button>
      <h1 className="section-title mb-16">My Redemptions</h1>

      <div className="filter-chips wrap mb-16">
        {['all', 'pending', 'delivered'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : filtered.length === 0 ? (
        <p className="text-secondary text-center">No redemptions yet.</p>
      ) : (
        <div className="admin-card-list">
          {filtered.map((r, i) => (
            <div key={r.id} className="card">
              <div className="card-body">
                <div className="flex gap-12">
                  {r.product_image_url && (
                    <img src={r.product_image_url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 className="card-title text-sm">{r.product_name}</h3>
                    <p className="text-xs text-secondary">{r.provider_name}</p>
                    <p className="text-sm inline-icon-text">{r.points_spent} <Icon name="leaf" size={13} /> • {STATUS_ICONS[r.delivery_status] || ''} {r.delivery_status}</p>
                    <p className="text-xs text-secondary">{new Date(r.redeemed_at).toLocaleString()}</p>
                    {r.redemption_code && <p className="text-sm mt-4"><code>{r.redemption_code}</code></p>}
                    {r.provider_notes && <p className="text-xs text-secondary mt-4">{r.provider_notes}</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
