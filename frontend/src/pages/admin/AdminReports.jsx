import { showToast } from '../../components/Toast';

const REPORTS = [
  { id: 'users', title: 'Export Users CSV', desc: 'All users with activity data' },
  { id: 'providers', title: 'Export Providers CSV', desc: 'Provider list with metrics' },
  { id: 'bookings', title: 'Export Bookings CSV', desc: 'All bookings with payments' },
  { id: 'redemptions', title: 'Export Redemptions CSV', desc: 'Product redemption history' },
  { id: 'pdf', title: 'Generate PDF Report', desc: 'Monthly platform summary' },
];

export default function AdminReports() {
  const handleExport = (id) => {
    if (id === 'pdf') {
      showToast('PDF report generation coming soon', '📄');
      return;
    }
    const csv = `id,name,status\n1,Sample,active\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellcircle-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${id} CSV downloaded`, '✅');
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
