import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeBootstrap, getForYouFeed, cacheKeys } from '../api/client';
import useResource from '../hooks/useResource';
import PointsBadge from '../components/PointsBadge';
import StreakBadge from '../components/StreakBadge';
import FirstRewardCard from '../components/FirstRewardCard';
import SocialProofBanner from '../components/SocialProofBanner';
import WelcomeBanner from '../components/WelcomeBanner';
import CheckinCard from '../components/CheckinCard';
import AskWellCircle from '../components/AskWellCircle';
import PointsInfoSheet from '../components/PointsInfoSheet';
import FeedPostCard from '../components/feed/FeedPostCard';
import FeedServiceCard from '../components/feed/FeedServiceCard';
import FeedEventBanner from '../components/feed/FeedEventBanner';
import FeedPastEventCard from '../components/feed/FeedPastEventCard';
import FeedProviderCard from '../components/feed/FeedProviderCard';
import ShareCard from '../components/ShareCard';
import { showToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { daysSinceJoin } from '../utils/milestones';

const EMPTY_HOME = { providers: [], communities: [], feed: { items: [], next_before: null } };
// Bumping the suffix (v1 -> v2) would re-show the card to everyone once —
// only do that intentionally.
const JOIN_CARD_SEEN_KEY = 'wc_join_card_seen_v1';

function FeedItem({ item, priority }) {
  switch (item.type) {
    case 'post': return <FeedPostCard item={item} priority={priority} />;
    case 'service': return <FeedServiceCard item={item} priority={priority} />;
    case 'event': return <FeedEventBanner item={item} priority={priority} />;
    case 'past_event': return <FeedPastEventCard item={item} priority={priority} />;
    case 'provider': return <FeedProviderCard item={item} priority={priority} />;
    default: return null;
  }
}

export default function ForYouScreen() {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const justOnboarded = Boolean(location.state?.justOnboarded);

  // "Never show a new user a zero" extended to sharing: everyone — brand new
  // or long-time — gets exactly one shareable "Day N on WellCircle" moment,
  // the first time this screen loads for them.
  const [joinMilestone, setJoinMilestone] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    const key = `${JOIN_CARD_SEEN_KEY}_${user.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setJoinMilestone({ type: 'joined', day: daysSinceJoin(user.created_at) });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // One request for the whole screen, painted from the previous session's
  // copy while it revalidates — this also seeds providers/communities/events
  // so Explore and the circles tab open without a request of their own.
  const { data: home, setData: setHome } = useResource(
    cacheKeys.home(),
    getHomeBootstrap,
    {
      initialData: EMPTY_HOME,
      onError: err => showToast(err.message, 'error'),
    },
  );

  const allCommunities = home?.communities || [];
  const isJoined = (c) => c.user_joined || user?.joined_communities?.includes(c.id);
  const joinedCircles = allCommunities.filter(isJoined);

  const setCheckedIn = (id) => setHome(prev => {
    const base = prev || EMPTY_HOME;
    return {
      ...base,
      communities: (base.communities || []).map(c => c.id === id ? { ...c, checked_in_today: true } : c),
    };
  });

  // Instant-open readiness ranking (Phase 2): on the cached first paint,
  // "instant" items (no image needed to read) render above "media" items.
  // Once the revalidated bootstrap lands, the feed settles into server
  // order — no animation on the swap, a visible reflow is worse than the delay.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let alive = true;
    // getHomeBootstrap() dedups against the in-flight/cached request the
    // useResource call above already triggered — this doesn't add a request.
    getHomeBootstrap().then(() => { if (alive) setSettled(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const firstPageItems = home?.feed?.items || [];
  const orderedFirstPage = useMemo(() => {
    if (settled) return firstPageItems;
    const instant = firstPageItems.filter(i => i.render_cost === 'instant');
    const media = firstPageItems.filter(i => i.render_cost !== 'instant');
    return [...instant, ...media];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPageItems, settled]);

  // Pages beyond the first — appended on scroll, never reordered.
  const [olderItems, setOlderItems] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(home?.feed?.next_before ?? null);
  useEffect(() => {
    if (olderItems.length === 0) cursorRef.current = home?.feed?.next_before ?? null;
  }, [home?.feed?.next_before, olderItems.length]);

  const loadMore = async () => {
    if (loadingMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      const res = await getForYouFeed({ before: cursorRef.current });
      setOlderItems(prev => [...prev, ...(res.items || [])]);
      cursorRef.current = res.next_before;
    } catch {
      // A failed page just means the sentinel stays visible to retry on next scroll.
    } finally {
      setLoadingMore(false);
    }
  };

  const sentinelRef = useRef(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorRef.current]);

  const feedItems = [...orderedFirstPage, ...olderItems];
  // No full-screen skeleton when anything is cached — branch on data
  // presence, not on the resource's `loading` flag (Phase 2).
  const showSkeleton = feedItems.length === 0 && !home?.feed;

  return (
    <div className="page" id="for-you-screen">
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

      {user && justOnboarded && <WelcomeBanner user={user} providers={home?.providers || []} />}

      {user && <SocialProofBanner />}

      {user && joinedCircles.length > 0 && (
        <CheckinCard
          key={joinedCircles.map(c => c.id).join(',')}
          circles={joinedCircles}
          onChecked={setCheckedIn}
        />
      )}

      {user && <FirstRewardCard pointsBalance={user.points_balance || 0} />}

      {showSkeleton ? (
        <div id="for-you-feed-skeleton">
          <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
        </div>
      ) : (
        <div id="for-you-feed">
          {feedItems.map((item, i) => (
            <FeedItem key={`${item.type}-${item.id}`} item={item} priority={i === 0} />
          ))}
          <div ref={sentinelRef} style={{ height: 1 }} id="for-you-feed-sentinel" />
          {loadingMore && <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />}
        </div>
      )}

      <AskWellCircle />

      {showPointsInfo && <PointsInfoSheet onClose={() => setShowPointsInfo(false)} />}
      {joinMilestone && <ShareCard milestone={joinMilestone} onClose={() => setJoinMilestone(null)} />}
    </div>
  );
}
