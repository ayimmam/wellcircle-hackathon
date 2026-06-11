import { useEffect, useState } from 'react';
import { getFeaturedEvents } from '../api/client';
import EventCard from './EventCard';

export default function FeaturedEventsCarousel({ title = 'Happening Soon' }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedEvents()
      .then(res => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Loading events...
      </div>
    );
  }
  if (events.length === 0) return null;

  return (
    <div style={{ margin: '16px 0' }}>
      <div className="section-header" style={{ marginBottom: '12px' }}>
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="h-scroll" style={{ display: 'flex', gap: '16px', paddingBottom: '16px' }}>
        {events.map(event => (
          <EventCard key={event.id} event={event} variant="carousel" />
        ))}
      </div>
    </div>
  );
}
