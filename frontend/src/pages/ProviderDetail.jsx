import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProvider, joinCommunity } from '../api/client';
import { showToast } from '../components/Toast';

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProvider(id)
      .then(p => setProvider(p))
      .catch(() => navigate('/explore', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleJoinCommunity = async () => {
    if (!provider?.community) return;
    try {
      const res = await joinCommunity(provider.community.id);
      setProvider(prev => ({
        ...prev,
        community: { ...prev.community, user_joined: true, member_count: res.member_count }
      }));
      showToast('Joined the circle! 🎉', '🤝');
    } catch (err) {
      showToast('Already a member', '👥');
    }
  };

  if (loading || !provider) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 220, margin: '-16px -16px 16px', borderRadius: 0 }} />
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
      </div>
    );
  }

  return (
    <div className="page" id="provider-detail-screen" style={{ paddingTop: 0 }}>
      {/* Header with cover photo */}
      <div className="detail-header">
        <img className="detail-cover" src={provider.photos?.[activePhoto] || provider.cover_photo_url} alt={provider.name} />
        <button className="detail-back" onClick={() => navigate(-1)} id="detail-back-btn">←</button>
      </div>

      {/* Photo gallery */}
      {provider.photos?.length > 1 && (
        <div className="detail-gallery">
          {provider.photos.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${provider.name} photo ${i + 1}`}
              className={i === activePhoto ? 'active' : ''}
              onClick={() => setActivePhoto(i)}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="detail-info">
        <h1 className="detail-name">{provider.name}</h1>
        <div className="detail-meta">
          <span className={`category-badge ${provider.category}`}>{provider.category}</span>
          <span>⭐ {provider.rating}</span>
          <span>💰 {provider.price_range}</span>
        </div>
        <div className="detail-meta" style={{ marginBottom: 16 }}>
          <span>📍 {provider.location_text}</span>
        </div>
        <p className="detail-desc">{provider.description}</p>
      </div>

      {/* Services */}
      <div className="section-header">
        <h2 className="section-title">Services</h2>
      </div>
      <div className="services-list">
        {provider.services?.map((service, i) => (
          <div
            key={i}
            className="service-item"
            onClick={() => navigate(`/booking/${provider.id}`, { state: { provider, selectedService: service } })}
            id={`service-${i}`}
          >
            <div>
              <div className="service-name">{service.name}</div>
              <div className="service-duration">{service.duration}</div>
            </div>
            <div className="service-price">ETB {service.price?.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Linked Community */}
      {provider.community && (
        <>
          <div className="section-header" style={{ marginTop: 8 }}>
            <h2 className="section-title">Community</h2>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div className="community-card-header">
                <span className="community-card-name">{provider.community.name}</span>
                <span className="community-card-members">👥 {provider.community.member_count}</span>
              </div>
              <div className="community-card-footer" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/community/${provider.community.id}`)}
                >
                  View Feed
                </button>
                {provider.community.user_joined ? (
                  <span className="category-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                    ✓ Joined
                  </span>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={handleJoinCommunity} id="join-community-btn">
                    Join Circle
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Book Now CTA */}
      <button
        className="btn btn-primary btn-block btn-lg"
        onClick={() => navigate(`/booking/${provider.id}`, { state: { provider } })}
        id="book-now-btn"
        style={{ marginBottom: 16 }}
      >
        📅 Book Now
      </button>
    </div>
  );
}
