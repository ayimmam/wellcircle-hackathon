import { useState, useEffect } from 'react';
import { useProviderPortalData } from '../../context/ProviderPortalDataContext';
import { getProviderEvents, createProviderEvent, updateProviderEvent, getProviderCustomers } from '../../api/client';
import { showToast } from '../../components/Toast';

function EditableEventItem({ event, customers, providerId, onChanged }) {
  const [isEditing, setIsEditing] = useState(false);
  const [spots, setSpots] = useState(event.spots_remaining);
  const [staffId, setStaffId] = useState(event.staff_user_id || '');
  const fillPct = event.capacity ? Math.round(((event.capacity - event.spots_remaining) / event.capacity) * 100) : 0;
  const staffName = customers.find(c => c.user_id === event.staff_user_id)?.name;

  const handleSave = async () => {
    try {
      await updateProviderEvent(event.id, {
        spots_remaining: parseInt(spots),
        staff_user_id: staffId || null,
      });
      showToast('Inventory updated', 'success');
      setIsEditing(false);
      onChanged();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="card mb-8">
      <div className="card-body">
        <h3 className="card-title text-sm">{event.service_name}</h3>
        <p className="text-xs text-secondary">{new Date(event.starts_at).toLocaleString()} | {event.price_etb} ETB</p>

        <div className="flex justify-between items-center my-8">
          {isEditing ? (
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <input type="number" value={spots} onChange={e => setSpots(e.target.value)} className="input" style={{ width: '60px', padding: '4px' }} />
              <select className="input" style={{ padding: '4px' }} value={staffId} onChange={e => setStaffId(e.target.value)}>
                <option value="">No evidence staff</option>
                {customers.map(c => (
                  <option key={c.user_id} value={c.user_id}>{c.name}</option>
                ))}
              </select>
              <button onClick={handleSave} className="btn btn-sm btn-primary">Save</button>
              <button onClick={() => setIsEditing(false)} className="btn btn-sm btn-secondary">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-4 items-center">
              <span className="text-sm">Spots: {spots}/{event.capacity}</span>
              {staffName && <span className="text-xs text-secondary">· Staff: {staffName}</span>}
              <button onClick={() => setIsEditing(true)} className="text-accent underline text-sm" style={{ background: 'none', border: 'none' }}>Edit</button>
            </div>
          )}
        </div>

        <div className="admin-bar-track mb-8" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
          <div className="admin-bar-fill" style={{ width: `${fillPct}%`, height: '100%', borderRadius: 4 }} />
        </div>

        <div className="flex gap-8 items-center mt-4">
          {!event.is_cancelled && (
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try {
                await updateProviderEvent(event.id, { is_cancelled: true });
                showToast('Event cancelled', 'success');
                onChanged();
              } catch (err) { showToast(err.message, 'error'); }
            }}>Cancel Session</button>
          )}
          <span className={`badge ${event.is_cancelled ? 'badge-muted' : 'badge-success'}`}>{event.is_cancelled ? 'Cancelled' : 'Active'}</span>
        </div>
      </div>
    </div>
  );
}

