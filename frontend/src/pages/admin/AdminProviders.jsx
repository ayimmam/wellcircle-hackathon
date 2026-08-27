import { useState, useEffect } from 'react';
import {
  getPendingProviders, getAdminProviders, approveProvider, rejectProvider, promoteProvider, generateInviteCode,
  setProviderLaunchState
} from '../../api/client';
import { INTEREST_CATEGORIES } from '../../data/mock';
import { showToast } from '../../components/Toast';
import useDismissOnEscape from '../../hooks/useDismissOnEscape';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function AdminProviders() {
  const [subTab, setSubTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [promoteForm, setPromoteForm] = useState({
    user_telegram_id: '', name: '', category: 'yoga', location_text: '', lat: '', lng: ''
  });
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  useDismissOnEscape(() => setSelected(null), Boolean(selected));
  useDismissOnEscape(() => setShowAdd(false), showAdd);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a, r] = await Promise.all([
        getPendingProviders(),
        getAdminProviders('active', search || null),
        getAdminProviders('rejected'),
      ]);
      setPending(p.pending_providers || []);
      setActive(a.providers || []);
      setRejected(r.providers || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const handleApprove = async (id) => {
    try {
      await approveProvider(id);
      showToast('Provider approved', 'success');
      setSelected(null);
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await rejectProvider(id, reason);
      showToast('Provider rejected', 'success');
      setSelected(null);
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleToggleLaunchState = async (p) => {
    try {
      await setProviderLaunchState(p.id, !p.is_coming_soon);
      showToast(p.is_coming_soon ? 'Provider is now live' : 'Provider set to coming soon', 'success');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    try {
      await promoteProvider({
        user_telegram_id: parseInt(promoteForm.user_telegram_id, 10),
        provider_data: {
          name: promoteForm.name,
          category: promoteForm.category,
          location_text: promoteForm.location_text,
          lat: promoteForm.lat ? parseFloat(promoteForm.lat) : null,
          lng: promoteForm.lng ? parseFloat(promoteForm.lng) : null,
        }
      });
      showToast('Provider created', 'success');
      setShowAdd(false);
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await generateInviteCode(30);
      setInviteCode(res);
      showToast('Invite code generated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteCode = async () => {
    if (!inviteCode?.invite_code) return;
    try {
      await navigator.clipboard.writeText(inviteCode.invite_code);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast(inviteCode.invite_code);
    }
  };

  const list = subTab === 'pending' ? pending : subTab === 'active' ? active : rejected;

  return (
    <div>
      <div className="flex gap-8 mb-16 flex-wrap">
        <button className="btn btn-secondary btn-sm" onClick={handleGenerateInvite} disabled={generatingInvite}>
          {generatingInvite ? 'Generating…' : 'Generate Invite Code'}
        </button>
        {inviteCode && (
          <button className="btn btn-primary btn-sm" onClick={copyInviteCode}>
            Copy {inviteCode.invite_code}
          </button>
        )}
      </div>

      <div className="admin-subtabs">
        <button className={`admin-subtab ${subTab === 'pending' ? 'active' : ''}`} onClick={() => setSubTab('pending')}>
          Pending {pending.length > 0 && <span className="badge badge-danger">{pending.length}</span>}
        </button>
        <button className={`admin-subtab ${subTab === 'active' ? 'active' : ''}`} onClick={() => setSubTab('active')}>Active</button>
        <button className={`admin-subtab ${subTab === 'rejected' ? 'active' : ''}`} onClick={() => setSubTab('rejected')}>Rejected</button>
      </div>

      {subTab === 'active' && (
        <div className="flex gap-12 mb-16">
          <input className="input" type="search" placeholder="Search providers…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search providers" autoComplete="off" />
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>Add Provider</button>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : list.length === 0 ? (
        <p className="text-secondary text-center mt-24">No providers found.</p>
      ) : (
        <div className="admin-card-list">
          {list.map(p => (
            <div key={p.id} className="card admin-provider-card">
              <div className="card-body">
                <h3 className="card-title">{p.name}</h3>
                <p className="text-secondary text-sm">Category: {p.category}</p>
                {p.owner_name && <p className="text-sm">Owner: {p.owner_name} {p.owner_telegram_handle && `(${p.owner_telegram_handle})`}</p>}
                {p.location_text && <p className="text-sm">Location: {p.location_text}</p>}
                {p.submitted_at && <p className="text-sm text-secondary">Submitted: {timeAgo(p.submitted_at)}</p>}
                {p.member_count != null && <p className="text-sm">{p.member_count} members</p>}
                {subTab === 'active' && (
                  <p className="text-sm">
                    Status:{' '}
                    <span className={`category-badge ${p.is_coming_soon ? '' : 'badge-success-soft'}`}>
                      {p.is_coming_soon ? 'Coming soon' : 'Live'}
                    </span>
                  </p>
                )}
                <div className="flex gap-8 mt-12 flex-wrap">
                  {subTab === 'pending' && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelected(p)}>View</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprove(p.id)}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(p.id)}>Reject</button>
                    </>
                  )}
                  {subTab === 'active' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleToggleLaunchState(p)}>
                      {p.is_coming_soon ? 'Mark Live' : 'Mark Coming Soon'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="card-title mb-12">{selected.name} — Application</h3>
            <p><strong>Owner:</strong> {selected.owner_name}</p>
            <p><strong>Telegram:</strong> {selected.owner_telegram_handle}</p>
            <p><strong>Category:</strong> {selected.category}</p>
            <p><strong>Location:</strong> {selected.location_text}</p>
            {selected.lat && <p><strong>Coords:</strong> {selected.lat}, {selected.lng}</p>}
            <p><strong>Price Range:</strong> {selected.price_range}</p>
            <p className="mt-8">{selected.description}</p>
            {selected.services?.length > 0 && (
              <div className="mt-12">
                <strong>Services:</strong>
                <ul className="mt-8">
                  {selected.services.map((s, i) => (
                    <li key={i} className="text-sm">• {s.name} (ETB {s.price}, {s.duration})</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-8 mt-16">
              <button className="btn btn-primary" onClick={() => handleApprove(selected.id)}>Approve</button>
              <button className="btn btn-danger" onClick={() => handleReject(selected.id)}>Reject</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Back</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="card-title mb-16">Add Provider Directly</h3>
            <form onSubmit={handlePromote} className="form-stack">
              <input className="input" placeholder="User Telegram ID" required value={promoteForm.user_telegram_id} onChange={e => setPromoteForm(f => ({ ...f, user_telegram_id: e.target.value }))} aria-label="User Telegram ID" autoComplete="off" />
              <input className="input" placeholder="Provider Name" required value={promoteForm.name} onChange={e => setPromoteForm(f => ({ ...f, name: e.target.value }))} aria-label="Provider name" autoComplete="off" />
              <select className="input" value={promoteForm.category} onChange={e => setPromoteForm(f => ({ ...f, category: e.target.value }))} aria-label="Category">
                {INTEREST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input className="input" placeholder="Location" value={promoteForm.location_text} onChange={e => setPromoteForm(f => ({ ...f, location_text: e.target.value }))} aria-label="Location" autoComplete="off" />
              <div className="flex gap-8">
                <input className="input" type="number" inputMode="decimal" placeholder="Lat" value={promoteForm.lat} onChange={e => setPromoteForm(f => ({ ...f, lat: e.target.value }))} aria-label="Latitude" />
                <input className="input" type="number" inputMode="decimal" placeholder="Lng" value={promoteForm.lng} onChange={e => setPromoteForm(f => ({ ...f, lng: e.target.value }))} aria-label="Longitude" />
              </div>
              <div className="flex gap-8">
                <button type="submit" className="btn btn-primary">Create</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
