import React, { useEffect, useState } from 'react';
import { getFeaturedEvents } from '../api/client';
import { useNavigate } from 'react-router-dom';

const FeaturedEventsCarousel = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await getFeaturedEvents();
        setEvents(res.events || []);
      } catch (err) {
        console.error('Error fetching featured events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) return <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading events...</div>;
  if (events.length === 0) return null;

  return (
    <div style={{ margin: '16px 0' }}>
      <div className="section-header" style={{ marginBottom: '12px' }}>
        <h2 className="section-title">Featured Upcoming Events</h2>
      </div>
      <div className="h-scroll" style={{ paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px', display: 'flex', gap: '16px' }}>
        {events.map(event => {
          let urgencyStyle = { background: '#dcfce7', color: '#166534' };
          if (event.urgency === 'high') urgencyStyle = { background: '#fee2e2', color: '#991b1b' };
          else if (event.urgency === 'medium') urgencyStyle = { background: '#fef3c7', color: '#92400e' };

          return (
            <div key={event.id} className="card" style={{ minWidth: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', background: 'var(--primary)', color: 'white', borderRadius: '99px' }}>Boosted</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '99px', ...urgencyStyle }}>
                    {event.spots_remaining} spots left
                  </span>
                </div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{event.service_name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{event.provider_name}</p>
                <div style={{ fontSize: '0.85rem', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <p>📅 {new Date(event.starts_at).toLocaleDateString()} at {new Date(event.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <p>💰 {event.price_etb} ETB</p>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/book/${event.provider_id}?event_id=${event.id}`)}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'auto' }}
              >
                Book Now
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FeaturedEventsCarousel;
