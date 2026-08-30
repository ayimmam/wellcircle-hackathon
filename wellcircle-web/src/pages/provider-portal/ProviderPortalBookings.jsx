import { useState, useEffect } from 'react';
import { useProviderPortalData } from '../../context/ProviderPortalDataContext';
import { getProviderBookings, getProviderServiceBreakdown, getProviderDemographics } from '../../api/client';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icon';

export default function ProviderPortalBookings() {
  const { providerId, stats } = useProviderPortalData();

  const [bookings, setBookings] = useState([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsStatus, setBookingsStatus] = useState('');
  const [bookingsStartDate, setBookingsStartDate] = useState('');
  const [bookingsEndDate, setBookingsEndDate] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [serviceBreakdown, setServiceBreakdown] = useState([]);
  const [demographics, setDemographics] = useState(null);

  const load = async (page = 1) => {
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
    if (providerId) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  return (
    <div id="provider-portal-bookings">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Bookings & Insights</h1>
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
              value={bookingsStatus} onChange={e => setBookingsStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <button className="btn btn-primary btn-sm" disabled={bookingsLoading} onClick={() => load(1)}>
              {bookingsLoading ? '…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      <div className="portal-grid-2">
        {/* Most booked service */}
        {serviceBreakdown.length > 0 && (
          <div>
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
          </div>
        )}

        {/* Community activity */}
        {stats.communities?.length > 0 && (
          <div>
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
          </div>
        )}
      </div>

      {/* Customer demographics */}
      {demographics && demographics.total_customers > 0 && (
        <>
          <h3 className="section-subtitle mb-12">Customer Demographics ({demographics.total_customers})</h3>
          <div className="portal-grid-3 mb-24">
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
            onClick={() => load(bookingsPage - 1)}>Previous</button>
          <span className="text-xs text-secondary">Page {bookingsPage}</span>
          <button className="btn btn-secondary btn-sm" disabled={bookingsPage * 20 >= bookingsTotal || bookingsLoading}
            onClick={() => load(bookingsPage + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
