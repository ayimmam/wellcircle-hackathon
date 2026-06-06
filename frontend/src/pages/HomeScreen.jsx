import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProviders, getCommunities, joinCommunity } from '../api/client';
import { NEIGHBOURHOOD_ALERTS } from '../data/mock';
import ProviderCard from '../components/ProviderCard';
import CommunityCard from '../components/CommunityCard';
import PointsBadge from '../components/PointsBadge';
import { showToast } from '../components/Toast';

export default function HomeScreen() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    getProviders().then(res => setProviders(res.providers));
    getCommunities().then(res => setCommunities(res.communities.filter(c => !c.user_joined).slice(0, 4)));
  }, []);

  const alertText = user?.location_neighborhood
    ? NEIGHBOURHOOD_ALERTS[user.location_neighborhood]
    : null;

  const handleJoin = async (id) => {
    try {
      const res = await joinCommunity(id);
      showToast('Joined! 🎉', '🤝');
      setCommunities(prev => prev.map(c =>
        c.id === id ? { ...c, user_joined: true, member_count: res.member_count } : c
      ));
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
    } catch (err) {
      showToast('Already a member', '👥');
    }
  };

  const featured = [...providers].sort((a, b) => b.rating - a.rating).slice(0, 5);
  const topProvider = featured[0];

  return (
    <div className="page" id="home-screen">
      {/* Greeting + Points */}
      <div className="flex items-center justify-between mb-20">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
            Hey, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Your wellness journey awaits
          </p>
        </div>
        {user && <PointsBadge points={user.points_balance || 0} />}
      </div>

      {/* Neighbourhood Alert */}
      {alertText && !alertDismissed && (
        <div className="alert-banner" id="neighbourhood-alert">
          <span className="alert-banner-icon">📍</span>
          <span className="alert-banner-text">{alertText}</span>
          <button className="alert-banner-close" onClick={() => setAlertDismissed(true)}>✕</button>
        </div>
      )}

      {/* Hero Banner Card — top provider */}
      {topProvider && (
        <div
          className="card mb-24"
          style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
          onClick={() => navigate(`/provider/${topProvider.id}`)}
          id="hero-banner"
        >
          <div style={{ position: 'relative' }}>
            <img
              className="card-cover"
              src={topProvider.cover_photo_url}
              alt={topProvider.name}
              style={{ height: 180, filter: 'brightness(0.55)' }}
            />
            {/* Overlay content on image */}
            <div style={{
              position: 'absolute', inset: 0,
              padding: 18,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.7) 100%)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem' }}>⭐ {topProvider.rating}</span>
                  <span className={`category-badge ${topProvider.category}`}>{topProvider.category}</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{topProvider.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  📍 {topProvider.location_text?.split(',')[0]} · {topProvider.price_range}
                </span>
              </div>
            </div>
          </div>

          {/* Service tags */}
          <div className="card-body" style={{ padding: '10px 14px 6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {topProvider.services?.slice(0, 4).map((s, i) => (
                <span key={i} className="chip" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                  {s.name}
                </span>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={(e) => { e.stopPropagation(); navigate(`/booking/${topProvider.id}`, { state: { provider: topProvider } }); }}
              id="hero-book-btn"
            >
              Book Now
            </button>
          </div>
        </div>
      )}

      {/* Featured Providers */}
      <div className="section-header">
        <h2 className="section-title">Featured Providers</h2>
        <button className="section-action" onClick={() => navigate('/explore')}>See all →</button>
      </div>
      <div className="h-scroll mb-24">
        {featured.slice(1).map(p => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>

      {/* Quick Join Communities */}
      {communities.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Join a Circle</h2>
            <button className="section-action" onClick={() => navigate('/community')}>Browse →</button>
          </div>
          <div className="flex-col gap-12">
            {communities.slice(0, 3).map(c => (
              <CommunityCard key={c.id} community={c} onJoin={handleJoin} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
