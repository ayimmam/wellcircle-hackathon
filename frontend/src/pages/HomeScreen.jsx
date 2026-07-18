import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProviders, getCommunities, joinCommunity, getEvents } from '../api/client';
import NearYouSection from '../components/NearYouSection';
import { NEIGHBOURHOOD_ALERTS } from '../data/mock';
import ProviderCard from '../components/ProviderCard';
import CommunityCard from '../components/CommunityCard';
import PointsBadge from '../components/PointsBadge';
import StreakBadge from '../components/StreakBadge';
import FirstRewardCard from '../components/FirstRewardCard';
import SocialProofBanner from '../components/SocialProofBanner';
import WelcomeBanner from '../components/WelcomeBanner';
import HomePromoBanner from '../components/HomePromoBanner';
import CheckinCard from '../components/CheckinCard';
import { showToast } from '../components/Toast';
import FeaturedEventsCarousel from '../components/FeaturedEventsCarousel';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';
import AskWellCircle from '../components/AskWellCircle';
import PointsInfoSheet from '../components/PointsInfoSheet';

export default function HomeScreen() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [events, setEvents] = useState([]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const justOnboarded = Boolean(location.state?.justOnboarded);

  useEffect(() => {
    getProviders()
      .then(res => setProviders(res.providers))
      .catch(err => showToast(`Providers Error: ${err.message}`, 'error'));

    getCommunities()
      .then(res => setAllCommunities(res.communities))
      .catch(err => showToast(`Communities Error: ${err.message}`, 'error'));

    getEvents().then(res => setEvents(res.events || [])).catch(() => {});
  }, []);

  const isJoined = (c) => c.user_joined || user?.joined_communities?.includes(c.id);
  const communities = allCommunities.filter(c => !isJoined(c)).slice(0, 4);
  const joinedCircles = allCommunities.filter(isJoined);

  const alertText = user?.location_neighborhood
    ? NEIGHBOURHOOD_ALERTS[user.location_neighborhood]
    : null;

  const handleJoin = async (id) => {
    try {
      const res = await joinCommunity(id);
      showToast('Joined!', 'success');
      setAllCommunities(prev => prev.map(c =>
        c.id === id ? { ...c, user_joined: true, member_count: res.member_count } : c
      ));
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
    } catch (err) {
      showToast('Already a member');
    }
  };

  // Pilot partner (is_featured, e.g. Kuriftu) always leads; rating breaks ties
  const featured = [...providers]
    .sort((a, b) => (Number(b.is_featured) - Number(a.is_featured)) || b.rating - a.rating)
    .slice(0, 5);
  const topProvider = featured[0];

  return (
    <div className="page" id="home-screen">
      {/* Greeting + Points */}
      <div className="flex items-center justify-between mb-20">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
            Hey, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {t('Your wellness journey awaits')}
          </p>
        </div>
        {user && (
          <div className="flex items-center gap-8">
            <StreakBadge
              streak={user.current_streak}
              freezeCount={user.freeze_count}
              atRisk={joinedCircles.length > 0 && joinedCircles.every(c => !c.checked_in_today)}
            />
            <PointsBadge points={user.points_balance || 0} onClick={() => setShowPointsInfo(true)} />
          </div>
        )}
      </div>

      {/* One-time post-onboarding moment: plan reflection + welcome gift */}
      {user && justOnboarded && <WelcomeBanner user={user} providers={providers} />}

      {/* Experiment: persistent promo banner (test arm only) — suppressed
          right after onboarding so WelcomeBanner's welcome gift isn't
          duplicated on the same screen. */}
      {user && <HomePromoBanner providers={providers} suppressed={justOnboarded} />}

      {user && <SocialProofBanner />}

      {/* Daily habit trigger — check in without leaving Home */}
      {user && joinedCircles.length > 0 && (
        <CheckinCard
          key={joinedCircles.map(c => c.id).join(',')}
          circles={joinedCircles}
          onChecked={(id) => setAllCommunities(prev =>
            prev.map(c => c.id === id ? { ...c, checked_in_today: true } : c)
          )}
        />
      )}

      {user && <FirstRewardCard pointsBalance={user.points_balance || 0} />}

      {/* Neighbourhood Alert */}
      {alertText && !alertDismissed && (
        <div className="alert-banner" id="neighbourhood-alert">
          <span className="alert-banner-icon"><Icon name="map-pin" size={18} /></span>
          <span className="alert-banner-text">{alertText}</span>
          <button className="alert-banner-close" onClick={() => setAlertDismissed(true)} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {user && <NearYouSection user={user} providers={providers} events={events} />}

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
            <div
              className="image-card-overlay"
              style={{
              position: 'absolute', inset: 0,
              padding: 18,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="inline-icon-text" style={{ fontSize: '0.85rem' }}><Icon name="star" size={14} /> {topProvider.rating}</span>
                  <span className={`category-badge ${topProvider.category}`}>{topProvider.category}</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{topProvider.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span className="inline-icon-text"><Icon name="map-pin" size={12} /> {topProvider.location_text?.split(',')[0]}</span> · {topProvider.price_range}
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
              {t('Book Now')}
            </button>
          </div>
        </div>
      )}

      <FeaturedEventsCarousel title={t('Happening Soon')} />

      {/* Featured Providers */}
      <div className="section-header">
        <h2 className="section-title">{t('Featured Providers')}</h2>
        <button className="section-action inline-icon-text" onClick={() => navigate('/explore')}>{t('See all')} <Icon name="chevron-right" size={14} /></button>
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
            <h2 className="section-title">{t('Join a Circle')}</h2>
            <button className="section-action inline-icon-text" onClick={() => navigate('/community')}>{t('Browse')} <Icon name="chevron-right" size={14} /></button>
          </div>
          <div className="flex-col gap-12">
            {communities.slice(0, 3).map(c => (
              <CommunityCard key={c.id} community={c} onJoin={handleJoin} />
            ))}
          </div>
        </>
      )}

      <AskWellCircle />

      {showPointsInfo && <PointsInfoSheet onClose={() => setShowPointsInfo(false)} />}
    </div>
  );
}
