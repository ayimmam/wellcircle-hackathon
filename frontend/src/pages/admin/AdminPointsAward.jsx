import { useState, useEffect } from 'react';
import { getAdminUsers, adminAwardPoints } from '../../api/client';
import { showToast } from '../../components/Toast';

export default function AdminPointsAward() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        setUsers([]);
        return;
      }
      setLoading(true);
      try {
        const res = await getAdminUsers({ search });
        setUsers(res.users || []);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAward = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return showToast('Select at least one user', 'error');
    if (amount <= 0 || amount > 50) return showToast('Amount must be between 1 and 50', 'error');
    if (!note.trim()) return showToast('Note is required', 'error');

    setSubmitting(true);
    try {
      const res = await adminAwardPoints({
        user_ids: Array.from(selectedIds),
        amount: parseInt(amount, 10),
        note: note.trim()
      });
      showToast(`Successfully awarded ${res.total_points} total points to ${res.awarded_count} users`, 'success');
      setSelectedIds(new Set());
      setNote('');
      setAmount(10);
      setSearch('');
      setUsers([]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="section-title mb-16">Award Points</h2>
      <p className="text-secondary mb-24" style={{ fontSize: '0.9rem' }}>
        Directly award points to users (e.g., for in-person events). Maximum 50 points per award.
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 className="section-title mb-16" style={{ fontSize: '1.1rem' }}>1. Select Users</h3>
        <input
          type="text"
          className="onboarding-input mb-16"
          placeholder="Search by name or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        {loading && <p className="text-secondary">Searching...</p>}
        
        {!loading && users.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-12" style={{ padding: 12, borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleSelect(u.id)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{u.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    @{u.telegram_handle} • {u.points_balance} pts
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        
        {!loading && search && users.length === 0 && (
          <p className="text-secondary">No users found.</p>
        )}

        <div className="mt-16 text-secondary" style={{ fontSize: '0.9rem' }}>
          {selectedIds.size} user(s) selected
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 className="section-title mb-16" style={{ fontSize: '1.1rem' }}>2. Award Details</h3>
        <form onSubmit={handleAward}>
          <div className="mb-16">
            <label className="block mb-8" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Points Amount (1-50)</label>
            <input
              type="number"
              className="onboarding-input"
              min="1"
              max="50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="mb-24">
            <label className="block mb-8" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Note (visible to user)</label>
            <input
              type="text"
              className="onboarding-input"
              placeholder="e.g. Morning Run Group - Aug 3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={submitting || selectedIds.size === 0}
          >
            {submitting ? 'Awarding...' : `Award Points`}
          </button>
        </form>
      </div>
    </div>
  );
}
