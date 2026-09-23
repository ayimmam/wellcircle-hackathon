import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeBootstrap, getHomeLite, getForYouFeed, deleteStory, markStoryViewed, createPost, uploadFile, cacheKeys } from '../api/client';
import useResource from '../hooks/useResource';
import { logIssue } from '../utils/log';
import useDailyReveal from '../hooks/useDailyReveal';
import useStoryUpload from '../hooks/useStoryUpload';
import { compressImage } from '../utils/imageCompress';
import PointsBadge from '../components/PointsBadge';
import StreakBadge from '../components/StreakBadge';
import FirstRewardCard from '../components/FirstRewardCard';
import SocialProofBanner from '../components/SocialProofBanner';
import WelcomeBanner from '../components/WelcomeBanner';
import CheckinCard from '../components/CheckinCard';
import PostComposerFab from '../components/PostComposerFab';
import PointsInfoSheet from '../components/PointsInfoSheet';
import FeedPostCard from '../components/feed/FeedPostCard';
import FeedServiceCard from '../components/feed/FeedServiceCard';
import FeedEventBanner from '../components/feed/FeedEventBanner';
import FeedPastEventCard from '../components/feed/FeedPastEventCard';
import FeedProviderCard from '../components/feed/FeedProviderCard';
import ShareCard from '../components/ShareCard';
import StoryRail from '../components/stories/StoryRail';
import { showToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { daysSinceJoin } from '../utils/milestones';
import { partitionByImage, postHasImage, eventHasImage } from '../utils/feedOrdering';

// Bumping the suffix (v1 -> v2) would re-show the card to everyone once —
// only do that intentionally.
const JOIN_CARD_SEEN_KEY = 'wc_join_card_seen_v1';

function FeedItem({ item, priority, onRetryPost, onDiscardPost }) {
  switch (item.type) {
    case 'post': return <FeedPostCard item={item} priority={priority} onRetry={onRetryPost} onDiscard={onDiscardPost} />;
    case 'service': return <FeedServiceCard item={item} priority={priority} />;
    case 'event': return <FeedEventBanner item={item} priority={priority} />;
    case 'past_event': return <FeedPastEventCard item={item} priority={priority} />;
    case 'provider': return <FeedProviderCard item={item} priority={priority} />;
    default: return null;
  }
}

export default function ForYouScreen() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const justOnboarded = Boolean(location.state?.justOnboarded);
  // The check-in card waits 2 minutes of foreground time before it appears,
  // once per day (WS4) — it's a daily habit prompt, not the first thing a
  // reopened app should nag about.
  const showCheckin = useDailyReveal('checkin');

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

  // Two requests, fired together, painted in whichever order they land.
  //
  // `home` is the whole screen — providers, events, the full feed — and it
  // also seeds Explore and the circles tab so those open without a request of
  // their own. But it cannot answer until the provider directory and the
  // upcoming- and past-event queries are done, which on a cold serverless
  // function is seconds of skeleton. `lite` carries the parts that are only
  // words (the post stream, the user's own circles); it answers from one
  // keyset query, so the screen is readable long before the provider cards
  // exist.
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
    // Silent here too, same reasoning as `lite` above: a background load
    // failing is not the reader's problem to be told about mid-scroll — the
    // screen just keeps showing whatever it last had. Logged, not toasted.
    { onError: err => logIssue('home_bootstrap_failed', { message: err?.message }) },
  );

  // Prefer the full payload wherever it has arrived; fall back to the lite one
  // until it does. `home` is undefined (not an empty shape) before it lands,
  // so these are genuine "has the data arrived" checks.
  const isJoined = (c) => c.user_joined || user?.joined_communities?.includes(c.id);
  // lite's list is already joined-only; the filter is what makes the full
  // list — which carries every circle — agree with it.
  const joinedCircles = (home?.communities || lite?.communities || []).filter(isJoined);

  // Stories ride in on both home payloads (see api/home.py) so the rail is
  // painted by the lite response, before any provider work has finished —
  // it's the first thing on the screen and must not wait for the last thing.
  const storyGroups = home?.stories || lite?.stories || [];

  // Seen state is server-side, but the ring has to dim the moment the story is
  // played rather than on the next fetch — so the receipt is fired and the
  // local copy is updated at the same time.
  const markSeenLocally = (storyId) => (prev) => {
    if (!prev?.stories) return prev;
    return {
      ...prev,
      stories: prev.stories.map(group => {
        if (!group.stories.some(s => s.id === storyId)) return group;
        const stories = group.stories.map(s => s.id === storyId ? { ...s, seen: true } : s);
        return { ...group, stories, has_unseen: stories.some(s => !s.seen) };
      }),
    };
  };

  const handleStoryViewed = (storyId) => {
    setHome(markSeenLocally(storyId));
    setLite(markSeenLocally(storyId));
    // Fire-and-forget: a lost receipt costs a re-lit ring, not correctness.
    markStoryViewed(storyId).catch(() => {});
  };

  const dropStoryLocally = (storyId) => (prev) => {
    if (!prev?.stories) return prev;
    return {
      ...prev,
      stories: prev.stories
        .map(group => ({ ...group, stories: group.stories.filter(s => s.id !== storyId) }))
        .filter(group => group.stories.length > 0),
    };
  };

  const handleStoryDeleted = async (storyId) => {
    setHome(dropStoryLocally(storyId));
    setLite(dropStoryLocally(storyId));
    try {
      await deleteStory(storyId);
    } catch (err) {
      showToast(err.message || 'Could not delete that story', 'error');
    }
  };

  // Optimistic story posting (WS1): a picked photo shows in "Your story"
  // immediately via a local blob URL, with a progress arc while it uploads,
  // and either swaps for the real story or turns into a "tap to retry" ring.
  const addPendingStoryLocally = (tempId, localUrl) => (prev) => {
    if (!prev || !user) return prev;
    const groups = prev.stories || [];
    const pendingStory = {
      id: tempId, user_id: user.id, user_name: user.name, user_photo_url: user.photo_url,
      image_url: localUrl, created_at: new Date().toISOString(), seen: true, view_count: null,
      is_mine: true, is_following: false, pending: true, progress: 0,
    };
    const mineIdx = groups.findIndex(g => g.is_mine);
    const nextGroups = mineIdx === -1
      ? [{
        user_id: user.id, user_name: user.name, user_photo_url: user.photo_url,
        is_mine: true, is_following: false, has_unseen: false,
        story_count: 1, latest_at: pendingStory.created_at, stories: [pendingStory],
      }, ...groups]
      : groups.map((g, i) => i === mineIdx ? { ...g, stories: [...g.stories, pendingStory] } : g);
    return { ...prev, stories: nextGroups };
  };

  const patchOwnStory = (tempId, patch) => (prev) => {
    if (!prev?.stories) return prev;
    return {
      ...prev,
      stories: prev.stories.map(g => !g.is_mine ? g : {
        ...g,
        stories: g.stories.map(s => s.id === tempId ? { ...s, ...patch } : s),
      }),
    };
  };

  const { upload: uploadStory, retry: retryStory } = useStoryUpload({
    onPending: ({ tempId, localUrl }) => {
      setHome(addPendingStoryLocally(tempId, localUrl));
      setLite(addPendingStoryLocally(tempId, localUrl));
    },
    onProgress: (tempId, pct) => {
      setHome(patchOwnStory(tempId, { progress: pct }));
      setLite(patchOwnStory(tempId, { progress: pct }));
    },
    onSuccess: (tempId, story) => {
      const patch = { id: story.id, image_url: story.image_url, pending: false, failed: false, progress: 100 };
      setHome(patchOwnStory(tempId, patch));
      setLite(patchOwnStory(tempId, patch));
      if (typeof story.points_balance === 'number') {
        setUser(prev => prev ? { ...prev, points_balance: story.points_balance } : prev);
      }
    },
    onFailure: (tempId) => {
      setHome(patchOwnStory(tempId, { pending: false, failed: true }));
      setLite(patchOwnStory(tempId, { pending: false, failed: true }));
      showToast("Story didn't post — tap to retry", 'error');
    },
  });

  const storyFileInputRef = useRef(null);
  const handleStoryFilePicked = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadStory(file);
  };

  // Optimistic standalone posting (WS2): the "+" composer's submit is
  // instant — the card appears at the top of the feed before either the
  // photo upload or the create request has even started. Kept payloads by
  // tempId so a failed post's Retry doesn't need the composer reopened.
  const pendingPostsRef = useRef({});
  const nextTempPostIdRef = useRef(0);

  const patchFeedItems = (fn) => (prev) => {
    if (!prev?.feed) return prev;
    return { ...prev, feed: { ...prev.feed, items: fn(prev.feed.items || []) } };
  };

  const insertPost = async (tempId) => {
    const payload = pendingPostsRef.current[tempId];
    if (!payload || !user) return;
    const { content, file } = payload;

    try {
      let photo_url;
      if (file) {
        const compressed = await compressImage(file, { maxBytes: 2_000_000 });
        const asset = await uploadFile(compressed, 'posts');
        photo_url = asset.url;
      }
      const res = await createPost({ content, photo_url });
      delete pendingPostsRef.current[tempId];
      setHome(patchFeedItems(items => items.map(it => it.id !== tempId ? it : {
        ...it, id: res.id, pending: false, failed: false,
        post: { ...it.post, id: res.id, photo_url: photo_url || it.post.photo_url },
      })));
      setLite(patchFeedItems(items => items.map(it => it.id !== tempId ? it : {
        ...it, id: res.id, pending: false, failed: false,
        post: { ...it.post, id: res.id, photo_url: photo_url || it.post.photo_url },
      })));
      if (typeof res.points_balance === 'number') {
        setUser(prev => prev ? { ...prev, points_balance: res.points_balance } : prev);
      }
    } catch (err) {
      const markFailed = (items) => items.map(it => it.id === tempId ? { ...it, pending: false, failed: true } : it);
      setHome(patchFeedItems(markFailed));
      setLite(patchFeedItems(markFailed));
      showToast(err.message || 'Could not post that update', 'error');
    }
  };

  const handleNewPost = ({ content, file, localPreviewUrl }) => {
    if (!user) return;
    const tempId = `temp-post-${++nextTempPostIdRef.current}`;
    pendingPostsRef.current[tempId] = { content, file };

    const optimisticItem = {
      type: 'post',
      render_cost: file ? 'media' : 'instant',
      id: tempId,
      created_at: new Date().toISOString(),
      pending: true,
      post: {
        id: tempId,
        content,
        is_system_event: false,
        activity_type: null,
        distance_km: null,
        duration_min: null,
        photo_url: localPreviewUrl,
        user: { id: user.id, name: user.name, photo_url: user.photo_url },
        created_at: new Date().toISOString(),
        reactions: {},
        total_points_gifted: 0,
        comment_count: 0,
        source: null,
      },
    };

    setHome(patchFeedItems(items => [optimisticItem, ...items]));
    setLite(patchFeedItems(items => [optimisticItem, ...items]));
    insertPost(tempId);
  };

  const handleRetryPost = (tempId) => {
    if (!pendingPostsRef.current[tempId]) return;
    setHome(patchFeedItems(items => items.map(it => it.id === tempId ? { ...it, pending: true, failed: false } : it)));
    setLite(patchFeedItems(items => items.map(it => it.id === tempId ? { ...it, pending: true, failed: false } : it)));
    insertPost(tempId);
  };

  const handleDiscardPost = (tempId) => {
    delete pendingPostsRef.current[tempId];
    setHome(patchFeedItems(items => items.filter(it => it.id !== tempId)));
    setLite(patchFeedItems(items => items.filter(it => it.id !== tempId)));
  };

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

  // Image-led readiness ranking (WS3 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md):
  // until the revalidated bootstrap lands — on the cached first paint, and
  // through the lite phase — items with an image render above text-only ones,
  // matching the order the settled server response will already be in. Then
  // the feed settles into server order, with no animation on the swap: a
  // visible reflow is worse than the delay.
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
    // The server leads the feed with this week's events (see feed_service.py),
    // itself image-partitioned. Partition the event lead and the post block
    // that follows it the same way, so nothing visibly reshuffles on settle.
    // Only the *lead* block is events — the coming-soon events sit below the
    // posts and are left in server order, like the provider block after them.
    const leadEnd = firstPageItems.findIndex(i => i.type !== 'event');
    if (leadEnd === -1) return partitionByImage(firstPageItems, eventHasImage);
    const lead = firstPageItems.slice(0, leadEnd);
    const rest = firstPageItems.slice(leadEnd);
    const postEnd = rest.findIndex(i => i.type !== 'post');
    if (postEnd === -1) {
      return [...partitionByImage(lead, eventHasImage), ...partitionByImage(rest, postHasImage)];
    }
    return [
      ...partitionByImage(lead, eventHasImage),
      ...partitionByImage(rest.slice(0, postEnd), postHasImage),
      ...rest.slice(postEnd),
    ];
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

      <input
        ref={storyFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleStoryFilePicked}
        style={{ display: 'none' }}
        id="story-file-input"
      />
      <StoryRail
        groups={storyGroups}
        currentUser={user}
        canAddStory={Boolean(user)}
        onAddStory={() => storyFileInputRef.current?.click()}
        onRetryFailed={retryStory}
        onViewed={handleStoryViewed}
        onDelete={handleStoryDeleted}
      />

      {user && justOnboarded && <WelcomeBanner user={user} providers={home?.providers || []} />}

      {user && <SocialProofBanner />}

      {user && showCheckin && joinedCircles.length > 0 && (
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
            <FeedItem
              key={`${item.type}-${item.id}`}
              item={item}
              priority={i === 0}
              onRetryPost={handleRetryPost}
              onDiscardPost={handleDiscardPost}
            />
          ))}
          <div ref={sentinelRef} style={{ height: 1 }} id="for-you-feed-sentinel" />
          {loadingMore && <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />}
        </div>
      )}

      <PostComposerFab onSubmit={handleNewPost} />

      {showPointsInfo && <PointsInfoSheet onClose={() => setShowPointsInfo(false)} />}
      {joinMilestone && <ShareCard milestone={joinMilestone} onClose={() => setJoinMilestone(null)} />}
    </div>
  );
}
