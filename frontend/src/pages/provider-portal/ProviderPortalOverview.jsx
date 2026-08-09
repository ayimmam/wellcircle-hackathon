import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderPortalData } from '../../context/ProviderPortalDataContext';
import { getProviderPointsAnalytics, getProviderMetricsTimeseries, getProviderMe, updateProviderMe } from '../../api/client';
import { showToast } from '../../components/Toast';
import FeedEvent from '../../components/FeedEvent';
import Icon from '../../components/Icon';

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// Home dashboard — summary metrics. Each KPI tile is clickable and drills
// into the detail page that actually explains that number.
export default function ProviderPortalOverview() {
  const { stats, refreshStats } = useProviderPortalData();
  const navigate = useNavigate();

  const [pointsAnalytics, setPointsAnalytics] = useState(null);
  const [metricsStartDate, setMetricsStartDate] = useState(isoDateDaysAgo(6));
  const [metricsEndDate, setMetricsEndDate] = useState(todayIsoDate());
  const [timeseries, setTimeseries] = useState(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  // Getting-there tips + on-site facilities (Phase 8) — shown in
  // ProviderDetail.jsx's "Getting there" section once at least one exists.
  const [navigationTips, setNavigationTips] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    getProviderPointsAnalytics().then(setPointsAnalytics).catch(() => {});
    getProviderMe().then(p => {
      setNavigationTips(p.navigation_tips || []);
      setFacilities(p.facilities || []);
    }).catch(() => {});
  }, []);

  const addTip = () => setNavigationTips(prev => [...prev, { title: '', detail: '' }]);
  const updateTip = (i, field, value) => setNavigationTips(prev =>
    prev.map((tip, idx) => idx === i ? { ...tip, [field]: value } : tip));
  const removeTip = (i) => setNavigationTips(prev => prev.filter((_, idx) => idx !== i));

  const addFacility = () => setFacilities(prev => [...prev, '']);
  const updateFacility = (i, value) => setFacilities(prev => prev.map((f, idx) => idx === i ? value : f));
  const removeFacility = (i) => setFacilities(prev => prev.filter((_, idx) => idx !== i));

  const saveProfileExtras = async () => {
    setSavingProfile(true);
    try {
      const cleanTips = navigationTips.filter(t => t.title.trim() && t.detail.trim());
      const cleanFacilities = facilities.filter(f => f.trim());
      await updateProviderMe({ navigation_tips: cleanTips, facilities: cleanFacilities });
      setNavigationTips(cleanTips);
      setFacilities(cleanFacilities);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

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
    loadTimeseries();
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id="provider-portal-overview">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Overview</h1>
        <span className="flex items-center gap-4" style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          Live
        </span>
      </div>

      {/* KPI cards — click through to the detail page */}
      <div className="portal-kpi-grid">
        <button className="kpi-card portal-kpi-card accent" onClick={() => navigate('/provider-portal/customers')}>
          <div className="kpi-value">{stats.stats.total_members}</div>
          <div className="kpi-label">Total Members</div>
        </button>
        <button className="kpi-card portal-kpi-card" onClick={() => navigate('/provider-portal/customers')}>
          <div className="kpi-value" style={{ color: 'var(--info)' }}>{stats.stats.new_members_today}</div>
          <div className="kpi-label">New Today</div>
        </button>
        <button className="kpi-card portal-kpi-card secondary" onClick={() => navigate('/provider-portal/bookings')}>
          <div className="kpi-value">{stats.stats.bookings_this_week}</div>
          <div className="kpi-label">Bookings (Week)</div>
        </button>
        <button className="kpi-card portal-kpi-card" onClick={() => navigate('/provider-portal/bookings')}>
          <div className="kpi-value" style={{ color: 'var(--accent-light)' }}>
            {(stats.stats.estimated_revenue_etb || 0).toLocaleString()}
          </div>
          <div className="kpi-label">Revenue (ETB)</div>
        </button>
        <button className="kpi-card portal-kpi-card" onClick={() => navigate('/provider-portal/bookings')}>
          <div className="kpi-value">{stats.stats.checkins_today}</div>
          <div className="kpi-label">Check-ins Today</div>
        </button>
        <button className="kpi-card portal-kpi-card" onClick={() => navigate('/provider-portal/bookings')}>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{Math.round((stats.stats.engagement_rate || 0) * 100)}%</div>
          <div className="kpi-label">Engagement Rate</div>
        </button>
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
              <div className="portal-kpi-grid" style={{ marginBottom: 16 }}>
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
                  <div key={d.date} className="flex justify-between text-xs" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span>{d.date}</span>
                    <span>{d.bookings} bookings · ETB {d.revenue_etb.toLocaleString()} · {d.checkins} check-ins</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="portal-grid-2">
        {/* Points redeemed — payout predictability */}
        {pointsAnalytics?.weekly_trend?.length > 0 && (
          <div>
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
              </div>
            </div>
          </div>
        )}

        {/* Live activity feed */}
        {stats.recent_feed?.length > 0 && (
          <div>
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
          </div>
        )}
      </div>

      {/* Recent bookings preview */}
      {stats.recent_bookings?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Recent Bookings</h2>
            <button className="text-accent underline text-sm" style={{ background: 'none', border: 'none' }} onClick={() => navigate('/provider-portal/bookings')}>
              View all →
            </button>
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
                {stats.recent_bookings.slice(0, 5).map(bk => (
                  <tr key={bk.id}>
                    <td>@{bk.user_handle}</td>
                    <td>{bk.service_name}</td>
                    <td style={{ fontWeight: 600 }}>ETB {bk.amount_etb?.toLocaleString()}</td>
                    <td><span className={`status-badge ${bk.payment_status}`}>{bk.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Getting there + facilities (Phase 8) — rendered on ProviderDetail.jsx
          only when non-empty, so an untouched provider shows no empty section. */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <h2 className="section-title">Getting There & Facilities</h2>
      </div>
      <div className="card mb-24">
        <div className="card-body">
          <p className="text-sm text-secondary mb-16">
            Orientation tips (location, parking, "ask for the 2nd floor") and
            on-site facilities shown on your public profile.
          </p>

          <strong className="text-sm">Navigation tips</strong>
          <div className="flex-col gap-8 mt-8 mb-12">
            {navigationTips.map((tip, i) => (
              <div key={i} className="flex gap-8 items-center">
                <input
                  className="input"
                  placeholder="Title (e.g. Parking)"
                  style={{ flex: 1 }}
                  value={tip.title}
                  onChange={e => updateTip(i, 'title', e.target.value)}
                  id={`nav-tip-title-${i}`}
                />
                <input
                  className="input"
                  placeholder="Detail"
                  style={{ flex: 2 }}
                  value={tip.detail}
                  onChange={e => updateTip(i, 'detail', e.target.value)}
                  id={`nav-tip-detail-${i}`}
                />
                <button className="btn btn-icon btn-secondary" onClick={() => removeTip(i)} aria-label="Remove tip" id={`nav-tip-remove-${i}`}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addTip} id="add-nav-tip-btn" style={{ alignSelf: 'flex-start' }}>
              + Add tip
            </button>
          </div>

          <strong className="text-sm">Facilities</strong>
          <div className="flex-col gap-8 mt-8 mb-16">
            {facilities.map((facility, i) => (
              <div key={i} className="flex gap-8 items-center">
                <input
                  className="input"
                  placeholder="e.g. Free parking"
                  style={{ flex: 1 }}
                  value={facility}
                  onChange={e => updateFacility(i, e.target.value)}
                  id={`facility-${i}`}
                />
                <button className="btn btn-icon btn-secondary" onClick={() => removeFacility(i)} aria-label="Remove facility" id={`facility-remove-${i}`}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addFacility} id="add-facility-btn" style={{ alignSelf: 'flex-start' }}>
              + Add facility
            </button>
          </div>

          <button className="btn btn-primary btn-sm" onClick={saveProfileExtras} disabled={savingProfile} id="save-profile-extras-btn">
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
