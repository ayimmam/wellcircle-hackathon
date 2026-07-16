import { useState, useEffect } from 'react';
import { getPosts, createPost, reactToPost, commentOnPost } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';
import Icon from './Icon';

const ACTIVITY_TYPES = ['run', 'walk', 'ride', 'yoga', 'gym', 'swim'];

export default function PostFeed({ communityId, circleId, initialDraft, onDraftConsumed }) {
  const { user, refreshUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState(initialDraft || '');
  const [loading, setLoading] = useState(true);
  const [commentingOnId, setCommentingOnId] = useState(null); // top-level comment box, keyed by post id
  const [commentContent, setCommentContent] = useState('');
  const [replyingToId, setReplyingToId] = useState(null); // reply box, keyed by comment id
  const [replyContent, setReplyContent] = useState('');

  // Activity composer (optional, expandable)
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [activityType, setActivityType] = useState(null);
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    loadPosts();
  }, [communityId, circleId]);

  // Consume the one-time join-intro draft so leaving and returning to this
  // tab later doesn't stomp on whatever the member is typing by then.
  useEffect(() => {
    if (initialDraft && onDraftConsumed) onDraftConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPosts = async () => {
    try {
      const res = await getPosts(communityId, circleId);
      setPosts(res.posts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetComposer = () => {
    setNewPostContent('');
    setShowActivityDetails(false);
    setActivityType(null);
    setDistanceKm('');
    setDurationMin('');
    setPhotoUrl('');
  };

  const handlePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      await createPost({
        content: newPostContent,
        community_id: communityId,
        circle_id: circleId,
        ...(activityType ? { activity_type: activityType } : {}),
        ...(distanceKm ? { distance_km: parseFloat(distanceKm) } : {}),
        ...(durationMin ? { duration_min: parseInt(durationMin, 10) } : {}),
        ...(photoUrl.trim() ? { photo_url: photoUrl.trim() } : {}),
      });
      resetComposer();
      loadPosts();
      showToast('Posted successfully!', 'success');
    } catch (err) {
      showToast('Error posting', 'error');
    }
  };

  const handleComment = async (postId) => {
    if (!commentContent.trim()) return;
    try {
      await commentOnPost(postId, commentContent);
      setCommentContent('');
      setCommentingOnId(null);
      loadPosts();
      showToast('Comment added!', 'success');
    } catch (err) {
      showToast('Error commenting', 'error');
    }
  };

  const handleReply = async (postId, parentCommentId) => {
    if (!replyContent.trim()) return;
    try {
      await commentOnPost(postId, replyContent, parentCommentId);
      setReplyContent('');
      setReplyingToId(null);
      loadPosts();
      showToast('Reply added!', 'success');
    } catch (err) {
      showToast('Error replying', 'error');
    }
  };

  const handleReact = async (postId, emoji, points) => {
    try {
      await reactToPost(postId, { emoji, points_gifted: points });
      showToast(`Reacted${points ? ' and gifted ' + points + ' points' : ''}`, 'success');
      loadPosts();
      if (points > 0 && refreshUser) refreshUser();
    } catch (err) {
      showToast('Error reacting. Not enough points?', 'error');
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const activityLabel = (post) => {
    const parts = [post.activity_type.charAt(0).toUpperCase() + post.activity_type.slice(1)];
    if (post.distance_km) parts.push(`${post.distance_km} km`);
    if (post.duration_min) parts.push(`${post.duration_min} min`);
    return parts.join(' · ');
  };

  if (loading) return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading posts...</div>;

  return (
    <div className="post-feed">
      {/* Compose area */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <textarea
            value={newPostContent}
            onChange={e => setNewPostContent(e.target.value)}
            placeholder="Share an update, milestone, or encouragement..."
            className="input"
            style={{ minHeight: 80, marginBottom: 8, resize: 'none' }}
            autoFocus={Boolean(initialDraft)}
            id="post-composer"
          />

          {!showActivityDetails ? (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, marginBottom: 8 }}
              onClick={() => setShowActivityDetails(true)}
            >
              + Add activity details
            </button>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div className="flex gap-6" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type}
                    className={`chip ${activityType === type ? 'active' : ''}`}
                    onClick={() => setActivityType(activityType === type ? null : type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-8" style={{ marginBottom: 8 }}>
                <input
                  type="number"
                  className="input"
                  style={{ padding: '6px 12px', minHeight: 'unset', fontSize: '0.85rem' }}
                  placeholder="Distance (km)"
                  value={distanceKm}
                  onChange={e => setDistanceKm(e.target.value)}
                />
                <input
                  type="number"
                  className="input"
                  style={{ padding: '6px 12px', minHeight: 'unset', fontSize: '0.85rem' }}
                  placeholder="Duration (min)"
                  value={durationMin}
                  onChange={e => setDurationMin(e.target.value)}
                />
              </div>
              <input
                type="url"
                className="input"
                style={{ padding: '6px 12px', minHeight: 'unset', fontSize: '0.85rem' }}
                placeholder="Photo URL (optional)"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
              />
            </div>
          )}

          <button className="btn btn-primary" onClick={handlePost} disabled={!newPostContent.trim()}>
            <Icon name="send" size={16} /> Post
          </button>
        </div>
      </div>

      {/* Posts list */}
      <div className="posts-list">
        {posts.map(post => (
          <div
            key={post.id}
            className="card"
            style={{
              marginBottom: 12,
              ...(post.is_system_event ? {
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))',
                borderLeft: '3px solid var(--brand-primary)'
              } : {})
            }}
          >
            <div className="card-body">
              {/* User row */}
              <div className="flex items-center gap-8 mb-8">
                <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#ddd', flexShrink: 0 }}>
                  {post.user.photo_url
                    ? <img src={post.user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="user" size={16} /></span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {post.user.name}
                    {post.is_system_event && (
                      <span style={{ marginLeft: 6, fontSize: '0.65rem', background: 'var(--brand-primary)', color: '#fff', padding: '1px 6px', borderRadius: 8, verticalAlign: 'middle' }}>
                        activity
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</div>
                </div>
              </div>

              {/* Content */}
              <p style={{ fontSize: '0.95rem', marginBottom: post.activity_type ? 8 : 12, lineHeight: 1.5 }}>{post.content}</p>

              {/* Activity stat strip */}
              {post.activity_type && (
                <div
                  className="flex items-center gap-6"
                  style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600, marginBottom: 12 }}
                >
                  <Icon name="leaf" size={14} />
                  <span>{activityLabel(post)}</span>
                </div>
              )}
              {post.photo_url && (
                <img
                  src={post.photo_url}
                  alt=""
                  style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 12, display: 'block' }}
                />
              )}

              {/* Reactions */}
              <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
                {Object.entries(post.reactions || {}).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20 }}
                    onClick={() => handleReact(post.id, emoji, emoji === 'coins' ? 5 : 0)}
                  >
                    {emoji === 'coins' ? <Icon name="coins" size={13} /> : emoji} {count}
                  </button>
                ))}
                {/* Quick add reactions */}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.8, border: '1px solid var(--border)' }}
                  onClick={() => handleReact(post.id, '🔥', 0)}
                  title="React with fire"
                >
                  🔥
                </button>
                {/* Point-gifting reactions use the coin icon, not an emoji */}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.8, border: '1px solid var(--border)' }}
                  onClick={() => handleReact(post.id, 'coins', 5)}
                  title="Gift 5 Legacy Points"
                >
                  <Icon name="coins" size={13} /> Gift 5
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.8, border: '1px solid var(--border)', background: 'rgba(245, 158, 11, 0.1)', color: '#D97706' }}
                  onClick={() => handleReact(post.id, 'coins', 10)}
                  title="Gift 10 Legacy Points"
                >
                  <Icon name="coins" size={13} /> Gift 10
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.8, border: '1px solid var(--border)', background: 'rgba(59, 130, 246, 0.1)', color: '#2563EB' }}
                  onClick={() => handleReact(post.id, 'coins', 50)}
                  title="Gift 50 Legacy Points"
                >
                  <Icon name="coins" size={13} /> Gift 50
                </button>
              </div>

              {post.total_points_gifted > 0 && (
                <div className="flex items-center gap-4" style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', marginTop: 8, fontWeight: 500 }}>
                  <Icon name="leaf" size={12} />
                  <span>+{post.total_points_gifted} Legacy Points gifted</span>
                </div>
              )}

              {/* Comments Section */}
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {(post.comments || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {(post.comments || []).map(comment => (
                      <div key={comment.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.02)', padding: 8, borderRadius: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: '#ddd', flexShrink: 0 }}>
                            {comment.user.photo_url
                              ? <img src={comment.user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="user" size={12} /></span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{comment.user.name} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>• {timeAgo(comment.created_at)}</span></div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{comment.content}</div>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: 20, marginTop: 4 }}
                              onClick={() => { setReplyingToId(comment.id); setReplyContent(''); }}
                            >
                              Reply
                            </button>
                          </div>
                        </div>

                        {/* Replies, indented under their parent */}
                        {(comment.replies || []).length > 0 && (
                          <div style={{ marginLeft: 24, marginTop: 6 }}>
                            {comment.replies.map(reply => (
                              <div key={reply.id} style={{ display: 'flex', gap: 8, marginBottom: 6, background: 'rgba(0,0,0,0.015)', padding: 8, borderRadius: 8 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: '#ddd', flexShrink: 0 }}>
                                  {reply.user.photo_url
                                    ? <img src={reply.user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="user" size={10} /></span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>{reply.user.name} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>• {timeAgo(reply.created_at)}</span></div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{reply.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {replyingToId === comment.id && (
                          <div style={{ display: 'flex', gap: 8, marginLeft: 24, marginTop: 6 }}>
                            <input
                              type="text"
                              className="input"
                              style={{ flex: 1, padding: '6px 12px', minHeight: 'unset', fontSize: '0.85rem' }}
                              placeholder="Write a reply..."
                              value={replyContent}
                              onChange={e => setReplyContent(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleReply(post.id, comment.id)}
                              autoFocus
                            />
                            <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleReply(post.id, comment.id)} disabled={!replyContent.trim()}>Send</button>
                            <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setReplyingToId(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {commentingOnId === post.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, padding: '6px 12px', minHeight: 'unset', fontSize: '0.85rem' }}
                      placeholder="Write a comment..."
                      value={commentContent}
                      onChange={e => setCommentContent(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                      autoFocus
                    />
                    <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleComment(post.id)} disabled={!commentContent.trim()}>Send</button>
                    <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setCommentingOnId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20 }} onClick={() => setCommentingOnId(post.id)}>
                    <Icon name="message-circle" size={13} /> Comment {post.comments?.length > 0 ? `(${post.comments.length})` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="message-circle" size={32} /></div>
            <div className="empty-state-text">No posts yet. Start the conversation!</div>
          </div>
        )}
      </div>
    </div>
  );
}
