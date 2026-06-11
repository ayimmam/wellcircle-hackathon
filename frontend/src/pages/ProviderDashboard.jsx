import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProviderMe, getProviderStats, getProviderProducts, getProviderRedemptions, createProviderProduct,
  getProviderEvents, createProviderEvent, updateProviderEvent, getSubscriptionPlans,
  initiateSubscription, getSubscriptionStatus, createCommunityChallenge,
} from '../api/client';
import FeedEvent from '../components/FeedEvent';
import { showToast } from '../components/Toast';

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('analytics');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(null);
  
  const [newProduct, setNewProduct] = useState({ name: '', type: 'digital', price_etb: '', quantity_in_stock: '10' });
  const [newEvent, setNewEvent] = useState({ service_name: '', description: '', starts_at: '', ends_at: '', capacity: 10, price_etb: 0 });
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', points_reward: 100, target_checkins: 5, starts_at: '', ends_at: '' });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);
  const [error, setError] = useState(null);

  const loadDashboard = (pid) => Promise.all([
    getProviderStats(pid),
    getProviderProducts(),
    getProviderRedemptions(),
    getProviderEvents(pid),
    getSubscriptionPlans(),
  ]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProviderMe()
      .then(me => {
        const pid = me?.id;
        if (!pid) throw new Error('No provider profile found');
        setProviderId(pid);
        return loadDashboard(pid);
      })
      .then(([s, p, r, ev, pl]) => {
        setStats(s);
        setProducts(p.products || []);
        setRedemptions(r.redemptions || []);
        setEvents(ev.events || []);
        setPlans(pl.plans || []);
      })
      .catch(err => {
        setError(err.message || 'Could not load provider dashboard');
        showToast(err.message || 'Could not load provider dashboard', '❌');
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll stats every 10 seconds for live updates
  useEffect(() => {
    if (!stats || !providerId) return;
    const interval = setInterval(async () => {
      try {
        const newStats = await getProviderStats(providerId);
        setStats(newStats);
      } catch (err) {
        // Silently fail
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [stats, providerId]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '50%', margin: '20px auto 24px' }} />
        <div className="kpi-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="page">
        <button className="btn btn-icon btn-secondary mb-16" onClick={() => navigate(-1)}>←</button>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">{error || 'Unable to load provider dashboard'}</div>
          <p className="text-sm text-secondary mt-8">Provider access is required. Apply via Become Provider or ask an admin to approve your account.</p>
          <button className="btn btn-primary mt-16" onClick={() => navigate('/provider-onboard')}>Become a Provider</button>
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

      <div className="admin-subtabs mb-16" style={{ overflowX: 'auto', whiteSpace: 'nowrap', display: 'flex', gap: '8px' }}>
        <button className={`admin-subtab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`admin-subtab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Events</button>
        <button className={`admin-subtab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
        <button className={`admin-subtab ${tab === 'subscriptions' ? 'active' : ''}`} onClick={() => setTab('subscriptions')}>Subscriptions</button>
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
      ) : tab === 'events' ? (
        <>
          <div className="flex justify-between items-center mb-16">
            <div>
              <p className="text-sm">Upcoming Events: {events.filter(e => !e.is_cancelled && new Date(e.starts_at) > new Date()).length}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateEvent(true)}>+ Create Event</button>
          </div>
          <div className="admin-card-list mb-24">
            {events.map(e => {
              const fillPct = e.capacity ? Math.round(((e.capacity - e.spots_remaining) / e.capacity) * 100) : 0;
              return (
                <div key={e.id} className="card">
                  <div className="card-body">
                    <h3 className="card-title text-sm">{e.service_name}</h3>
                    <p className="text-xs text-secondary">{new Date(e.starts_at).toLocaleString()} | {e.price_etb} ETB</p>
                    <p className="text-xs text-secondary mb-8">Spots: {e.spots_remaining}/{e.capacity}</p>
                    <div className="admin-bar-track mb-8" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                      <div className="admin-bar-fill" style={{ width: `${fillPct}%`, height: '100%', borderRadius: 4 }} />
                    </div>
                    <div className="flex gap-8">
                      {!e.is_cancelled && (
                        <button className="btn btn-secondary btn-sm" onClick={async () => {
                          try {
                            await updateProviderEvent(e.id, { is_cancelled: true });
                            showToast('Event cancelled', '✅');
                            const ev = await getProviderEvents(providerId);
                            setEvents(ev.events || []);
                          } catch (err) { showToast(err.message, '❌'); }
                        }}>Cancel</button>
                      )}
                      <span className={`badge ${e.is_cancelled ? 'badge-muted' : 'badge-success'}`}>{e.is_cancelled ? 'Cancelled' : 'Active'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {showCreateEvent && (
            <div className="modal-overlay" onClick={() => setShowCreateEvent(false)}>
              <div className="modal-card" onClick={ev => ev.stopPropagation()}>
                <h3 className="card-title mb-16">Create Event</h3>
                <div className="form-stack">
                  <input className="input" placeholder="Service Name" value={newEvent.service_name} onChange={e => setNewEvent(p => ({ ...p, service_name: e.target.value }))} />
                  <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
                  <input className="input" type="datetime-local" placeholder="Starts At" value={newEvent.starts_at} onChange={e => setNewEvent(p => ({ ...p, starts_at: e.target.value }))} />
                  <input className="input" type="datetime-local" placeholder="Ends At" value={newEvent.ends_at} onChange={e => setNewEvent(p => ({ ...p, ends_at: e.target.value }))} />
                  <input className="input" type="number" placeholder="Capacity" value={newEvent.capacity} onChange={e => setNewEvent(p => ({ ...p, capacity: parseInt(e.target.value, 10) }))} />
                  <input className="input" type="number" placeholder="Price (ETB)" value={newEvent.price_etb} onChange={e => setNewEvent(p => ({ ...p, price_etb: parseInt(e.target.value, 10) }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      await createProviderEvent({
                        service_name: newEvent.service_name,
                        description: newEvent.description,
                        starts_at: new Date(newEvent.starts_at).toISOString(),
                        ends_at: new Date(newEvent.ends_at).toISOString(),
                        capacity: newEvent.capacity,
                        price_etb: newEvent.price_etb,
                      });
                      showToast('Event created', '✅');
                      setShowCreateEvent(false);
                      const ev = await getProviderEvents(providerId);
                      setEvents(ev.events || []);
                    } catch (err) { showToast(err.message, '❌'); }
                  }}>Create</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : tab === 'subscriptions' ? (
        <>
          <div className="section-header">
            <h2 className="section-title">Subscription Plans</h2>
          </div>
          <div className="flex-col gap-12 mb-24">
            {plans.map(p => {
              const planId = p.plan_id || p.id;
              return (
              <div key={planId} className={`card ${selectedPlan === planId ? 'border-primary' : ''}`} style={selectedPlan === planId ? { border: '2px solid var(--brand-primary)' } : {}} onClick={() => setSelectedPlan(planId)}>
                <div className="card-body">
                  <h3 className="card-title text-sm">{p.name}</h3>
                  <p className="text-sm" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{p.amount_etb ?? p.price_etb} ETB</p>
                  <ul style={{ fontSize: '0.8rem', paddingLeft: '20px', marginTop: '8px' }}>
                    {p.features.map((f, i) => <li key={i} style={{ color: 'var(--text-secondary)' }}>{f}</li>)}
                  </ul>
                </div>
              </div>
            );})}
          </div>
          {selectedPlan && (
            <div className="card" style={{ padding: '16px' }}>
              <h3 className="card-title mb-12">Pay with</h3>
              <div className="form-stack">
                <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="telebirr">Telebirr</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
                {paymentMethod === 'mpesa' && (
                  <input className="input" placeholder="Phone Number (e.g. 254...)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                )}
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    const res = await initiateSubscription({
                      plan: selectedPlan,
                      payment_method: paymentMethod,
                      phone_number: phoneNumber,
                      provider_id: providerId,
                    });
                    if (res.to_pay_url && window.Telegram?.WebApp?.openLink) {
                      window.Telegram.WebApp.openLink(res.to_pay_url);
                    } else if (res.to_pay_url) {
                      window.open(res.to_pay_url, '_blank');
                    }
                    const subId = res.subscription_id;
                    if (subId) {
                      const poll = setInterval(async () => {
                        try {
                          const st = await getSubscriptionStatus(subId);
                          if (st.status === 'active' || st.status === 'success') {
                            clearInterval(poll);
                            showToast('Subscription active!', '✅');
                          }
                        } catch { /* keep polling */ }
                      }, 3000);
                      setTimeout(() => clearInterval(poll), 120000);
                    }
                    if (!res.to_pay_url) showToast('Subscription successful', '✅');
                  } catch (err) { showToast(err.message, '❌'); }
                }}>
                  Subscribe Now
                </button>
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
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateChallenge(c.id)}>+ Challenge</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {showCreateChallenge && (
            <div className="modal-overlay" onClick={() => setShowCreateChallenge(null)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <h3 className="card-title mb-16">Create Challenge</h3>
                <div className="form-stack">
                  <input className="input" placeholder="Title" value={newChallenge.title} onChange={e => setNewChallenge(p => ({ ...p, title: e.target.value }))} />
                  <input className="input" placeholder="Description" value={newChallenge.description} onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))} />
                  <input className="input" type="number" placeholder="Points Reward" value={newChallenge.points_reward} onChange={e => setNewChallenge(p => ({ ...p, points_reward: parseInt(e.target.value, 10) }))} />
                  <input className="input" type="number" placeholder="Target Check-ins" value={newChallenge.target_checkins} onChange={e => setNewChallenge(p => ({ ...p, target_checkins: parseInt(e.target.value, 10) }))} />
                  <input className="input" type="datetime-local" placeholder="Starts At" value={newChallenge.starts_at} onChange={e => setNewChallenge(p => ({ ...p, starts_at: e.target.value }))} />
                  <input className="input" type="datetime-local" placeholder="Ends At" value={newChallenge.ends_at} onChange={e => setNewChallenge(p => ({ ...p, ends_at: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      await createCommunityChallenge(showCreateChallenge, {
                        title: newChallenge.title,
                        description: newChallenge.description,
                        reward_points: newChallenge.points_reward,
                        target_checkins: newChallenge.target_checkins,
                        starts_at: new Date(newChallenge.starts_at).toISOString(),
                        ends_at: new Date(newChallenge.ends_at).toISOString(),
                      });
                      showToast('Challenge created', '✅');
                      setShowCreateChallenge(null);
                    } catch (err) { showToast(err.message, '❌'); }
                  }}>Create</button>
                </div>
              </div>
            </div>
          )}
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
