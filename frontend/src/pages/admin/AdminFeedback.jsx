import { useState, useEffect } from 'react';
import { getAdminFeedback, updateFeedbackStatus } from '../../api/client';
import { showToast } from '../../components/Toast';

const TYPES = ['bug', 'health_app_request', 'suggestion'];
const STATUSES = ['new', 'reviewed', 'resolved'];
const TYPE_LABELS = { bug: 'Bug', health_app_request: 'Health App', suggestion: 'Suggestion' };

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAdminFeedback({ type: type || undefined });
      setItems(res.items || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  const handleStatusChange = async (id, status) => {
    try {
      await updateFeedbackStatus(id, status);
      setItems(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      showToast('Status updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <h2 className="section-title">Feedback</h2>
      <div className="filter-chips mb-16">
        <button className={`chip ${type === '' ? 'active' : ''}`} onClick={() => setType('')}>All</button>
        {TYPES.map(t => (
          <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <p className="text-secondary">No feedback yet.</p>
      ) : (
        <div className="admin-card-list">
          {items.map(f => (
            <div key={f.id} className="card" id={`feedback-item-${f.id}`}>
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <span className="badge badge-muted">{TYPE_LABELS[f.type] || f.type}</span>
                  <span className="text-sm text-secondary">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-8">{f.message}</p>
                <p className="text-sm text-secondary mt-8">
                  {f.user_name || 'Unknown user'}{f.user_handle ? ` (@${f.user_handle})` : ''}
                  {f.context?.route ? ` · ${f.context.route}` : ''}
                </p>
                <select
                  className="input mt-12"
                  value={f.status}
                  onChange={e => handleStatusChange(f.id, e.target.value)}
                  aria-label={`Status for feedback ${f.id}`}
                  id={`feedback-status-${f.id}`}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
