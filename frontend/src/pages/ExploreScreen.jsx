import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getProviders, getEvents, cacheKeys } from '../api/client';
import useResource from '../hooks/useResource';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { CATEGORIES } from '../data/mock';
import EventCard from '../components/EventCard';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import { useAuth } from '../context/AuthContext';
import { isNearUser, nearbyEvents } from '../utils/nearby';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

const EMPTY_LIST = [];

export default function ExploreScreen() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/home'));
  const { user } = useAuth();
  const [view, setView] = useState('studios');
  const [category, setCategory] = useState('all');
  const [nearMeActive, setNearMeActive] = useState(false);
  const location = useLocation();
  const [search, setSearch] = useState(location.state?.search || '');
  const { t } = useTranslation();
  // promo_view fires once per promo-bearing provider per Explore visit,
  // not on every refetch (category/search changes re-list the same cards)
  const promoViewsTracked = useRef(new Set());

  useEffect(() => {
    track('explore_view', { view, category });
  }, [view, category]);

  // The search box drives a query key, so wait for a pause in typing rather
  // than issuing a request per character.
  const debouncedSearch = useDebouncedValue(search, 300);
  const categoryFilter = category !== 'all' ? category : null;
  const searchFilter = debouncedSearch || null;
  const eventParams = useMemo(
    () => (categoryFilter ? { category: categoryFilter } : {}),
    [categoryFilter],
  );

  // Unfiltered, for events' "near me" matching, which needs every provider's
  // location_text rather than just the currently-listed ones. Home's bootstrap
  // has usually already filled this key, so it costs nothing.
  const { data: allProviders } = useResource(
    cacheKeys.providers(),
    () => getProviders(),
    { initialData: EMPTY_LIST, select: res => res.providers || EMPTY_LIST },
  );

  const { data: providers, loading: providersLoading } = useResource(
    cacheKeys.providers(categoryFilter, searchFilter),
    () => getProviders(categoryFilter, searchFilter),
    {
      enabled: view === 'studios',
      initialData: EMPTY_LIST,
      select: res => res.providers || EMPTY_LIST,
    },
  );

  const { data: events, loading: eventsLoading } = useResource(
    cacheKeys.events(eventParams),
    () => getEvents(eventParams),
    {
      enabled: view === 'events',
      initialData: EMPTY_LIST,
      select: res => res.events || EMPTY_LIST,
    },
  );

  const loading = view === 'studios' ? providersLoading : eventsLoading;

  useEffect(() => {
    providers.forEach(p => {
      if (!p.active_promotion || promoViewsTracked.current.has(p.id)) return;
      promoViewsTracked.current.add(p.id);
      track('promo_view', {
        provider_id: p.id,
        surface: 'explore_card',
        discount_pct: p.active_promotion.discount_pct ?? undefined,
        audience: p.active_promotion.audience,
      });
    });
  }, [providers]);

  const toggleNearMe = () => {
    if (!user?.location_neighborhood) {
      navigate('/profile', { state: { openNeighbourhood: true } });
      return;
    }
    setNearMeActive(v => !v);
  };

  const neighbourhood = user?.location_neighborhood;
  const visibleProviders = nearMeActive && neighbourhood
    ? providers.filter(p => isNearUser(p, neighbourhood))
    : providers;
  const visibleEvents = nearMeActive && neighbourhood
    ? nearbyEvents(events, allProviders, neighbourhood)
    : events;

  return (
    <div className="page" id="explore-screen">
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>{t('Explore')}</h1>

      <div className="admin-subtabs mb-16" style={{ display: 'flex', gap: 8 }}>
        <button className={`admin-subtab ${view === 'studios' ? 'active' : ''}`} onClick={() => setView('studios')}>{t('Studios')}</button>
        <button className={`admin-subtab ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>{t('Events')}</button>
      </div>

      <div className="search-bar">
        <span className="search-bar-icon"><Icon name="search" size={18} /></span>
        <input
          placeholder={view === 'studios' ? t('Search providers...') : t('Search events...')}
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
            {cat.label}
          </button>
        ))}
        <button
          className={`chip inline-icon-text ${nearMeActive ? 'active' : ''}`}
          onClick={toggleNearMe}
          id="filter-near-me"
        >
          <Icon name="map-pin" size={13} /> {t('Near me')}
        </button>
      </div>

      {loading ? (
        <div className="flex-col gap-16">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : view === 'events' ? (
        visibleEvents.length > 0 ? (
          <div className="flex-col gap-8">
            {visibleEvents.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="calendar" size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">{t('No upcoming events in this category.')}</div>
          </div>
        )
      ) : visibleProviders.length > 0 ? (
        <div className="flex-col gap-16">
          {visibleProviders.map(p => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/provider/${p.id}`)}
              id={`explore-provider-${p.id}`}
            >
              <div style={{ position: 'relative' }}>
                <SmartImage
                  className="card-cover"
                  src={p.cover_photo_url}
                  alt={p.name}
                  width={430}
                  style={{ height: 160, filter: 'brightness(0.5)' }}
                  fallback={<div className="card-cover" style={{ height: 160 }} />}
                />
                {p.is_featured && (
                  <span className="category-badge" style={{ position: 'absolute', top: 10, left: 10, background: 'var(--accent)' }}>Featured</span>
                )}
                <span className={`category-badge ${p.category}`} style={{ position: 'absolute', top: 10, right: 10 }}>{p.category}</span>
                <div
                  className="image-card-overlay"
                  style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  padding: 14,
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{p.name}</div>
                  {p.active_promotion && (
                    <div className="flex items-center gap-4" style={{ fontSize: '0.72rem', color: 'var(--accent-light)', marginTop: 4 }}>
                      <Icon name="ticket" size={12} /> {p.active_promotion.headline}
                    </div>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.location_text?.split(',')[0]}</span>
                  <span className="inline-icon-text" style={{ fontWeight: 700 }}><Icon name="star" size={14} /> {p.rating}</span>
                </div>
                <button
                  className="btn btn-primary btn-block mt-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/booking/${p.id}`, { state: { provider: p } });
                  }}
                >
                  {t('Book Now')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="search" size={40} strokeWidth={1.5} /></div>
          <div className="empty-state-text">{t('No providers found. Try a different category.')}</div>
        </div>
      )}
    </div>
  );
}
