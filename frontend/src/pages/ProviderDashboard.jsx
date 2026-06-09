import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviderStats, getProviderProducts, getProviderRedemptions, createProviderProduct } from '../api/client';
import FeedEvent from '../components/FeedEvent';
import { showToast } from '../components/Toast';

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('analytics');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', type: 'digital', price_etb: '', quantity_in_stock: '10' });
  const [loading, setLoading] = useState(true);

  // Use Shanti Yoga Addis as the demo provider
  const providerId = '11111111-0000-0000-0000-000000000003';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProviderStats(providerId),
      getProviderProducts(),
      getProviderRedemptions(),
    ]).then(([s, p, r]) => {
      setStats(s);
      setProducts(p.products || []);
      setRedemptions(r.redemptions || []);
    }).finally(() => setLoading(false));
  }, []);

  // Poll stats every 10 seconds for live updates
  useEffect(() => {
    if (!stats) return;
    const interval = setInterval(async () => {
      try {
        const newStats = await getProviderStats(providerId);
        setStats(newStats);
      } catch (err) {
        // Silently fail
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '50%', margin: '20px auto 24px' }} />
        <div className="kpi-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page" id="provider-dashboard-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-16">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} id="dashboard-back-btn">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.provider_name}</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Provider Dashboard</p>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>🟢 Live</span>
      </div>

      <div className="admin-subtabs mb-16">
        <button className={`admin-subtab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`admin-subtab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
      </div>

      {tab === 'products' ? (
        <>
          <div className="flex justify-between items-center mb-16">
            <div>
              <p className="text-sm">Total: {products.length} | Active: {products.filter(p => p.is_active).length}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Create Product</button>
          </div>
          <div className="admin-card-list mb-24">
            {products.map(p => (
              <div key={p.id} className="card">
                <div className="card-body">
                  <h3 className="card-title text-sm">{p.name}</h3>
                  <p className="text-xs text-secondary">{p.type} | {p.price_etb} pts | Stock: {p.quantity_in_stock}</p>
                  <span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            ))}
          </div>
          {redemptions.length > 0 && (
            <>
              <h3 className="section-subtitle mb-12">Recent Redemptions</h3>
              {redemptions.map(r => (
                <div key={r.id} className="card mb-8">
                  <div className="card-body text-sm">
                    {r.user_name} → {r.redemption_code || r.product_name} | {r.delivery_status}
                  </div>
                </div>
              ))}
            </>
          )}
          {showCreate && (
            <div className="modal-overlay" onClick={() => setShowCreate(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <h3 className="card-title mb-16">Create Product</h3>
                <div className="form-stack">
                  <input className="input" placeholder="Name" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
                  <select className="input" value={newProduct.type} onChange={e => setNewProduct(p => ({ ...p, type: e.target.value }))}>
                    <option value="digital">Digital</option>
                    <option value="physical">Physical</option>
                  </select>
                  <input className="input" type="number" placeholder="Price (points)" value={newProduct.price_etb} onChange={e => setNewProduct(p => ({ ...p, price_etb: e.target.value }))} />
                  <input className="input" type="number" placeholder="Stock" value={newProduct.quantity_in_stock} onChange={e => setNewProduct(p => ({ ...p, quantity_in_stock: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      await createProviderProduct({
                        name: newProduct.name,
                        type: newProduct.type,
                        price_etb: parseInt(newProduct.price_etb, 10),
                        quantity_in_stock: parseInt(newProduct.quantity_in_stock, 10),
                      });
                      showToast('Product created', '✅');
                      setShowCreate(false);
                      const p = await getProviderProducts();
                      setProducts(p.products || []);
                    } catch (err) { showToast(err.message, '❌'); }
                  }}>Create</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
      <>
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card accent">
          <div className="kpi-value">{stats.stats.total_members}</div>
          <div className="kpi-label">Total Members</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: 'var(--info)' }}>{stats.stats.new_members_today}</div>
          <div className="kpi-label">New Today</div>
        </div>
        <div className="kpi-card secondary">
          <div className="kpi-value">{stats.stats.bookings_this_week}</div>
          <div className="kpi-label">Bookings (Week)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: 'var(--accent-light)' }}>
            {(stats.stats.estimated_revenue_etb || 0).toLocaleString()}
          </div>
          <div className="kpi-label">Revenue (ETB)</div>
        </div>
      </div>

      {/* Engagement stats */}
      <div className="card mb-24">
        <div className="card-body">
          <div className="profile-stat-row">
            <div>
              <div className="profile-stat-value" style={{ fontSize: '1.2rem' }}>{stats.stats.checkins_today}</div>
              <div className="profile-stat-label">Check-ins Today</div>
            </div>
            <div>
              <div className="profile-stat-value" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>
                {Math.round((stats.stats.engagement_rate || 0) * 100)}%
              </div>
              <div className="profile-stat-label">Engagement Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Community Performance */}
      {stats.communities?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Communities</h2>
          </div>
          <div className="flex-col gap-8 mb-24">
            {stats.communities.map(c => (
              <div key={c.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-center">
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        👥 {c.member_count} · ✅ {c.checkins_today} check-ins · {Math.round(c.engagement_rate * 100)}% engagement
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Live Member Feed */}
      {stats.recent_feed?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Live Activity</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>🟢 Real-time</span>
          </div>
          <div className="feed mb-24">
            {stats.recent_feed.map(event => (
              <FeedEvent key={event.id || event.created_at} event={event} />
            ))}
          </div>
        </>
      )}

      {/* Bookings Table */}
      {stats.recent_bookings?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Recent Bookings</h2>
          </div>
          <div className="card" style={{ overflow: 'auto' }}>
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_bookings.map(bk => (
                  <tr key={bk.id}>
                    <td>@{bk.user_handle}</td>
                    <td>{bk.service_name}</td>
                    <td style={{ fontWeight: 600 }}>ETB {bk.amount_etb?.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${bk.payment_status}`}>
                        {bk.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
