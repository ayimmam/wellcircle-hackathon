import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import {
  applyForPaidCircle, getCircleRevenue, getCircleSubscriptionStatus, getCircles,
  getCircleLeaderboard, getPendingSubscriptions, joinCircle, reviewSubscription,
  subscribeToCircle, uploadFile,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import PostFeed from '../components/PostFeed';
import Leaderboard from '../components/Leaderboard';
import { showToast } from '../components/Toast';
import { MOCK_CIRCLES, MOCK_LEADERBOARD } from '../data/mock';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { shareCircleInvite } from '../utils/circleInvite';

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

  useEffect(() => {
    loadCircle();
  }, [id]);

  const loadCircle = async () => {
    try {
      // Find circle details from mock or API
      const found = MOCK_CIRCLES.find(c => c.id === id);
      setCircle(found || { id, name: 'Circle', description: '', member_count: 0 });

      const [res, circlesResult, subscriptionResult] = await Promise.allSettled([
        getCircleLeaderboard(id),
        getCircles(),
        getCircleSubscriptionStatus(id),
      ]);
      const leaderboardResult = res.status === 'fulfilled' ? res.value : { leaderboard: [] };
      setLeaderboard(leaderboardResult.leaderboard || []);

      // Fetch the real circle (name/description/member_count/join_code) from
      // the live list — previously this only merged join_code, so a real
      // (non-mock) circle always displayed the generic 'Circle' fallback name.
      try {
        const circlesRes = circlesResult.status === 'fulfilled' ? circlesResult.value : { circles: [] };
        const match = (circlesRes.circles || []).find(c => c.id === id);
        if (match) {
          setJoined(Boolean(match.is_joined));
          setCircle(prev => ({
            ...prev,
            name: match.name || prev.name,
            description: match.description ?? prev.description,
            member_count: match.member_count ?? prev.member_count,
            ...match,
          }));
        }
      } catch { /* invite link is a bonus, not required for the page to work */ }
      try {
        const status = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value : null;
        if (status?.status) setSubscription(status);
      } catch { /* free circles and not-yet-supported backends may omit this */ }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    try {
      await joinCircle(id, joinCode);
      setJoined(true);
      setJustJoined(true);
      setActiveTab('chat');
      showToast('You joined the circle!', 'success');
      if (circle) setCircle(prev => ({ ...prev, member_count: (prev.member_count || 0) + 1 }));
    } catch (err) {
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

  const isOwner = circle.owner_id === user?.id || circle.is_owner;
  const tabs = [
    { key: 'chat', label: 'Activity', icon: 'message-circle' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { key: 'members', label: 'Members', icon: 'users' },
    ...(isOwner && (circle.is_paid || circle.paid_circle_status === 'approved')
      ? [{ key: 'revenue', label: 'Revenue', icon: 'chart' }]
      : []),
  ];

  return (
    <div className="page" id="circle-detail-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-12">
        {!nativeBack && (
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}>
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
            {circle.owner_is_verified && <span className="verified-badge">✓ Verified owner</span>}
            {circle.paid_circle_status === 'pending_approval' && <span className="status-badge pending">Monetization pending</span>}
          </div>
        </div>
        <div className="points-chip" style={{ background: 'var(--bg-card)' }}>
          <Icon name="users" size={14} />
          <span style={{ color: 'var(--text-primary)' }}>{circle.member_count}</span>
        </div>
      </div>

      {/* Join / Joined + Invite */}
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

      {activeTab === 'leaderboard' && (
        <div className="leaderboard">
          {leaderboard.length > 0 ? (
            <div className="feed">
              {leaderboard.map((member, idx) => (
                <div
                  key={member.user_id}
                  className={`cell leaderboard-row ${idx === 0 ? 'leader' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/users/${member.user_id}`)}
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

      {activeTab === 'members' && (
        <div className="feed">
          {leaderboard.length > 0 ? leaderboard.map(member => (
            <div key={member.user_id} className="cell" style={{ cursor: 'pointer' }} onClick={() => navigate(`/users/${member.user_id}`)}>
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
            <input className="input" type="number" min="1" max="10000" value={price} onChange={event => setPrice(event.target.value)} placeholder="Monthly price in ETB" />
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
