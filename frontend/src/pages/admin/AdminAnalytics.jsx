import { useState, useEffect } from 'react';
import { getAdminAnalytics } from '../../api/client';
import { showToast } from '../../components/Toast';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getAdminAnalytics());
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Users', data.total_users],
      ['Active 7d', data.active_users_7d],
      ['Providers', data.total_providers],
      ['Communities', data.total_communities],
      ['Bookings', data.total_bookings],
      ['Revenue ETB', data.total_revenue_etb],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wellcircle-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  };

  if (loading || !data) {
    return <div className="skeleton" style={{ height: 300 }} />;
  }

  const maxCat = Math.max(...data.top_categories.map(c => c.count), 1);

  return (
    <div>
      <h2 className="section-title">Analytics Dashboard</h2>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-value">{data.total_users}</div><div className="kpi-label">Total Users</div></div>
        <div className="kpi-card accent"><div className="kpi-value">{data.active_users_7d}</div><div className="kpi-label">Active 7d</div></div>
        <div className="kpi-card secondary"><div className="kpi-value">{data.total_providers}</div><div className="kpi-label">Providers</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.total_communities}</div><div className="kpi-label">Communities</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.total_bookings}</div><div className="kpi-label">Bookings</div></div>
        <div className="kpi-card accent"><div className="kpi-value">{Number(data.total_revenue_etb).toLocaleString()}</div><div className="kpi-label">Revenue (ETB)</div></div>
      </div>

      <div className="card mt-16">
        <div className="card-body">
          <h3 className="card-title mb-12">Top Categories</h3>
          {data.top_categories.map(c => (
            <div key={c.category} className="admin-bar-row">
              <span className="admin-bar-label">{c.category}</span>
              <div className="admin-bar-track">
                <div className="admin-bar-fill" style={{ width: `${(c.count / maxCat) * 100}%` }} />
              </div>
              <span className="admin-bar-count">{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-12 mt-16">
        <button className="btn btn-primary" onClick={load}>Refresh</button>
        <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>
      </div>
    </div>
  );
}
