import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyBookings } from '../api/client';
import Icon from '../components/Icon';

export default function MyBookings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await getMyBookings();
      const allBookings = res.bookings || [];
      const now = new Date();
      
      setUpcoming(allBookings.filter(b => new Date(b.slot_datetime || b.created_at) >= now));
      setPast(allBookings.filter(b => new Date(b.slot_datetime || b.created_at) < now));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const STATUS_LABELS = { success: 'Confirmed', pending: 'Pending', failed: 'Failed' };

  const BookingItem = ({ b, isUpcoming }) => {
    let statusColor = 'var(--text-secondary)';
    if (b.payment_status === 'success') statusColor = '#10b981'; // green
    else if (b.payment_status === 'pending') statusColor = '#f59e0b'; // yellow

    return (
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{b.service_name || b.provider_name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.provider_name}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {isUpcoming && <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', display: 'inline-block', marginBottom: '4px', fontFamily: 'monospace' }}>#{b.id.split('-')[0].toUpperCase()}</span>}
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>
              {STATUS_LABELS[b.payment_status] || b.payment_status}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          {new Date(b.slot_datetime || b.created_at).toLocaleString()}
        </div>


      </div>
    );
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>;

  return (
    <div className="page" id="my-bookings-screen">
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Go back">
          <Icon name="chevron-left" size={20} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{t('My Bookings')}</h1>
      </div>

      <div className="flex-col gap-12">
        <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>Upcoming Sessions</h3>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>No upcoming sessions.</p>
        ) : (
          upcoming.map(b => <BookingItem key={b.id} b={b} isUpcoming={true} />)
        )}

        <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '16px', marginBottom: '8px' }}>Past History</h3>
        {past.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No past sessions.</p>
        ) : (
          past.map(b => <BookingItem key={b.id} b={b} isUpcoming={false} />)
        )}
      </div>
    </div>
  );
}
