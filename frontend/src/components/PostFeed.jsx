import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, createPost, reactToPost, commentOnPost } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';
import Icon from './Icon';
import SmartImage from './SmartImage';
import { haptic } from '../utils/haptic';
import { clickableDivProps } from '../utils/a11y';

const ACTIVITY_TYPES = ['run', 'walk', 'ride', 'yoga', 'gym', 'swim'];

export default function PostFeed({ communityId, circleId, initialDraft, onDraftConsumed }) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState(initialDraft || '');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentingOnId, setCommentingOnId] = useState(null); // top-level comment box, keyed by post id
  const [commentContent, setCommentContent] = useState('');
  const [replyingToId, setReplyingToId] = useState(null); // reply box, keyed by comment id
  const [replyContent, setReplyContent] = useState('');
  const [showGiftsFor, setShowGiftsFor] = useState(null);
  const [composerExpanded, setComposerExpanded] = useState(Boolean(initialDraft));

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
    setComposerExpanded(false);
  };

  const handlePost = async () => {
    if (!newPostContent.trim() || posting) return;
    setPosting(true);
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
    } finally {
      setPosting(false);
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
    haptic('impact.light');
    
    // Optimistic UI Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          reactions: {
            ...p.reactions,
            [emoji]: (p.reactions?.[emoji] || 0) + 1
          },
          total_points_gifted: (p.total_points_gifted || 0) + (points || 0)
        };
      }
      return p;
    }));

    if (points > 0 && refreshUser) refreshUser(); // This triggers fetching new points balance (partially optimistic but good enough for other screens)

    try {
      await reactToPost(postId, { emoji, points_gifted: points });
      showToast(`Reacted${points ? ' and gifted ' + points + ' points' : ''}`, 'success');
      // The background loadPosts will synchronize any other missing changes
      loadPosts();
    } catch (err) {
      showToast('Error reacting. Not enough points?', 'error');
      loadPosts(); // Revert on failure
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
      <div className="card mb-16">
        <div className="card-body">
          {!composerExpanded ? (
            <div
              className="input flex items-center"
              style={{ cursor: 'text', height: 44, color: 'var(--text-secondary)' }}
              onClick={() => setComposerExpanded(true)}
            >
              Share an update, milestone, or encouragement...
            </div>
          ) : (
            <>
              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder="Share an update, milestone, or encouragement..."
                className="input post-composer-field"
                style={{ minHeight: 80, resize: 'none' }}
                autoFocus
                id="post-composer"
              />

              {!showActivityDetails ? (
                <button
                  className="btn btn-secondary post-composer-toggle"
                  onClick={() => setShowActivityDetails(true)}
                >
                  + Add activity details
                </button>
              ) : (
                <div className="mb-8">
                  <div className="flex gap-6 flex-wrap mb-8">
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
                  <div className="post-composer-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="Distance (km)"
                      value={distanceKm}
                      onChange={e => setDistanceKm(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Duration (min)"
                      value={durationMin}
                      onChange={e => setDurationMin(e.target.value)}
                    />
                  </div>
                  <input
                    type="url"
                    className="input post-composer-field"
                    placeholder="Photo URL (optional)"
                    value={photoUrl}
                    onChange={e => setPhotoUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-8 mt-12">
                <button className="btn btn-primary" onClick={handlePost} disabled={!newPostContent.trim() || posting}>
                  {posting ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="send" size={16} />} Post
                </button>
                <button className="btn btn-secondary" onClick={resetComposer}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Posts list */}
      <div className="posts-list">
        {posts.map(post => (
          <div
            key={post.id}
            className={`card mb-12 post-card ${post.is_system_event ? 'system-event' : ''}`}
          >
            <div className="card-body">
              {/* User row */}
              <div className="post-user-row" style={{ cursor: 'pointer' }} aria-label={post.user.name} {...clickableDivProps(() => navigate(`/users/${post.user.id}`))}>
                <div className="avatar avatar-md">
                  <SmartImage
                    src={post.user.photo_url}
                    width={36}
                    fallback={<Icon name="user" size={16} />}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="post-user-name">
                    {post.user.name}
                    {post.is_system_event && (
                      <span className="post-system-badge">activity</span>
                    )}
                  </div>
                  <div className="post-time">{timeAgo(post.created_at)}</div>
                </div>
              </div>

              {/* Content */}
              <p className={`post-content ${post.activity_type ? 'has-stats' : ''}`}>{post.content}</p>

              {/* Activity stat strip */}
              {post.activity_type && (
                <div className="post-stat-strip">
                  <Icon name="leaf" size={14} />
                  <span>{activityLabel(post)}</span>
                </div>
              )}
              <SmartImage src={post.photo_url} className="post-photo" width={430} />

              {/* Reactions */}
              <div className="post-reactions">
                {Object.entries(post.reactions || {}).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    className="btn btn-secondary post-reaction-btn"
                    onClick={() => handleReact(post.id, emoji, emoji === 'coins' ? 5 : 0)}
                  >
                    {emoji === 'coins' ? <Icon name="coins" size={13} /> : emoji} {count}
                  </button>
                ))}
                {/* Quick add reactions */}
                <button
                  className="btn btn-secondary post-reaction-btn"
                  onClick={() => handleReact(post.id, '🔥', 0)}
                  title="React with fire"
                >
                  🔥
                </button>
                {/* Point-gifting reactions use the coin icon, not an emoji */}
                <button
                  className={`btn btn-secondary post-reaction-btn ${showGiftsFor === post.id ? 'active' : ''}`}
                  onClick={() => setShowGiftsFor(showGiftsFor === post.id ? null : post.id)}
                  title="Gift Legacy Points"
                >
                  <Icon name="coins" size={13} /> Gift
                </button>
              </div>

              {showGiftsFor === post.id && (
                <div className="flex gap-8 mt-8" style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { handleReact(post.id, 'coins', 5); setShowGiftsFor(null); }}>5 pts</button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { handleReact(post.id, 'coins', 10); setShowGiftsFor(null); }}>10 pts</button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { handleReact(post.id, 'coins', 50); setShowGiftsFor(null); }}>50 pts</button>
                </div>
              )}

              {post.total_points_gifted > 0 && (
                <div className="post-gift-note">
                  <Icon name="leaf" size={12} />
                  <span>+{post.total_points_gifted} Legacy Points gifted</span>
                </div>
              )}

              {/* Comments Section */}
              <div className="post-comments">
                {(post.comments || []).length > 0 && (
                  <div className="mb-12">
                    {(post.comments || []).map(comment => (
                      <div key={comment.id} className="mb-8">
                        <div className="comment-row" style={{ cursor: 'pointer' }} aria-label={comment.user.name} {...clickableDivProps(() => navigate(`/users/${comment.user.id}`))}>
                          <div className="avatar avatar-sm">
                            <SmartImage
                              src={comment.user.photo_url}
                              width={24}
                              fallback={<Icon name="user" size={12} />}
                            />
                          </div>
                          <div className="comment-body">
                            <div className="comment-author">{comment.user.name} <span className="comment-meta">• {timeAgo(comment.created_at)}</span></div>
                            <div className="comment-text">{comment.content}</div>
                            <button
                              className="btn btn-secondary comment-reply-btn"
                              onClick={() => { setReplyingToId(comment.id); setReplyContent(''); }}
                            >
                              Reply
                            </button>
                          </div>
                        </div>

                        {/* Replies, indented under their parent */}
                        {(comment.replies || []).length > 0 && (
                          <div className="replies-list">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="reply-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/users/${reply.user.id}`)}>
                                <div className="avatar avatar-xs">
                                  <SmartImage
                                    src={reply.user.photo_url}
                                    width={20}
                                    fallback={<Icon name="user" size={10} />}
                                  />
                                </div>
                                <div className="comment-body">
                                  <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>{reply.user.name} <span className="comment-meta">• {timeAgo(reply.created_at)}</span></div>
                                  <div className="comment-text">{reply.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {replyingToId === comment.id && (
                          <div className="reply-composer-row">
                            <input
                              type="text"
                              className="input"
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
                  <div className="comment-composer-row">
                    <input
                      type="text"
                      className="input"
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
                  <button className="btn btn-secondary post-composer-toggle" onClick={() => setCommentingOnId(post.id)}>
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
