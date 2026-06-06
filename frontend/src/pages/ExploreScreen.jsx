import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviders } from '../api/client';
import { CATEGORIES } from '../data/mock';

export default function ExploreScreen() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProviders(category !== 'all' ? category : null, search || null)
      .then(res => setProviders(res.providers))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <div className="page" id="explore-screen">
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>
        Explore Providers
      </h1>

      {/* Search */}
      <div className="search-bar">
        <span className="search-bar-icon">🔍</span>
        <input
          placeholder="Search providers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="explore-search-input"
        />
      </div>

      {/* Category Filters */}
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

      {/* Provider List — banner-card style */}
      {loading ? (
        <div className="flex-col gap-16">
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 160 }} />
              <div className="card-body">
                <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 14 }} />
                <div className="skeleton" style={{ height: 40, borderRadius: 12 }} />
              </div>
            </div>
          ))}
        </div>
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
              {/* Banner image with overlay */}
              <div style={{ position: 'relative' }}>
                <img
                  className="card-cover"
                  src={p.cover_photo_url}
                  alt={p.name}
                  loading="lazy"
                  style={{ height: 160, filter: 'brightness(0.5)' }}
                />
                {/* Category badge on top-right */}
                <span
                  className={`category-badge ${p.category}`}
                  style={{ position: 'absolute', top: 10, right: 10 }}
                >
                  {p.category}
                </span>

                {/* Overlay content */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  padding: 14,
                  background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.75) 100%)'
                }}>
                  {/* Feature highlights on image */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.services?.slice(0, 3).map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)'
                      }}>
                        <span style={{ color: 'var(--accent)' }}>✦</span>
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{s.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                      {p.location_text?.split(',')[0]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--accent)', fontWeight: 700, fontSize: '0.88rem' }}>
                    ⭐ {p.rating}
                  </div>
                </div>

                {/* Service tag chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
                  {p.services?.slice(0, 4).map((s, i) => (
                    <span key={i} className="chip" style={{ padding: '3px 10px', fontSize: '0.68rem' }}>
                      {s.name}
                    </span>
                  ))}
                </div>

                {/* Book Now button */}
                <button
                  className="btn btn-primary btn-block"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/booking/${p.id}`, { state: { provider: p } });
                  }}
                  id={`book-btn-${p.id}`}
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
