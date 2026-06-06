import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviderStats } from '../api/client';
import FeedEvent from '../components/FeedEvent';

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use Shanti Yoga Addis as the demo provider
  const providerId = '11111111-0000-0000-0000-000000000003';

  useEffect(() => {
    setLoading(true);
    getProviderStats(providerId)
      .then(setStats)
      .finally(() => setLoading(false));
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
    </div>
  );
}
