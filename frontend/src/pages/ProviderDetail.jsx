import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useTelegramHeaderColor } from '../hooks/useTelegramHeaderColor';
import { getProvider, joinCommunity, getProviderEvents } from '../api/client';
import EventCard from '../components/EventCard';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import { promoApplies, daysLeft, expiryLabel } from '../utils/promo';

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  useTelegramHeaderColor('#000000');
  const { t } = useTranslation();
  const [provider, setProvider] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    setLoading(true);
    getProvider(id)
      .then(p => setProvider(p))
      .catch(() => navigate('/explore', { replace: true }))
      .finally(() => setLoading(false));
    getProviderEvents(id)
      .then(res => setEvents((res.events || []).filter(e => !e.is_cancelled)))
      .catch(() => setEvents([]));
  }, [id, navigate]);

  const promo = provider?.active_promotion;
  useEffect(() => {
    if (!promo) return;
    track('promo_view', {
      provider_id: id,
      surface: 'provider_detail',
      discount_pct: promo.discount_pct ?? undefined,
      audience: promo.audience,
      user_eligible: promo.user_eligible,
      days_left: daysLeft(promo.valid_until) ?? undefined,
    });
    // one event per provider visit, not per re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!promo]);

  const handleJoinCommunity = async () => {
    if (!provider?.community) return;
    try {
      const res = await joinCommunity(provider.community.id);
      setProvider(prev => ({
        ...prev,
        community: { ...prev.community, user_joined: true, member_count: res.member_count }
      }));
      showToast('Joined the circle!', 'success');
    } catch (err) {
      showToast('Already a member');
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
        <SmartImage
          className="detail-cover"
          src={provider.photos?.[activePhoto] || provider.cover_photo_url}
          alt={provider.name}
          width={430}
          priority
          fallback={<div className="detail-cover" />}
        />
        {!nativeBack && (
          <button className="detail-back" onClick={() => navigate(-1)} id="detail-back-btn" aria-label="Go back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
      </div>

      {/* Photo gallery */}
      {provider.photos?.length > 1 && (
        <div className="detail-gallery">
          {provider.photos.map((url, i) => (
            <SmartImage
              key={i}
              src={url}
              alt={`${provider.name} photo ${i + 1}`}
              width={80}
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
          <span className="inline-icon-text"><Icon name="star" size={14} /> {provider.rating}</span>
          <span className="inline-icon-text"><Icon name="coins" size={14} /> {provider.price_range}</span>
        </div>
        <div className="detail-meta" style={{ marginBottom: 16 }}>
          <span className="inline-icon-text"><Icon name="map-pin" size={14} /> {provider.location_text}</span>
        </div>
        <p className="detail-desc">{provider.description}</p>
      </div>

      {/* Coming soon (Boston Day Spa pilot: browsable, not bookable) */}
      {provider.is_coming_soon && (
        <div className="card" style={{ marginBottom: 16 }} id="coming-soon-banner">
          <div className="card-body" style={{ padding: '12px 14px' }}>
            <div className="inline-icon-text" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              <Icon name="clock" size={14} /> {t('Coming soon')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {t("Coming soon to Well Circle — this provider isn't taking bookings yet.")}
            </div>
          </div>
        </div>
      )}

      {/* Active promotion (presale loop) */}
      {!provider.is_coming_soon && provider.active_promotion && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--accent)' }} id="promo-banner">
          <div className="card-body" style={{ padding: '12px 14px' }}>
            <div className="inline-icon-text" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              <Icon name="ticket" size={14} /> {provider.active_promotion.headline}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {expiryLabel(provider.active_promotion.valid_until) && (
                <>{expiryLabel(provider.active_promotion.valid_until)} · </>
              )}
              {promoApplies(provider.active_promotion)
                ? t('Applied automatically at checkout')
                : provider.active_promotion.audience === 'first_time'
                  ? t('First-visit offer — you have already booked here')
                  : null}
            </div>
            {/* Anchoring: preview the cheapest service at the discounted price */}
            {promoApplies(provider.active_promotion) && provider.services?.length > 0 && (() => {
              const cheapest = [...provider.services].sort((a, b) => (a.price || 0) - (b.price || 0))[0];
              if (!cheapest?.price) return null;
              const off = Math.round(cheapest.price * provider.active_promotion.discount_pct / 100);
              return (
                <div style={{ fontSize: '0.78rem', marginTop: 6 }} id="promo-price-preview">
                  {cheapest.name}:{' '}
                  <s style={{ color: 'var(--text-tertiary)' }}>ETB {cheapest.price.toLocaleString()}</s>{' '}
                  <b style={{ color: 'var(--accent)' }}>ETB {(cheapest.price - off).toLocaleString()}</b>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">{t('Upcoming Sessions')}</h2>
          </div>
          <div className="mb-24">
            {events.slice(0, 5).map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </>
      )}

      {/* Getting there (Phase 8) — detail-only content, rendered only when
          the provider has tips or facilities on file (no empty header). */}
      {(provider.navigation_tips?.length > 0 || provider.facilities?.length > 0) && (
        <>
          <div className="section-header">
            <h2 className="section-title">{t('Getting there')}</h2>
          </div>
          <div className="card mb-24">
            <div className="card-body">
              {provider.navigation_tips?.map((tip, i) => (
                <div key={i} className="flex items-start gap-8" style={{ marginBottom: 10 }}>
                  <Icon name="map-pin" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{tip.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tip.detail}</div>
                  </div>
                </div>
              ))}
              {provider.lat != null && provider.lng != null && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={`https://www.google.com/maps/search/?api=1&query=${provider.lat},${provider.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  id="open-in-maps-link"
                  style={{ marginTop: 4 }}
                >
                  <Icon name="map-pin" size={14} /> {t('Open in Maps')}
                </a>
              )}
              {provider.facilities?.length > 0 && (
                <div style={{ marginTop: provider.navigation_tips?.length > 0 ? 16 : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>{t('Facilities')}</div>
                  <div className="flex-col gap-6">
                    {provider.facilities.map((facility, i) => (
                      <div key={i} className="inline-icon-text" style={{ fontSize: '0.82rem' }}>
                        <Icon name="check" size={14} strokeWidth={2.5} /> {facility}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Services */}
      <div className="section-header">
        <h2 className="section-title">{t('Services')}</h2>
      </div>
      <div className="services-list">
        {provider.services?.map((service, i) => (
          <div
            key={i}
            className="service-item"
            style={provider.is_coming_soon ? { cursor: 'default', opacity: 0.6 } : undefined}
            onClick={provider.is_coming_soon ? undefined : () => navigate(`/booking/${provider.id}`, { state: { provider, selectedService: service } })}
            id={`service-${i}`}
          >
            <div>
              <div className="service-name">{service.name}</div>
              <div className="service-duration">
                {service.duration}
                {service.booking_method === 'phone' && (
                  <span className="inline-icon-text" style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                    <Icon name="smartphone" size={11} /> {t('Book directly')}
                  </span>
                )}
              </div>
            </div>
            <div className="service-price">
              {service.price != null ? `ETB ${service.price.toLocaleString()}` : t('Price on enquiry')}
            </div>
          </div>
        ))}
      </div>

      {/* Linked Community */}
      {provider.community && (
        <>
          <div className="section-header" style={{ marginTop: 8 }}>
            <h2 className="section-title">{t('Community')}</h2>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div className="community-card-header">
                <span className="community-card-name">{provider.community.name}</span>
                <span className="community-card-members inline-icon-text"><Icon name="users" size={14} /> {provider.community.member_count}</span>
              </div>
              <div className="community-card-footer" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/community/${provider.community.id}`)}
                >
                  {t('View Feed')}
                </button>
                {provider.community.user_joined ? (
                  <span className="category-badge badge-success-soft inline-icon-text">
                    <Icon name="check" size={12} strokeWidth={2.5} /> Joined
                  </span>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={handleJoinCommunity} id="join-community-btn">
                    {t('Join Circle')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Book Now CTA */}
      {provider.is_coming_soon ? (
        <button className="btn btn-secondary btn-block btn-lg" disabled id="book-now-btn" style={{ marginBottom: 16 }}>
          {t('Coming soon')}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => navigate(`/booking/${provider.id}`, { state: { provider } })}
          id="book-now-btn"
          style={{ marginBottom: 16 }}
        >
          <Icon name="calendar" size={18} /> {t('Book Now')}
        </button>
      )}
    </div>
  );
}
