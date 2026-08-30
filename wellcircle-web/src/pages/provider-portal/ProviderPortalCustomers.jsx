import { useState, useEffect } from 'react';
import { getProviderCustomers, awardCustomerPoints } from '../../api/client';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import SmartImage from '../../components/SmartImage';

const PROVIDER_DAILY_AWARD_CAP = 300; // mirrors backend PROVIDER_AWARD_MAX_POINTS_PER_DAY

export default function ProviderPortalCustomers() {
  const [customers, setCustomers] = useState([]);
  const [awardingId, setAwardingId] = useState(null);

  useEffect(() => {
    getProviderCustomers()
      .then(cu => setCustomers(cu.customers || []))
      .catch(err => showToast(err.message || 'Could not load customers', 'error'));
  }, []);

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

  return (
    <div id="provider-portal-customers">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Customers</h1>
      </div>
      <p className="text-sm mb-16">
        {customers.length} customer{customers.length === 1 ? '' : 's'} with a booking or check-in at your business.
        {' '}Award up to 50 pts, once per customer per day, {PROVIDER_DAILY_AWARD_CAP} pts/day total.
      </p>
      <div className="portal-grid-3">
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
    </div>
  );
}
