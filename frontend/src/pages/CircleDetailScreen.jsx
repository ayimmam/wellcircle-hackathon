import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import {
  applyForPaidCircle, getCircleRevenue, getCircleSubscriptionStatus, getCircle,
  getCircleLeaderboard, getCircleStories, getPendingSubscriptions, joinCircle,
  reviewSubscription, setCircleBanner, subscribeToCircle, uploadFile,
  deleteStory, markStoryViewed,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import PostFeed from '../components/PostFeed';
import ReadOnlyPostFeed from '../components/ReadOnlyPostFeed';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { shareCircleInvite } from '../utils/circleInvite';
import { clickableDivProps } from '../utils/a11y';
import useDismissOnEscape from '../hooks/useDismissOnEscape';
import StoryRail from '../components/stories/StoryRail';
import StoryComposer from '../components/stories/StoryComposer';

export default function CircleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  const { user } = useAuth();

  const [circle, setCircle] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [revenue, setRevenue] = useState(null);
  const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
  const [monetizeOpen, setMonetizeOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'leaderboard' | 'members'
  // Right after joining, land on Activity with a friendly intro pre-filled —
  // one less blank-page moment for a brand-new member.
  const [justJoined, setJustJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [stories, setStories] = useState([]);
  const [bannerBusy, setBannerBusy] = useState(false);
  const bannerInputRef = useRef(null);

  useDismissOnEscape(() => setShowSubscribe(false), showSubscribe);
  useDismissOnEscape(() => setMonetizeOpen(false), monetizeOpen);

  useEffect(() => {
    loadCircle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadCircle = async () => {
    setLoading(true);
    try {
      const detail = await getCircle(id);
      setCircle(detail);
      setJoined(Boolean(detail.is_joined));

      if (detail.is_paid) {
        try {
          const status = await getCircleSubscriptionStatus(id);
          if (status?.subscription?.status) setSubscription(status.subscription);
        } catch { /* free circles and not-yet-supported backends may omit this */ }
      }
      if (detail.is_joined) {
        try {
          const lb = await getCircleLeaderboard(id);
          setLeaderboard(lb.leaderboard || []);
        } catch { /* leaderboard is a bonus, not required for the page to work */ }
        loadStories();
      }
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stories are member-only, so this is never called in preview mode. Failures
  // are swallowed for the same reason the leaderboard's are: an empty rail is a
  // better outcome than a screen that won't render.
  const loadStories = async () => {
    try {
      const res = await getCircleStories(id);
      setStories(res.stories || []);
    } catch { /* non-fatal */ }
  };

  // The circle rail groups by author too, so one member posting three photos
  // is one ring — same shape the For You rail renders.
  const storyGroups = groupByAuthor(stories, user?.id);

  const handleStoryViewed = (storyId) => {
    setStories(current => current.map(s => s.id === storyId ? { ...s, seen: true } : s));
    markStoryViewed(storyId).catch(() => {});
  };

  const handleStoryDeleted = async (storyId) => {
    setStories(current => current.filter(s => s.id !== storyId));
    try {
      await deleteStory(storyId);
    } catch (err) {
      showToast(err.message || 'Could not delete that story', 'error');
      loadStories();
    }
  };

  const handleBanner = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBannerBusy(true);
    try {
      const asset = await uploadFile(file, 'circle_banners');
      await setCircleBanner(id, { banner_url: asset.url, banner_public_id: asset.public_id });
      setCircle(current => ({ ...current, banner_url: asset.url }));
      showToast('Banner updated', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update the banner', 'error');
    } finally {
      setBannerBusy(false);
    }
  };

  // E1: invite via Telegram-native sharing (shared with the onboarding
  // circles step — see utils/circleInvite.js).
  const handleInvite = () => shareCircleInvite(circle, { source: 'circle_detail' });

  const handleJoin = async () => {
    if (joining) return;
    let joinCode = null;
    if (circle?.is_private) {
      joinCode = prompt('This circle is private. Please enter the invitation code:');
      if (!joinCode) return;
    }
    setJoining(true);

    // Optimistic UI Update
    setJoined(true);
    if (circle) setCircle(prev => ({ ...prev, member_count: (prev.member_count || 0) + 1 }));

    try {
      await joinCircle(id, joinCode);
      setJustJoined(true);
      setActiveTab('chat');
      showToast('You joined the circle!', 'success');
      // Flip from preview to full mode in place — no navigation — and pull
      // the real leaderboard now that membership unlocks it.
      try {
        const lb = await getCircleLeaderboard(id);
        setLeaderboard(lb.leaderboard || []);
      } catch { /* non-fatal */ }
    } catch (err) {
      // Revert optimistic updates
      setJoined(false);
      if (circle) setCircle(prev => ({ ...prev, member_count: Math.max(0, (prev.member_count || 1) - 1) }));

      if (err.status === 402) {
        setCircle(current => ({
          ...current,
          is_paid: true,
          price_etb: err.payload?.price_etb ?? current?.price_etb,
        }));
        setShowSubscribe(true);
        showToast('Upload a payment receipt to subscribe', 'error');
      } else {
        showToast(err.message || 'Error joining', 'error');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleReceipt = async (file) => {
    if (!file) return;
    setSubscriptionBusy(true);
    try {
      const uploaded = await uploadFile(file, 'receipts');
      setReceipt({ ...uploaded, name: file.name });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const submitSubscription = async () => {
    setSubscriptionBusy(true);
    try {
      const result = await subscribeToCircle(id, receipt.url, receipt.public_id);
      setSubscription(result);
      setShowSubscribe(false);
      showToast('Receipt submitted — awaiting approval', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const loadRevenue = async () => {
    try {
      const [stats, pending] = await Promise.all([getCircleRevenue(id), getPendingSubscriptions(id)]);
      setRevenue(stats);
      setPendingSubscriptions(pending.subscriptions || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReviewSubscription = async (item, action) => {
    try {
      await reviewSubscription(item.id, action);
      setPendingSubscriptions(current => current.filter(entry => entry.id !== item.id));
      loadRevenue();
      showToast(`Receipt ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const applyPaid = async () => {
    const amount = Number(price);
    if (!amount || amount < 1 || amount > 10000) return showToast('Enter a monthly price from ETB 1–10,000', 'error');
    try {
      const updated = await applyForPaidCircle(id, amount);
      setCircle(current => ({ ...current, ...updated, price_etb: amount, paid_circle_status: 'pending_approval' }));
      setMonetizeOpen(false);
      showToast('Paid-circle application submitted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (notFound) {
    return (
      <div className="page" id="circle-detail-screen">
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="lock" size={40} /></div>
          <div className="empty-state-text">This circle isn't available.</div>
        </div>
      </div>
    );
  }

  if (loading || !circle) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  const isOwner = Boolean(circle.is_owner);
  // Preview mode: a public, free circle the caller hasn't joined. Private
  // non-members never reach this screen (404 above); paid non-subscribers
  // use the existing subscribe flow instead.
  const previewMode = !joined && !circle.is_paid;

  const tabs = [
    { key: 'chat', label: 'Activity', icon: 'message-circle' },
    ...(previewMode ? [] : [
      { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
      { key: 'members', label: 'Members', icon: 'users' },
    ]),
    ...(isOwner && (circle.is_paid || circle.paid_circle_status === 'approved')
      ? [{ key: 'revenue', label: 'Revenue', icon: 'chart' }]
      : []),
  ];

  return (
    <div className="page" id="circle-detail-screen" style={previewMode ? { paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 76px)' } : undefined}>
      {/* Banner — owner-editable cover. Rendered only when there is an image
          or the viewer can add one, so a bannerless circle for a non-owner
          costs no empty box. */}
      {(circle.banner_url || isOwner) && (
        <div className="circle-banner" id="circle-banner">
          <SmartImage
            src={circle.banner_url}
            alt=""
            width={720}
            priority
            fallback={
              <div className="flex items-center justify-center" style={{ height: '100%', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {isOwner ? 'Add a banner for this circle' : null}
              </div>
            }
          />
          {isOwner && (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBanner}
                style={{ display: 'none' }}
                data-testid="circle-banner-input"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm circle-banner-edit flex items-center gap-6"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerBusy}
                id="circle-banner-edit"
              >
                {bannerBusy
                  ? <span className="btn-spinner" aria-hidden="true" />
                  : <Icon name="pencil" size={13} />}
                {circle.banner_url ? 'Change' : 'Add banner'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-12 mb-12">
        {!nativeBack && (
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Back">
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 className="flex items-center gap-6" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {circle.is_private && <Icon name="lock" size={16} />}
            {circle.name}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {circle.description}
          </p>
          <div className="flex gap-8 mt-8 flex-wrap">
            {circle.is_paid && <span className="paid-circle-badge">ETB {circle.price_etb}/month</span>}
            {(circle.owner?.is_verified_trainer || circle.owner_is_verified) && <span className="verified-badge">✓ Verified owner</span>}
            {circle.paid_circle_status === 'pending_approval' && <span className="status-badge pending">Monetization pending</span>}
          </div>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <Icon name="users" size={14} />
          <span style={{ color: 'var(--text-primary)' }}>{circle.member_count}</span>
        </div>
      </div>

      {/* Join / Joined + Invite — the inline row for the paid-subscribe flow;
          preview mode uses the sticky bottom CTA instead. */}
      {!previewMode && (
        <div className="flex gap-8 mb-16">
          {joined ? (
            <div className="btn btn-secondary flex items-center justify-center gap-6" style={{ flex: 1, cursor: 'default', opacity: 0.7 }}>
              <Icon name="check" size={16} /> You're a member
            </div>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={circle.is_paid ? () => setShowSubscribe(true) : handleJoin} disabled={joining || subscription?.status === 'pending_approval'}>
              {joining && <span className="btn-spinner" aria-hidden="true" />}
              {subscription?.status === 'pending_approval' ? 'Receipt awaiting approval' : circle.is_paid ? `Subscribe (ETB ${circle.price_etb}/mo)` : 'Join Circle'}
            </button>
          )}
          {joined && circle.join_code && (
            <button className="btn btn-secondary flex items-center justify-center gap-6" style={{ flex: 1 }} onClick={handleInvite}>
              <Icon name="send" size={15} /> Invite friends
            </button>
          )}
        </div>
      )}

      {/* Stories — members only, and the composer only when this member can
          actually post into the circle. */}
      {joined && (
        <>
          <StoryRail
            groups={storyGroups}
            currentUser={user}
            canAddStory
            onAddStory={() => document.getElementById('story-composer-btn')?.click()}
            onViewed={handleStoryViewed}
            onDelete={handleStoryDeleted}
          />
          <div className="mb-16">
            <StoryComposer
              circleId={id}
              onPosted={loadStories}
              label={storyGroups.length ? 'Add to story' : 'Post the first story'}
              className="btn-sm"
            />
          </div>
        </>
      )}

      {subscription?.status && !joined && (
        <div className="profile-card mb-16">
          <span className={`status-badge ${subscription.status === 'active' ? 'success' : subscription.status === 'rejected' ? 'failed' : 'pending'}`}>
            Subscription: {subscription.status.replaceAll('_', ' ')}
          </span>
          {subscription.status === 'active' && <button className="btn btn-primary btn-sm" onClick={handleJoin}>Enter circle</button>}
          {(subscription.status === 'expired' || subscription.status === 'rejected') && <button className="btn btn-primary btn-sm" onClick={() => setShowSubscribe(true)}>Submit a new receipt</button>}
        </div>
      )}

      {isOwner && !circle.is_paid && circle.paid_circle_status === 'free' && (
        <div className="profile-card mb-16">
          <strong>Monetize this circle</strong>
          <p className="text-sm text-secondary mt-8">{circle.member_count >= 100 ? 'This circle meets the 100-member requirement. Owners also need 1,000 lifetime points.' : `${100 - circle.member_count} more members needed before applying.`}</p>
          <button className="btn btn-secondary btn-sm mt-12" disabled={circle.member_count < 100} onClick={() => setMonetizeOpen(true)}>Apply for paid status</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-8 mb-16" style={{ overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`chip flex items-center gap-6 ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); if (t.key === 'revenue') loadRevenue(); }}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        joined ? (
          <PostFeed
            circleId={id}
            initialDraft={justJoined ? `Hi I'm ${user?.name?.split(' ')[0] || 'there'}, I'm glad to join you guys!` : undefined}
            onDraftConsumed={() => setJustJoined(false)}
          />
        ) : previewMode ? (
          <ReadOnlyPostFeed posts={circle.preview_posts} id="circle-preview-feed" />
        ) : (
          <div className="card">
            <div className="card-body text-center" style={{ padding: '32px 16px' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icon name="lock" size={40} /></div>
              <h3 className="card-title mb-8">Join to participate</h3>
              <p className="text-secondary text-sm">You need to join this circle to view and participate in the chat.</p>
            </div>
          </div>
        )
      )}

      {activeTab === 'leaderboard' && !previewMode && (
        <div className="leaderboard">
          {leaderboard.length > 0 ? (
            <div className="feed">
              {leaderboard.map((member, idx) => (
                <div
                  key={member.user_id}
                  className={`cell leaderboard-row ${idx === 0 ? 'leader' : ''}`}
                  style={{ cursor: 'pointer' }}
                  aria-label={member.name}
                  {...clickableDivProps(() => navigate(`/users/${member.user_id}`))}
                >
                  <div className={`cell-rank ${idx < 3 ? 'top' : ''}`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  <div className="avatar avatar-md">
                    <SmartImage src={member.photo_url} width={36} fallback={<Icon name="user" size={16} />} />
                  </div>
                  <div className="cell-body">
                    <div className="cell-title">{member.name}</div>
                    <div className="cell-subtitle">{member.total_points} total pts</div>
                  </div>
                  <div className="cell-trailing">
                    {member.weekly_points}
                    <div className="cell-trailing-sub">this week</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="trophy" size={32} /></div>
              <div className="empty-state-text">No leaderboard yet. Start checking in!</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && !previewMode && (
        <div className="feed">
          {leaderboard.length > 0 ? leaderboard.map(member => (
            <div key={member.user_id} className="cell" style={{ cursor: 'pointer' }} aria-label={member.name} {...clickableDivProps(() => navigate(`/users/${member.user_id}`))}>
              <div className="avatar avatar-lg">
                <SmartImage src={member.photo_url} width={40} fallback={<Icon name="user" size={18} />} />
              </div>
              <div className="cell-body">
                <div className="cell-title">{member.name}</div>
                <div className="cell-subtitle">
                  <Icon name="leaf" size={12} /> {member.total_points} Legacy Points
                </div>
              </div>
              <div className="cell-trailing" style={{ fontSize: '0.8rem' }}>{member.weekly_points} pts/wk</div>
            </div>
          )) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="users" size={32} /></div>
              <div className="empty-state-text">No members to show yet.</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'revenue' && isOwner && (
        <div className="circle-revenue">
          {!revenue ? <div className="skeleton" style={{ height: 180 }} /> : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card accent"><div className="kpi-value">ETB {(revenue.creator_earnings_etb || 0).toLocaleString()}</div><div className="kpi-label">Your earnings (95%)</div></div>
                <div className="kpi-card"><div className="kpi-value">{revenue.active_subscribers || 0}</div><div className="kpi-label">Active subscribers</div></div>
                <div className="kpi-card"><div className="kpi-value">ETB {(revenue.platform_fee_etb || 0).toLocaleString()}</div><div className="kpi-label">Platform fee (5%)</div></div>
                <div className="kpi-card"><div className="kpi-value">{pendingSubscriptions.length}</div><div className="kpi-label">Pending receipts</div></div>
              </div>
              <h2 className="section-title mb-12">Receipts to review</h2>
              {pendingSubscriptions.length === 0 ? <p className="text-secondary">No pending receipts.</p> : pendingSubscriptions.map(item => (
                <div className="profile-card mb-12" key={item.id}>
                  <strong>{item.user_name || `Subscriber ${String(item.user_id).slice(0, 8)}`}</strong>
                  {item.user_handle && <span className="text-sm text-secondary"> @{item.user_handle}</span>}
                  <p className="text-sm">ETB {item.amount_etb} · {new Date(item.created_at).toLocaleDateString()}</p>
                  <a className="btn btn-secondary btn-sm mt-8" href={item.receipt_url} target="_blank" rel="noreferrer">View receipt</a>
                  <div className="flex gap-8 mt-8">
                    <button className="btn btn-primary btn-sm" onClick={() => handleReviewSubscription(item, 'approve')}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReviewSubscription(item, 'reject')}>Reject</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sticky bottom Join CTA — preview mode only */}
      {previewMode && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-height) + var(--safe-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 430,
            padding: '12px 16px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border-subtle)',
            zIndex: 90,
          }}
          id="circle-preview-join-bar"
        >
          <button className="btn btn-primary btn-block" onClick={handleJoin} disabled={joining} id="circle-preview-join-btn">
            {joining && <span className="btn-spinner" aria-hidden="true" />}
            Join circle
          </button>
        </div>
      )}

      {showSubscribe && (
        <div className="modal-overlay" onClick={() => setShowSubscribe(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <h2 className="card-title mb-8">Subscribe for ETB {circle.price_etb}/month</h2>
            <p className="text-sm text-secondary mb-16">Pay the circle creator, then upload your receipt for approval.</p>
            <label className="file-drop">
              <input type="file" accept="image/jpeg,image/png" onChange={event => handleReceipt(event.target.files?.[0])} />
              <span>{subscriptionBusy ? 'Uploading…' : receipt ? `✓ ${receipt.name}` : 'Choose receipt image'}</span>
            </label>
            <div className="flex gap-8 mt-16">
              <button className="btn btn-secondary" onClick={() => setShowSubscribe(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!receipt || subscriptionBusy} onClick={submitSubscription}>Submit receipt</button>
            </div>
          </div>
        </div>
      )}

      {monetizeOpen && (
        <div className="modal-overlay" onClick={() => setMonetizeOpen(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <h2 className="card-title mb-8">Set monthly price</h2>
            <p className="text-sm text-secondary mb-12">Well Circle retains 5%; you receive 95% of approved subscriptions.</p>
            <input className="input" type="number" inputMode="numeric" min="1" max="10000" value={price} onChange={event => setPrice(event.target.value)} placeholder="e.g. 500" aria-label="Monthly price in ETB" />
            <div className="flex gap-8 mt-16">
              <button className="btn btn-secondary" onClick={() => setMonetizeOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={applyPaid}>Submit application</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Group a circle's flat story list by author, matching the For You rail's
 * shape and ordering: your own ring first, then anyone with something unseen,
 * then most recent. Kept local because this screen already has the flat list
 * and re-fetching the grouped rail for one circle would be a second request
 * for data it holds.
 */
function groupByAuthor(stories, currentUserId) {
  const groups = new Map();
  for (const story of stories) {
    if (!groups.has(story.user_id)) {
      groups.set(story.user_id, {
        user_id: story.user_id,
        user_name: story.user_name,
        user_photo_url: story.user_photo_url,
        is_mine: story.user_id === currentUserId || Boolean(story.is_mine),
        stories: [],
      });
    }
    groups.get(story.user_id).stories.push(story);
  }
  const result = [...groups.values()];
  for (const group of result) {
    group.has_unseen = group.stories.some(s => !s.seen);
    group.story_count = group.stories.length;
    group.latest_at = group.stories[group.stories.length - 1].created_at;
  }
  result.sort((a, b) => (
    (a.is_mine === b.is_mine ? 0 : a.is_mine ? -1 : 1)
    || (a.has_unseen === b.has_unseen ? 0 : a.has_unseen ? -1 : 1)
    || new Date(b.latest_at) - new Date(a.latest_at)
  ));
  return result;
}
