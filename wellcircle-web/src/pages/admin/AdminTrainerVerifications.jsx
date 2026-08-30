import { useEffect, useState } from 'react';
import { getAdminTrainerVerifications, reviewTrainerVerification } from '../../api/client';
import { showToast } from '../../components/Toast';
import SmartImage from '../../components/SmartImage';

export default function AdminTrainerVerifications() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getAdminTrainerVerifications(1, status);
      setItems(result.items || result.verifications || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [status]);

  const review = async (item, action) => {
    const reason = reasons[item.id]?.trim();
    if (action === 'reject' && !reason) {
      showToast('Add a rejection reason', 'error');
      return;
    }
    try {
      await reviewTrainerVerification(item.id, action, reason);
      showToast(`Trainer ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
      setItems(current => current.filter(entry => entry.id !== item.id));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div id="admin-trainer-verifications">
      <div className="admin-subtabs mb-16">
        {['pending', 'approved', 'rejected', 'all'].map(value => <button key={value} className={`admin-subtab ${status === value ? 'active' : ''}`} onClick={() => setStatus(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      {loading ? <div className="skeleton" style={{ height: 200 }} /> : items.length === 0 ? <div className="empty-state">No trainer applications found.</div> : (
        <div className="admin-card-list">
          {items.map(item => (
            <article className="card" key={item.id}>
              <div className="card-body">
                <div className="flex items-center gap-12 mb-12">
                  <div className="avatar avatar-lg"><SmartImage src={item.user_photo_url} width={40} /></div>
                  <div>
                    <h2 className="card-title">{item.user_name || `Applicant ${String(item.user_id).slice(0, 8)}`}</h2>
                    {item.user_handle && <p className="text-sm text-secondary">@{item.user_handle}</p>}
                  </div>
                </div>
                <div className="document-links">
                  <a className="btn btn-secondary btn-sm" href={item.certificate_url} target="_blank" rel="noreferrer">View certificate</a>
                  <a className="btn btn-secondary btn-sm" href={item.payment_receipt_url} target="_blank" rel="noreferrer">View receipt</a>
                </div>
                {item.status === 'pending' && (
                  <>
                    <textarea className="input mt-12" placeholder="Rejection reason (required to reject)" value={reasons[item.id] || ''} onChange={event => setReasons(current => ({ ...current, [item.id]: event.target.value }))} />
                    <div className="flex gap-8 mt-12">
                      <button className="btn btn-primary btn-sm" onClick={() => review(item, 'approve')}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => review(item, 'reject')}>Reject</button>
                    </div>
                  </>
                )}
                {item.status === 'rejected' && (
                  <p className="text-sm text-secondary mt-12">
                    Rejection reason: {item.rejection_reason || 'No reason recorded'}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
