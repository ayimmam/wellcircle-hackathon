import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProviderMe, getProviderStats, getProviderProducts, getProviderRedemptions, createProviderProduct,
  getProviderEvents, createProviderEvent, updateProviderEvent, getSubscriptionPlans,
  initiateSubscription, getSubscriptionStatus, createCommunityChallenge,
  getProviderCustomers, awardCustomerPoints, getPriceSuggestion, getProviderPointsAnalytics,
  getProviderBookings, getProviderServiceBreakdown, getProviderDemographics,
  getProviderMetricsTimeseries, updateProviderRedemptionStatus,
} from '../api/client';
import FeedEvent from '../components/FeedEvent';
import PromotionForm from '../components/PromotionForm';
import { showToast } from '../components/Toast';
import usePolling from '../hooks/usePolling';
import { track } from '../analytics';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { clickableDivProps } from '../utils/a11y';
import useDismissOnEscape from '../hooks/useDismissOnEscape';

const PROVIDER_DAILY_AWARD_CAP = 300; // mirrors backend PROVIDER_AWARD_MAX_POINTS_PER_DAY
const REDEMPTION_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

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

  useDismissOnEscape(() => setShowCreate(false), showCreate);
  useDismissOnEscape(() => setShowCreateEvent(false), showCreateEvent);
  useDismissOnEscape(() => setShowCreateChallenge(null), Boolean(showCreateChallenge));
  
  const [newProduct, setNewProduct] = useState({ name: '', type: 'digital', price_etb: '', quantity_in_stock: '10' });
  const [newEvent, setNewEvent] = useState({ service_name: '', description: '', starts_at: '', ends_at: '', capacity: 10, price_etb: 0, staff_user_id: '' });
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', points_reward: 100, target_checkins: 5, starts_at: '', ends_at: '' });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);
  const [providerCategory, setProviderCategory] = useState(null);
  const [error, setError] = useState(null);
  const [subPollId, setSubPollId] = useState(null);
  const [subPollStartedAt, setSubPollStartedAt] = useState(null);

  // C1/D3/C5: customer list, one-tap awards, points-redeemed trend
  const [customers, setCustomers] = useState([]);
  const [pointsAnalytics, setPointsAnalytics] = useState(null);
  const [awardingId, setAwardingId] = useState(null);
  // D1: price suggestion hint chip on the product form
  const [priceSuggestion, setPriceSuggestion] = useState(null);

  // Bookings & Insights tab: paginated booking list + service mix + demographics
  const [bookings, setBookings] = useState([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsStatus, setBookingsStatus] = useState('');
  const [bookingsStartDate, setBookingsStartDate] = useState('');
  const [bookingsEndDate, setBookingsEndDate] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [serviceBreakdown, setServiceBreakdown] = useState([]);
  const [demographics, setDemographics] = useState(null);

  // Custom time metrics (Analytics tab date-range picker)
  const [metricsStartDate, setMetricsStartDate] = useState(isoDateDaysAgo(6));
  const [metricsEndDate, setMetricsEndDate] = useState(todayIsoDate());
  const [timeseries, setTimeseries] = useState(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  // Redeem management: per-row status + notes being edited
  const [redemptionEdits, setRedemptionEdits] = useState({});
  const [updatingRedemptionId, setUpdatingRedemptionId] = useState(null);

  const loadDashboard = (pid) => Promise.all([
    getProviderStats(pid),
    getProviderProducts(),
    getProviderRedemptions(),
    getProviderEvents(pid),
    getSubscriptionPlans(),
    getProviderCustomers(),
    getProviderPointsAnalytics(),
  ]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProviderMe()
      .then(me => {
        const pid = me?.id;
        if (!pid) throw new Error('No provider profile found');
        setProviderId(pid);
        setProviderCategory(me?.category || null);
        return loadDashboard(pid);
      })
      .then(([s, p, r, ev, pl, cu, pa]) => {
        setStats(s);
        setProducts(p.products || []);
        setRedemptions(r.redemptions || []);
        setEvents(ev.events || []);
        setPlans(pl.plans || []);
        setCustomers(cu.customers || []);
        setPointsAnalytics(pa);
      })
      .catch(err => {
        setError(err.message || 'Could not load provider dashboard');
        showToast(err.message || 'Could not load provider dashboard', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const loadBookingsTab = async (page = 1) => {
    setBookingsLoading(true);
    try {
      const filters = {
        page,
        per_page: 20,
        status: bookingsStatus || null,
        start_date: bookingsStartDate ? `${bookingsStartDate}T00:00:00Z` : null,
        end_date: bookingsEndDate ? `${bookingsEndDate}T23:59:59Z` : null,
      };
      const [bk, svc, demo] = await Promise.all([
        getProviderBookings(filters),
        getProviderServiceBreakdown({ start_date: filters.start_date, end_date: filters.end_date }),
        getProviderDemographics(),
      ]);
      setBookings(bk.bookings || []);
      setBookingsTotal(bk.total || 0);
      setBookingsPage(page);
      setServiceBreakdown(svc.services || []);
      setDemographics(demo);
    } catch (err) {
      showToast(err.message || 'Could not load bookings', 'error');
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'bookings' && providerId && bookings.length === 0 && !bookingsLoading) {
      loadBookingsTab(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, providerId]);

  const loadTimeseries = async () => {
    setTimeseriesLoading(true);
    try {
      const ts = await getProviderMetricsTimeseries(
        `${metricsStartDate}T00:00:00Z`,
        `${metricsEndDate}T23:59:59Z`,
      );
      setTimeseries(ts);
    } catch (err) {
      showToast(err.message || 'Could not load custom time metrics', 'error');
    } finally {
      setTimeseriesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'analytics' && providerId && !timeseries && !timeseriesLoading) {
      loadTimeseries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, providerId]);

  const handleUpdateRedemption = async (redemptionId) => {
    const edit = redemptionEdits[redemptionId] || {};
    const status = edit.status || 'confirmed';
    setUpdatingRedemptionId(redemptionId);
    try {
      await updateProviderRedemptionStatus(redemptionId, status, edit.notes || null);
      showToast('Redemption updated', 'success');
      const r = await getProviderRedemptions();
      setRedemptions(r.redemptions || []);
    } catch (err) {
      showToast(err.message || 'Could not update redemption', 'error');
    } finally {
      setUpdatingRedemptionId(null);
    }
  };

  const handleAward = async (customerId, points) => {
    setAwardingId(customerId);
    try {
      const res = await awardCustomerPoints(customerId, points, 'Provider appreciation award');
      showToast(`+${points} pts awarded!`, 'success');
      setCustomers(prev => prev.map(c =>
        c.user_id === customerId ? { ...c, points_balance: res.customer_new_balance } : c
      ));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAwardingId(null);
    }
  };

  // Poll stats every 10 seconds for live updates (paused while backgrounded)
  usePolling(async () => {
    try {
      const newStats = await getProviderStats(providerId);
      setStats(newStats);
    } catch (err) {
      // Silently fail — transient polling errors shouldn't disrupt the dashboard
    }
  }, 10000, Boolean(stats && providerId));

  // B4: was a raw setInterval + setTimeout pair per subscribe click.
  // usePolling standardizes the hidden-tab pause and unmount cleanup;
  // termination (success or 120s timeout) just flips subPollId back to null.
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
        <button className="btn btn-icon btn-secondary mb-16" onClick={() => navigate(-1)} aria-label="Go back"><Icon name="chevron-left" size={20} /></button>
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="chart" size={32} /></div>
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
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} id="dashboard-back-btn" aria-label="Go back">
          <Icon name="chevron-left" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.provider_name}</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Provider Dashboard</p>
        </div>
        <span className="flex items-center gap-4" style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          Live
        </span>
      </div>

      <div className="admin-subtabs mb-16" style={{ overflowX: 'auto', whiteSpace: 'nowrap', display: 'flex', gap: '8px' }}>
        <button className={`admin-subtab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`admin-subtab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>Bookings & Insights</button>
        <button className={`admin-subtab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Events</button>
        <button className={`admin-subtab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
        <button className={`admin-subtab ${tab === 'customers' ? 'active' : ''}`} onClick={() => setTab('customers')}>Customers</button>
        <button className={`admin-subtab ${tab === 'promotions' ? 'active' : ''}`} onClick={() => setTab('promotions')}>Promotions</button>
        <button className={`admin-subtab ${tab === 'subscriptions' ? 'active' : ''}`} onClick={() => { setTab('subscriptions'); track('subscription_plan_view', {}); }}>Subscriptions</button>
      </div>

      {tab === 'products' ? (
        <>
          <div className="flex justify-between items-center mb-16">
            <div>
              <p className="text-sm">Total: {products.length} | Active: {products.filter(p => p.is_active).length}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setPriceSuggestion(null); setShowCreate(true); }}>+ Create Product</button>
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
              <h3 className="section-subtitle mb-12">Redeem Management</h3>
              <p className="text-xs text-secondary mb-12">
                Confirm, ship, or mark a redemption delivered — customers see the status update.
              </p>
              {redemptions.map(r => {
                const edit = redemptionEdits[r.id] || { status: r.delivery_status, notes: r.provider_notes || '' };
                const setEdit = (patch) => setRedemptionEdits(prev => ({ ...prev, [r.id]: { ...edit, ...patch } }));
                return (
                  <div key={r.id} className="card mb-8">
                    <div className="card-body text-sm">
                      <div className="flex justify-between items-center mb-8">
                        <span>{r.user_name} → {r.redemption_code || r.product_name}</span>
                        <span className={`status-badge ${r.delivery_status}`}>{r.delivery_status}</span>
                      </div>
                      {r.delivery_address && (
                        <p className="text-xs text-secondary mb-8">Ships to: {r.delivery_address}</p>
                      )}
                      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                        <select
                          className="input"
                          style={{ padding: '4px', width: 'auto' }}
                          value={edit.status}
                          onChange={e => setEdit({ status: e.target.value })}
                          aria-label="Redemption status"
                        >
                          {REDEMPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input
                          className="input"
                          style={{ padding: '4px', flex: 1, minWidth: 120 }}
                          placeholder="Notes for customer (optional)"
                          value={edit.notes}
                          onChange={e => setEdit({ notes: e.target.value })}
                          aria-label="Notes for customer"
                          autoComplete="off"
                        />
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={updatingRedemptionId === r.id}
                          onClick={() => handleUpdateRedemption(r.id)}
                        >
                          {updatingRedemptionId === r.id ? '…' : 'Update'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {showCreate && (
            <div className="modal-overlay" onClick={() => setShowCreate(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <h3 className="card-title mb-16">Create Product</h3>
                <div className="form-stack">
                  <input className="input" placeholder="Name" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} aria-label="Product name" autoComplete="off" />
                  <select className="input" value={newProduct.type} onChange={e => setNewProduct(p => ({ ...p, type: e.target.value }))} aria-label="Product type">
                    <option value="digital">Digital</option>
                    <option value="physical">Physical</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    placeholder="Price (points)"
                    value={newProduct.price_etb}
                    onChange={e => setNewProduct(p => ({ ...p, price_etb: e.target.value }))}
                    aria-label="Price in points"
                    onFocus={() => {
                      if (priceSuggestion || !providerCategory) return;
                      getPriceSuggestion(providerCategory).then(setPriceSuggestion).catch(() => {});
                    }}
                  />
                  {priceSuggestion?.has_comparables && (
                    <button
                      type="button"
                      className="chip"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setNewProduct(p => ({ ...p, price_etb: String(priceSuggestion.median) }))}
                    >
                      {priceSuggestion.suggestion_text}
                    </button>
                  )}
                  <input className="input" type="number" inputMode="numeric" placeholder="Stock" value={newProduct.quantity_in_stock} onChange={e => setNewProduct(p => ({ ...p, quantity_in_stock: e.target.value }))} aria-label="Stock quantity" />
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      await createProviderProduct({
                        name: newProduct.name,
                        type: newProduct.type,
                        price_etb: parseInt(newProduct.price_etb, 10),
                        quantity_in_stock: parseInt(newProduct.quantity_in_stock, 10),
                      });
                      showToast('Product created', 'success');
                      setShowCreate(false);
                      const p = await getProviderProducts();
                      setProducts(p.products || []);
                    } catch (err) { showToast(err.message, 'error'); }
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
              const EditableEventItem = ({ event }) => {
                const [isEditing, setIsEditing] = useState(false);
                const [spots, setSpots] = useState(event.spots_remaining);
                const [staffId, setStaffId] = useState(event.staff_user_id || '');
                const fillPct = event.capacity ? Math.round(((event.capacity - event.spots_remaining) / event.capacity) * 100) : 0;
                const staffName = customers.find(c => c.user_id === event.staff_user_id)?.name;

                const handleSave = async () => {
                  try {
                    await updateProviderEvent(event.id, {
                      spots_remaining: parseInt(spots),
                      staff_user_id: staffId || null,
                    });
                    showToast('Inventory updated', 'success');
                    setIsEditing(false);
                    const ev = await getProviderEvents(providerId);
                    setEvents(ev.events || []);
                  } catch (err) { showToast(err.message, 'error'); }
                };

                return (
                  <div className="card mb-8">
                    <div className="card-body">
                      <h3 className="card-title text-sm">{event.service_name}</h3>
                      <p className="text-xs text-secondary">{new Date(event.starts_at).toLocaleString()} | {event.price_etb} ETB</p>
                      
                      <div className="flex justify-between items-center my-8">
                        {isEditing ? (
                          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                            <input type="number" inputMode="numeric" value={spots} onChange={e => setSpots(e.target.value)} className="input" style={{ width: '60px', padding: '4px' }} aria-label="Spots remaining" />
                            <select className="input" style={{ padding: '4px' }} value={staffId} onChange={e => setStaffId(e.target.value)} aria-label="Evidence staff">
                              <option value="">No evidence staff</option>
                              {customers.map(c => (
                                <option key={c.user_id} value={c.user_id}>{c.name}</option>
                              ))}
                            </select>
                            <button onClick={handleSave} className="btn btn-sm btn-primary">Save</button>
                            <button onClick={() => setIsEditing(false)} className="btn btn-sm btn-secondary">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-4 items-center">
                            <span className="text-sm">Spots: {spots}/{event.capacity}</span>
                            {staffName && <span className="text-xs text-secondary">· Staff: {staffName}</span>}
                            <button onClick={() => setIsEditing(true)} className="text-accent underline text-sm" style={{ background: 'none', border: 'none' }}>Edit</button>
                          </div>
                        )}
                      </div>
                      
                      <div className="admin-bar-track mb-8" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                        <div className="admin-bar-fill" style={{ width: `${fillPct}%`, height: '100%', borderRadius: 4 }} />
                      </div>
                      
                      <div className="flex gap-8 items-center mt-4">
                        {!event.is_cancelled && (
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            try {
                              await updateProviderEvent(event.id, { is_cancelled: true });
                              showToast('Event cancelled', 'success');
                              const ev = await getProviderEvents(providerId);
                              setEvents(ev.events || []);
                            } catch (err) { showToast(err.message, 'error'); }
                          }}>Cancel Session</button>
                        )}
                        <span className={`badge ${event.is_cancelled ? 'badge-muted' : 'badge-success'}`}>{event.is_cancelled ? 'Cancelled' : 'Active'}</span>
                      </div>
                    </div>
                  </div>
                );
              };
              return <EditableEventItem key={e.id} event={e} />;
            })}
          </div>

          <div className="p-16 border rounded-xl bg-accent-light mt-16 mb-24" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="font-bold text-lg mb-8" style={{ color: '#166534' }}>Boost Your Event</h3>
            <p className="text-sm mb-16" style={{ color: '#15803d' }}>Pay 50 ETB via Telebirr to pin your wellness event to the Featured carousel for 48 hours.</p>
            
            <select className="input mb-12" id="boost-event-select" aria-label="Event to boost" style={{ width: '100%' }}>
              <option value="">Select an upcoming event...</option>
              {events.filter(e => !e.is_cancelled).map(ev => <option key={ev.id} value={ev.id}>{ev.service_name}</option>)}
            </select>
            
            <button 
              className="btn btn-primary w-full"
              onClick={async () => {
                const sel = document.getElementById('boost-event-select');
                if (!sel.value) return;
                try {
                  // Mock payment simulation targeting provider_promotions
                  showToast('Processing Telebirr...');
                  await new Promise(r => setTimeout(r, 1000));
                  showToast('Payment successful! Event pinned to consumer Explore feed.', 'success');
                } catch (e) {
                  showToast('Error boosting event', 'error');
                }
              }}
            >
              Pay 50 ETB & Boost
            </button>
          </div>
          {showCreateEvent && (
            <div className="modal-overlay" onClick={() => setShowCreateEvent(false)}>
              <div className="modal-card" onClick={ev => ev.stopPropagation()}>
                <h3 className="card-title mb-16">Create Event</h3>
                <div className="form-stack">
                  <input className="input" placeholder="Service Name" value={newEvent.service_name} onChange={e => setNewEvent(p => ({ ...p, service_name: e.target.value }))} aria-label="Service name" autoComplete="off" />
                  <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} aria-label="Description" autoComplete="off" />
                  <input className="input" type="datetime-local" placeholder="Starts At" value={newEvent.starts_at} onChange={e => setNewEvent(p => ({ ...p, starts_at: e.target.value }))} aria-label="Starts at" />
                  <input className="input" type="datetime-local" placeholder="Ends At" value={newEvent.ends_at} onChange={e => setNewEvent(p => ({ ...p, ends_at: e.target.value }))} aria-label="Ends at" />
                  <input className="input" type="number" inputMode="numeric" placeholder="Capacity" value={newEvent.capacity} onChange={e => setNewEvent(p => ({ ...p, capacity: parseInt(e.target.value, 10) }))} aria-label="Capacity" />
                  <input className="input" type="number" inputMode="numeric" placeholder="Price (ETB)" value={newEvent.price_etb} onChange={e => setNewEvent(p => ({ ...p, price_etb: parseInt(e.target.value, 10) }))} aria-label="Price in ETB" />
                  <select className="input" value={newEvent.staff_user_id} onChange={e => setNewEvent(p => ({ ...p, staff_user_id: e.target.value }))} aria-label="Evidence staff">
                    <option value="">Designate evidence staff (optional)</option>
                    {customers.map(c => (
                      <option key={c.user_id} value={c.user_id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-secondary" style={{ marginTop: -8 }}>
                    Staff can submit photo evidence via /evidence in the bot after this event ends, to award attendees points.
                  </p>
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      await createProviderEvent({
                        service_name: newEvent.service_name,
                        description: newEvent.description,
                        starts_at: new Date(newEvent.starts_at).toISOString(),
                        ends_at: new Date(newEvent.ends_at).toISOString(),
                        capacity: newEvent.capacity,
                        price_etb: newEvent.price_etb,
                        staff_user_id: newEvent.staff_user_id || null,
                      });
                      showToast('Event created', 'success');
                      setShowCreateEvent(false);
                      const ev = await getProviderEvents(providerId);
                      setEvents(ev.events || []);
                    } catch (err) { showToast(err.message, 'error'); }
                  }}>Create</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : tab === 'customers' ? (
        <>
          <p className="text-sm mb-16">
            {customers.length} customer{customers.length === 1 ? '' : 's'} with a booking or check-in at your business.
            {' '}Award up to 50 pts, once per customer per day, {PROVIDER_DAILY_AWARD_CAP} pts/day total.
          </p>
          <div className="flex-col gap-8">
            {customers.map(c => (
              <div key={c.user_id} className="card">
                <div className="card-body flex items-center gap-12">
                  <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#ccc', flexShrink: 0 }}>
                    <SmartImage
                      src={c.photo_url}
                      width={36}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      fallback={<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="user" size={16} /></span>}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Last visit: {c.last_visit ? new Date(c.last_visit).toLocaleDateString() : '—'} · {c.lifetime_points_redeemed} pts redeemed here
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={awardingId === c.user_id}
                    onClick={() => handleAward(c.user_id, 25)}
                  >
                    {awardingId === c.user_id ? '…' : <span className="inline-icon-text"><Icon name="coins" size={13} /> +25 pts</span>}
                  </button>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon"><Icon name="users" size={32} /></div>
                <div className="empty-state-text">No customers yet — bookings and community check-ins will show up here.</div>
              </div>
            )}
          </div>
        </>
      ) : tab === 'promotions' ? (
        <>
          <div className="section-header">
            <h2 className="section-title">Presale & Promotions</h2>
          </div>
          <p className="text-sm mb-12" style={{ color: 'var(--text-secondary)' }}>
            Active promotions show on your Explore card and provider page. Presale
            discounts are applied automatically when an eligible guest books.
          </p>
          <PromotionForm />
        </>
      ) : tab === 'subscriptions' ? (
        <>
          <div className="section-header">
            <h2 className="section-title">Subscription Plans</h2>
          </div>
          <div className="flex-col gap-12 mb-24">
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
                style={selectedPlan === planId ? { border: '2px solid var(--brand-primary)' } : {}}
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
            <div className="card" style={{ padding: '16px' }}>
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
                    if (res.to_pay_url && window.Telegram?.WebApp?.openLink) {
                      window.Telegram.WebApp.openLink(res.to_pay_url);
                    } else if (res.to_pay_url) {
                      window.open(res.to_pay_url, '_blank');
                    }
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
        </>
      ) : tab === 'bookings' ? (
        <>
          <div className="section-header">
            <h2 className="section-title">Bookings & Insights</h2>
          </div>

          <div className="card mb-16">
            <div className="card-body">
              <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
                <label className="text-xs text-secondary">From
                  <input type="date" className="input" style={{ padding: '4px', marginLeft: 6 }}
                    value={bookingsStartDate} onChange={e => setBookingsStartDate(e.target.value)} />
                </label>
                <label className="text-xs text-secondary">To
                  <input type="date" className="input" style={{ padding: '4px', marginLeft: 6 }}
                    value={bookingsEndDate} onChange={e => setBookingsEndDate(e.target.value)} />
                </label>
                <select className="input" style={{ padding: '4px', width: 'auto' }}
                  value={bookingsStatus} onChange={e => setBookingsStatus(e.target.value)} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
                <button className="btn btn-primary btn-sm" disabled={bookingsLoading} onClick={() => loadBookingsTab(1)}>
                  {bookingsLoading ? '…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          {/* Most booked service */}
          {serviceBreakdown.length > 0 && (
            <>
              <h3 className="section-subtitle mb-12">Most Booked Service</h3>
              <div className="card mb-24">
                <div className="card-body flex-col gap-8">
                  {serviceBreakdown.map(s => {
                    const maxCount = Math.max(1, ...serviceBreakdown.map(x => x.bookings_count));
                    const pct = Math.round((s.bookings_count / maxCount) * 100);
                    return (
                      <div key={s.service_name}>
                        <div className="flex justify-between items-center mb-4" style={{ fontSize: '0.75rem' }}>
                          <span>{s.service_name}</span>
                          <span style={{ fontWeight: 600 }}>{s.bookings_count} bookings · ETB {s.revenue_etb.toLocaleString()}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Customer demographics */}
          {demographics && demographics.total_customers > 0 && (
            <>
              <h3 className="section-subtitle mb-12">Customer Demographics ({demographics.total_customers})</h3>
              <div className="kpi-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {[
                  { title: 'Neighborhood', buckets: demographics.by_neighborhood },
                  { title: 'Interests', buckets: demographics.by_interest_category },
                  { title: 'Exercise Frequency', buckets: demographics.by_exercise_frequency },
                ].map(group => (
                  <div key={group.title} className="card">
                    <div className="card-body">
                      <h4 className="text-xs text-secondary mb-8">{group.title}</h4>
                      {group.buckets.length === 0 ? (
                        <p className="text-xs text-secondary">No data yet</p>
                      ) : group.buckets.map(b => (
                        <div key={b.label} className="flex justify-between text-xs mb-4">
                          <span>{b.label}</span>
                          <span style={{ fontWeight: 600 }}>{b.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Community (circle) activity */}
          {stats.communities?.length > 0 && (
            <>
              <h3 className="section-subtitle mb-12">Community Activity</h3>
              <div className="flex-col gap-8 mb-24">
                {stats.communities.map(c => (
                  <div key={c.id} className="card">
                    <div className="card-body flex justify-between items-center">
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.name}</div>
                      <div className="flex items-center gap-4" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        <Icon name="users" size={12} /> {c.member_count} · <Icon name="check" size={12} /> {c.checkins_today} check-ins today · {Math.round(c.engagement_rate * 100)}% engagement
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Booking list */}
          <div className="section-header">
            <h2 className="section-title">Booking List ({bookingsTotal})</h2>
          </div>
          {bookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="calendar" size={32} /></div>
              <div className="empty-state-text">No bookings match these filters.</div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Demographics</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(bk => (
                    <tr key={bk.id}>
                      <td>{bk.user_name || `@${bk.user_handle}`}</td>
                      <td>{bk.service_name}</td>
                      <td style={{ fontWeight: 600 }}>ETB {bk.amount_etb?.toLocaleString()}</td>
                      <td><span className={`status-badge ${bk.payment_status}`}>{bk.payment_status}</span></td>
                      <td className="text-xs text-secondary">
                        {bk.customer_demographics?.location_neighborhood || '—'}
                        {bk.customer_demographics?.exercise_frequency ? ` · ${bk.customer_demographics.exercise_frequency}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bookingsTotal > 20 && (
            <div className="flex justify-between items-center mt-12">
              <button className="btn btn-secondary btn-sm" disabled={bookingsPage <= 1 || bookingsLoading}
                onClick={() => loadBookingsTab(bookingsPage - 1)}>Previous</button>
              <span className="text-xs text-secondary">Page {bookingsPage}</span>
              <button className="btn btn-secondary btn-sm" disabled={bookingsPage * 20 >= bookingsTotal || bookingsLoading}
                onClick={() => loadBookingsTab(bookingsPage + 1)}>Next</button>
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

      {/* Custom time metrics — provider-chosen date range */}
      <div className="section-header">
        <h2 className="section-title">Custom Time Metrics</h2>
      </div>
      <div className="card mb-24">
        <div className="card-body">
          <div className="flex gap-8 items-center mb-16" style={{ flexWrap: 'wrap' }}>
            {[
              { label: '7d', days: 6 },
              { label: '30d', days: 29 },
              { label: '90d', days: 89 },
            ].map(preset => (
              <button key={preset.label} className="chip" onClick={() => {
                setMetricsStartDate(isoDateDaysAgo(preset.days));
                setMetricsEndDate(todayIsoDate());
              }}>{preset.label}</button>
            ))}
            <label className="text-xs text-secondary">From
              <input type="date" className="input" style={{ padding: '4px', marginLeft: 6 }}
                value={metricsStartDate} onChange={e => setMetricsStartDate(e.target.value)} />
            </label>
            <label className="text-xs text-secondary">To
              <input type="date" className="input" style={{ padding: '4px', marginLeft: 6 }}
                value={metricsEndDate} onChange={e => setMetricsEndDate(e.target.value)} />
            </label>
            <button className="btn btn-primary btn-sm" disabled={timeseriesLoading} onClick={loadTimeseries}>
              {timeseriesLoading ? '…' : 'Apply'}
            </button>
          </div>

          {timeseries && (
            <>
              <div className="kpi-grid mb-16">
                <div className="kpi-card">
                  <div className="kpi-value">{timeseries.totals.bookings}</div>
                  <div className="kpi-label">Bookings</div>
                </div>
                <div className="kpi-card accent">
                  <div className="kpi-value">{timeseries.totals.revenue_etb.toLocaleString()}</div>
                  <div className="kpi-label">Revenue (ETB)</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-value">{timeseries.totals.checkins}</div>
                  <div className="kpi-label">Check-ins</div>
                </div>
                <div className="kpi-card secondary">
                  <div className="kpi-value">{timeseries.totals.unique_customers}</div>
                  <div className="kpi-label">Unique Customers</div>
                </div>
              </div>
              <div className="flex-col gap-4" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {timeseries.series.map(d => (
                  <div key={d.date} className="flex justify-between text-xs" style={{ padding: '4px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                    <span>{d.date}</span>
                    <span>{d.bookings} bookings · ETB {d.revenue_etb.toLocaleString()} · {d.checkins} check-ins</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* C5: Points redeemed — payout predictability */}
      {pointsAnalytics?.weekly_trend?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Points Redeemed at Your Business</h2>
          </div>
          <div className="card mb-24">
            <div className="card-body">
              <div className="flex-col gap-8">
                {pointsAnalytics.weekly_trend.map(w => {
                  const maxRedeemed = Math.max(1, ...pointsAnalytics.weekly_trend.map(x => x.points_redeemed));
                  const pct = Math.round((w.points_redeemed / maxRedeemed) * 100);
                  return (
                    <div key={w.week_label}>
                      <div className="flex justify-between items-center mb-4" style={{ fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{w.week_label}</span>
                        <span style={{ fontWeight: 600 }}>{w.points_redeemed} pts · {w.unique_visits} visits</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-secondary mt-12">
                Points redeemed here roughly track customer visits — a steady trend means members see this membership as worth keeping.
              </p>
            </div>
          </div>
        </>
      )}

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
                      <div className="flex items-center gap-4" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        <Icon name="users" size={12} /> {c.member_count} · <Icon name="check" size={12} /> {c.checkins_today} check-ins · {Math.round(c.engagement_rate * 100)}% engagement
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
                  <input className="input" placeholder="Title" value={newChallenge.title} onChange={e => setNewChallenge(p => ({ ...p, title: e.target.value }))} aria-label="Challenge title" autoComplete="off" />
                  <input className="input" placeholder="Description" value={newChallenge.description} onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))} aria-label="Description" autoComplete="off" />
                  <input className="input" type="number" inputMode="numeric" placeholder="Points Reward" value={newChallenge.points_reward} onChange={e => setNewChallenge(p => ({ ...p, points_reward: parseInt(e.target.value, 10) }))} aria-label="Points reward" />
                  <input className="input" type="number" inputMode="numeric" placeholder="Target Check-ins" value={newChallenge.target_checkins} onChange={e => setNewChallenge(p => ({ ...p, target_checkins: parseInt(e.target.value, 10) }))} aria-label="Target check-ins" />
                  <input className="input" type="datetime-local" placeholder="Starts At" value={newChallenge.starts_at} onChange={e => setNewChallenge(p => ({ ...p, starts_at: e.target.value }))} aria-label="Starts at" />
                  <input className="input" type="datetime-local" placeholder="Ends At" value={newChallenge.ends_at} onChange={e => setNewChallenge(p => ({ ...p, ends_at: e.target.value }))} aria-label="Ends at" />
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
                      showToast('Challenge created', 'success');
                      setShowCreateChallenge(null);
                    } catch (err) { showToast(err.message, 'error'); }
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
            <span className="flex items-center gap-4" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Real-time
            </span>
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
