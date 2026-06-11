import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyBookings } from '../api/client';

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await getMyBookings();
      setBookings(res.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>;

  return (
    <div className="page" id="my-bookings-screen">
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>←</button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>My Bookings</h1>
      </div>

      <div className="flex-col gap-12">
        {bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎟️</div>
            <div className="empty-state-text">No bookings found.</div>
            <button className="btn btn-primary" onClick={() => navigate('/explore')} style={{ marginTop: '16px' }}>
              Explore Providers
            </button>
          </div>
        ) : (
          bookings.map(b => {
            let statusColor = 'var(--text-secondary)';
            if (b.payment_status === 'success') statusColor = '#10b981'; // green
            else if (b.payment_status === 'pending') statusColor = '#f59e0b'; // yellow

            return (
              <div key={b.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{b.service_name || b.provider_name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.provider_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{b.amount_etb} ETB</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>
                      {b.payment_status}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Booking Date: {new Date(b.created_at).toLocaleDateString()}
                </div>

                {b.payment_status === 'success' && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#fef3c7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>
                    🏆 Rewarded +{Math.floor(b.amount_etb * 0.1)} Legacy Points
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
