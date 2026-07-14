import { showToast } from '../../components/Toast';
import { getAdminUsers, getAdminProviders, getAdminBookings, getAdminRedemptions } from '../../api/client';

const REPORTS = [
  { id: 'users', title: 'Export Users CSV', desc: 'All users with activity data' },
  { id: 'providers', title: 'Export Providers CSV', desc: 'Provider list with metrics' },
  { id: 'bookings', title: 'Export Bookings CSV', desc: 'All bookings with payments' },
  { id: 'redemptions', title: 'Export Redemptions CSV', desc: 'Product redemption history' },
  { id: 'pdf', title: 'Generate PDF Report', desc: 'Monthly platform summary' },
];

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const handleExport = async (id) => {
    if (id === 'pdf') {
      showToast('PDF report generation coming soon', '📄');
      return;
    }

    try {
      if (id === 'users') {
        const res = await getAdminUsers({ per_page: 500 });
        downloadCsv(
          'wellcircle-users.csv',
          ['id', 'telegram_id', 'name', 'interest_categories', 'points_balance', 'is_onboarded', 'created_at'],
          (res.users || []).map(u => [u.id, u.telegram_id, u.name, (u.interest_categories || []).join('|'), u.points_balance, u.is_onboarded, u.created_at]),
        );
      } else if (id === 'providers') {
        const res = await getAdminProviders();
        downloadCsv(
          'wellcircle-providers.csv',
          ['id', 'name', 'category', 'status', 'location_text', 'member_count'],
          (res.providers || []).map(p => [p.id, p.name, p.category, p.status, p.location_text, p.member_count]),
        );
      } else if (id === 'bookings') {
        const res = await getAdminBookings({ per_page: 500 });
        downloadCsv(
          'wellcircle-bookings.csv',
          ['id', 'user_name', 'provider_name', 'service_name', 'amount_etb', 'payment_method', 'payment_status', 'slot_datetime', 'created_at'],
          (res.bookings || []).map(b => [b.id, b.user_name, b.provider_name, b.service_name, b.amount_etb, b.payment_method, b.payment_status, b.slot_datetime, b.created_at]),
        );
      } else if (id === 'redemptions') {
        const res = await getAdminRedemptions({ per_page: 500 });
        downloadCsv(
          'wellcircle-redemptions.csv',
          ['id', 'user_name', 'product_name', 'provider_name', 'points_spent', 'type', 'delivery_status', 'redemption_code', 'redeemed_at'],
          (res.redemptions || []).map(r => [r.id, r.user_name, r.product_name, r.provider_name, r.points_spent, r.type, r.delivery_status, r.redemption_code, r.redeemed_at]),
        );
      }
      showToast(`${id} CSV downloaded`, '✅');
    } catch (err) {
      showToast(err.message || 'Export failed', '❌');
    }
  };

  return (
    <div>
      <h2 className="section-title">Reports & Exports</h2>
      <div className="admin-card-list">
        {REPORTS.map(r => (
          <button key={r.id} className="card admin-report-card" onClick={() => handleExport(r.id)}>
            <div className="card-body text-left">
              <h3 className="card-title">{r.title}</h3>
              <p className="text-sm text-secondary">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
