import { useEffect, useState } from 'react';
import { getAdminPaidCircleApplications, reviewPaidCircleApplication } from '../../api/client';
import { showToast } from '../../components/Toast';
import VerifiedBadge from '../../components/VerifiedBadge';

export default function AdminPaidCircles() {
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminPaidCircleApplications()
      .then(result => setItems(result.applications || result.circles || []))
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const review = async (circle, action) => {
    const reason = reasons[circle.id]?.trim();
    if (action === 'reject' && !reason) {
      showToast('Add a rejection reason', 'error');
      return;
    }
    try {
      await reviewPaidCircleApplication(circle.id, action, reason);
      setItems(current => current.filter(item => item.id !== circle.id));
      showToast(`Paid circle ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 200 }} />;
  if (!items.length) return <div className="empty-state">No paid-circle applications.</div>;

  return (
    <div className="admin-card-list" id="admin-paid-circles">
      {items.map(circle => (
        <article className="card" key={circle.id}>
          <div className="card-body">
            <div className="flex justify-between items-start gap-12">
              <div>
                <h2 className="card-title">{circle.name}</h2>
                <p className="text-sm text-secondary">{circle.member_count} members · ETB {circle.price_etb}/month</p>
              </div>
              <span className="badge badge-muted">Pending</span>
            </div>
            <p className="text-sm mt-12">
              Owner: {circle.owner_name || `User ${String(circle.owner_id).slice(0, 8)}`}
              {circle.owner_telegram_handle && ` @${circle.owner_telegram_handle}`}{' '}
              {circle.owner_is_verified && <VerifiedBadge compact />}
            </p>
            <p className="text-sm">Owner lifetime points: <strong>{circle.owner_lifetime_points || 0}</strong></p>
            <textarea className="input mt-12" placeholder="Rejection reason (required to reject)" value={reasons[circle.id] || ''} onChange={event => setReasons(current => ({ ...current, [circle.id]: event.target.value }))} aria-label={`Rejection reason for ${circle.name}`} />
            <div className="flex gap-8 mt-12">
              <button className="btn btn-primary btn-sm" onClick={() => review(circle, 'approve')}>Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => review(circle, 'reject')}>Reject</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
