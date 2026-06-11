import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviders, getEvents } from '../api/client';
import { CATEGORIES } from '../data/mock';
import EventCard from '../components/EventCard';

export default function ExploreScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState('studios');
  const [providers, setProviders] = useState([]);
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (view === 'studios') {
      getProviders(category !== 'all' ? category : null, search || null)
        .then(res => setProviders(res.providers))
        .finally(() => setLoading(false));
    } else {
      const params = {};
      if (category !== 'all') params.category = category;
      getEvents(params)
        .then(res => setEvents(res.events || []))
        .finally(() => setLoading(false));
    }
  }, [view, category, search]);

  return (
    <div className="page" id="explore-screen">
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>Explore</h1>

      <div className="admin-subtabs mb-16" style={{ display: 'flex', gap: 8 }}>
        <button className={`admin-subtab ${view === 'studios' ? 'active' : ''}`} onClick={() => setView('studios')}>Studios</button>
        <button className={`admin-subtab ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>Events</button>
      </div>

      <div className="search-bar">
        <span className="search-bar-icon">🔍</span>
        <input
          placeholder={view === 'studios' ? 'Search providers...' : 'Search events...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="explore-search-input"
        />
      </div>

      <div className="filter-chips">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            className={`chip ${category === cat.value ? 'active' : ''}`}
            onClick={() => setCategory(cat.value)}
            id={`filter-${cat.value}`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-col gap-16">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : view === 'events' ? (
        events.length > 0 ? (
          <div className="flex-col gap-8">
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">No upcoming events in this category.</div>
          </div>
        )
      ) : providers.length > 0 ? (
        <div className="flex-col gap-16">
          {providers.map(p => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/provider/${p.id}`)}
              id={`explore-provider-${p.id}`}
            >
              <div style={{ position: 'relative' }}>
                <img className="card-cover" src={p.cover_photo_url} alt={p.name} loading="lazy" style={{ height: 160, filter: 'brightness(0.5)' }} />
                {p.is_featured && (
                  <span className="category-badge" style={{ position: 'absolute', top: 10, left: 10, background: 'var(--accent)' }}>Featured</span>
                )}
                <span className={`category-badge ${p.category}`} style={{ position: 'absolute', top: 10, right: 10 }}>{p.category}</span>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  padding: 14, background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.75) 100%)',
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{p.name}</div>
                  {p.active_promotion && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-light)', marginTop: 4 }}>
                      🏷 {p.active_promotion.headline}
                    </div>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.location_text?.split(',')[0]}</span>
                  <span style={{ fontWeight: 700 }}>⭐ {p.rating}</span>
                </div>
                <button
                  className="btn btn-primary btn-block mt-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/booking/${p.id}`, { state: { provider: p } });
                  }}
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">No providers found. Try a different category.</div>
        </div>
      )}
    </div>
  );
}
