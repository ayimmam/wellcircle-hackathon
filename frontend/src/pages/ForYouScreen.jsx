import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeBootstrap, getHomeLite, getForYouFeed, cacheKeys } from '../api/client';
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
import FeedProviderCard from '../components/feed/FeedProviderCard';
import { showToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';

function FeedItem({ item, priority }) {
  switch (item.type) {
    case 'post': return <FeedPostCard item={item} priority={priority} />;
    case 'service': return <FeedServiceCard item={item} priority={priority} />;
    case 'event': return <FeedEventBanner item={item} priority={priority} />;
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

  // Two requests, fired together, painted in whichever order they land.
  //
  // `home` is the whole screen — providers, events, the full feed — and it
  // also seeds Explore and the circles tab so those open without a request of
  // their own. But it cannot answer until the provider directory and the event
  // query are done, which on a cold serverless function is seconds of
  // skeleton. `lite` carries the parts that are only words (the post stream,
  // the user's own circles); it answers from one keyset query, so the screen
  // is readable long before the provider cards exist.
  //
  // Both paint from the previous session's copy while they revalidate.
  const { data: lite, setData: setLite } = useResource(
    cacheKeys.homeLite(),
    getHomeLite,
    // Silent on error: this is the head start, not the screen. If it fails the
    // full bootstrap still fills everything in, and two toasts for one outage
    // is one too many.
    { onError: () => {} },
  );
  const { data: home, setData: setHome } = useResource(
    cacheKeys.home(),
    getHomeBootstrap,
    { onError: err => showToast(err.message, 'error') },
  );

  // Prefer the full payload wherever it has arrived; fall back to the lite one
  // until it does. `home` is undefined (not an empty shape) before it lands,
  // so these are genuine "has the data arrived" checks.
  const isJoined = (c) => c.user_joined || user?.joined_communities?.includes(c.id);
  // lite's list is already joined-only; the filter is what makes the full
  // list — which carries every circle — agree with it.
  const joinedCircles = (home?.communities || lite?.communities || []).filter(isJoined);

  const markCheckedIn = (id) => (prev) => (
    prev?.communities
      ? {
        ...prev,
        communities: prev.communities.map(c => c.id === id ? { ...c, checked_in_today: true } : c),
      }
      : prev
  );
  // Whichever payload is on screen owns the card, and the other one will be
  // swapped in moments later — so both have to record the check-in.
  const setCheckedIn = (id) => {
    setHome(markCheckedIn(id));
    setLite(markCheckedIn(id));
  };

  // Instant-open readiness ranking (Phase 2): until the revalidated bootstrap
  // lands — on the cached first paint, and through the lite phase — "instant"
  // items (no image needed to read) render above "media" items. Then the feed
  // settles into server order, with no animation on the swap: a visible
  // reflow is worse than the delay.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let alive = true;
    // getHomeBootstrap() dedups against the in-flight/cached request the
    // useResource call above already triggered — this doesn't add a request.
    getHomeBootstrap().then(() => { if (alive) setSettled(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // The full feed the moment it exists, the text-only one until then.
  const feed = home?.feed || lite?.feed || null;
  const firstPageItems = feed?.items || [];
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
  // Both payloads derive this cursor from the same posts query, so it stays
  // valid across the lite → full swap.
  const cursorRef = useRef(feed?.next_before ?? null);
  useEffect(() => {
    if (olderItems.length === 0) cursorRef.current = feed?.next_before ?? null;
  }, [feed?.next_before, olderItems.length]);

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
  // presence, not on the resource's `loading` flag (Phase 2). The lite payload
  // counts as presence, so the skeleton only survives until the *first* of the
  // two requests answers.
  const showSkeleton = feedItems.length === 0 && !feed;

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
    </div>
  );
}