export default function ProviderPortalEvents() {
  const { providerId } = useProviderPortalData();
  const [events, setEvents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ service_name: '', description: '', starts_at: '', ends_at: '', capacity: 10, price_etb: 0, staff_user_id: '' });

  const reload = async () => {
    if (!providerId) return;
    const ev = await getProviderEvents(providerId);
    setEvents(ev.events || []);
  };

  useEffect(() => {
    if (!providerId) return;
    Promise.all([getProviderEvents(providerId), getProviderCustomers()])
      .then(([ev, cu]) => {
        setEvents(ev.events || []);
        setCustomers(cu.customers || []);
      })
      .catch(err => showToast(err.message || 'Could not load events', 'error'));
  }, [providerId]);

  return (
    <div id="provider-portal-events">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Events</h1>
      </div>
      <div className="flex justify-between items-center mb-16">
        <p className="text-sm">Upcoming Events: {events.filter(e => !e.is_cancelled && new Date(e.starts_at) > new Date()).length}</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateEvent(true)}>+ Create Event</button>
      </div>

      <div className="portal-grid-3 mb-24">
        {events.map(e => (
          <EditableEventItem key={e.id} event={e} customers={customers} providerId={providerId} onChanged={reload} />
        ))}
      </div>

      <div className="p-16 border rounded-xl bg-accent-light mt-16 mb-24" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: '1px', borderStyle: 'solid', maxWidth: 480 }}>
        <h3 className="font-bold text-lg mb-8" style={{ color: '#166534' }}>Boost Your Event</h3>
        <p className="text-sm mb-16" style={{ color: '#15803d' }}>Pay 50 ETB via Telebirr to pin your wellness event to the Featured carousel for 48 hours.</p>

        <select className="input mb-12" id="boost-event-select" style={{ width: '100%' }}>
          <option value="">Select an upcoming event...</option>
          {events.filter(e => !e.is_cancelled).map(ev => <option key={ev.id} value={ev.id}>{ev.service_name}</option>)}
        </select>

        <button
          className="btn btn-primary w-full"
          onClick={async () => {
            const sel = document.getElementById('boost-event-select');
            if (!sel.value) return;
            try {
              showToast('Processing Telebirr...');
              await new Promise(r => setTimeout(r, 1000));
              showToast('Payment successful! Event pinned to consumer Explore feed.', 'success');
            } catch (e) {
              showToast('Error boosting event', 'error');
            }
          }}
        >
          Pay 50 ETB & Boost
        </button>
      </div>

      {showCreateEvent && (
        <div className="modal-overlay" onClick={() => setShowCreateEvent(false)}>
          <div className="modal-card" onClick={ev => ev.stopPropagation()}>
            <h3 className="card-title mb-16">Create Event</h3>
            <div className="form-stack">
              <input className="input" placeholder="Service Name" value={newEvent.service_name} onChange={e => setNewEvent(p => ({ ...p, service_name: e.target.value }))} />
              <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
              <input className="input" type="datetime-local" placeholder="Starts At" value={newEvent.starts_at} onChange={e => setNewEvent(p => ({ ...p, starts_at: e.target.value }))} />
              <input className="input" type="datetime-local" placeholder="Ends At" value={newEvent.ends_at} onChange={e => setNewEvent(p => ({ ...p, ends_at: e.target.value }))} />
              <input className="input" type="number" placeholder="Capacity" value={newEvent.capacity} onChange={e => setNewEvent(p => ({ ...p, capacity: parseInt(e.target.value, 10) }))} />
              <input className="input" type="number" placeholder="Price (ETB)" value={newEvent.price_etb} onChange={e => setNewEvent(p => ({ ...p, price_etb: parseInt(e.target.value, 10) }))} />
              <select className="input" value={newEvent.staff_user_id} onChange={e => setNewEvent(p => ({ ...p, staff_user_id: e.target.value }))}>
                <option value="">Designate evidence staff (optional)</option>
                {customers.map(c => (
                  <option key={c.user_id} value={c.user_id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-secondary" style={{ marginTop: -8 }}>
                Staff can submit photo evidence via /evidence in the bot after this event ends, to award attendees points.
              </p>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await createProviderEvent({
                    service_name: newEvent.service_name,
                    description: newEvent.description,
                    starts_at: new Date(newEvent.starts_at).toISOString(),
                    ends_at: new Date(newEvent.ends_at).toISOString(),
                    capacity: newEvent.capacity,
                    price_etb: newEvent.price_etb,
                    staff_user_id: newEvent.staff_user_id || null,
                  });
                  showToast('Event created', 'success');
                  setShowCreateEvent(false);
                  await reload();
                } catch (err) { showToast(err.message, 'error'); }
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
