import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { toggleReaction } from '../../api/client';
import { clickableDivProps } from '../../utils/a11y';
import usePostComments from '../../hooks/usePostComments';
import ReactionPicker from '../ReactionPicker';
import ReactionStack from '../ReactionStack';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function activityLabel(post) {
  const parts = [post.activity_type.charAt(0).toUpperCase() + post.activity_type.slice(1)];
  if (post.distance_km) parts.push(`${post.distance_km} km`);
  if (post.duration_min) parts.push(`${post.duration_min} min`);
  return parts.join(' · ');
}

/**
 * Feed card for a post item — WS13/WS15 upgrade: inline comment composer,
 * icon-based reaction buttons matching NotificationsScreen's outline style,
 * long-press reaction picker, and stacked reaction display.
 *
 * `post.source` is `null` for a standalone post (WS2).
 */
export default function FeedPostCard({ item, priority = false, onRetry, onDiscard, user }) {
  const navigate = useNavigate();
  const post = item.post;
  const [reactions, setReactions] = useState(post.reactions || {});
  const [viewerReactions, setViewerReactions] = useState(post.viewer_reactions || []);
  const [reactorsPreview] = useState(post.reactors_preview || {});
  const [reacting, setReacting] = useState(false);

  // WS13: inline comments
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { comments, addComment, submitting: commentSubmitting } = usePostComments(post.comments || []);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const commentInputRef = useRef(null);

  // WS15: unlock purchase sheet placeholder
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);

  const destination = post.source?.kind === 'community'
    ? `/community/${post.source.id}`
    : post.source?.kind === 'circle'
      ? `/circle/${post.source.id}`
      : null;

  const goToSource = () => { if (destination) navigate(destination); };

  // WS15: toggle reaction handler
  const handleReact = async (emoji) => {
    if (reacting || item.pending || item.failed) return;
    setReacting(true);
    const prevReactions = { ...reactions };
    const prevViewer = [...viewerReactions];

    // Optimistic
    const isRemoving = viewerReactions.includes(emoji);
    setReactions(r => ({
      ...r,
      [emoji]: Math.max(0, (r[emoji] || 0) + (isRemoving ? -1 : 1)),
    }));
    setViewerReactions(prev =>
      isRemoving ? prev.filter(e => e !== emoji) : [...prev, emoji],
    );

    try {
      const result = await toggleReaction(post.id, emoji);
      if (result.reactions) setReactions(result.reactions);
    } catch {
      setReactions(prevReactions);
      setViewerReactions(prevViewer);
    } finally {
      setReacting(false);
    }
  };

  // WS13: toggle comments
  const handleToggleComments = () => {
    setCommentsOpen(!commentsOpen);
    if (!commentsOpen) {
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');
    const result = await addComment(post.id, text);
    if (result) setCommentCount(c => c + 1);
  };

  return (
    <motion.div
      className="card mb-12 feed-post-card"
      id={`feed-post-${item.id}`}
      style={item.pending ? { opacity: 0.7 } : undefined}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {(item.pending || item.failed) && (
        <div
          className="inline-icon-text text-xs"
          style={{
            padding: '8px 14px', gap: 8,
            color: item.failed ? 'var(--danger)' : 'var(--text-secondary)',
          }}
        >
          {item.pending ? (
            <><span className="btn-spinner" aria-hidden="true" /> Posting…</>
          ) : (
            <>
              <Icon name="x" size={13} /> Couldn't post
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 'auto', padding: '2px 10px' }}
                onClick={() => onRetry?.(item.id)}
                id={`feed-post-retry-${item.id}`}
              >
                Retry
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 10px' }}
                onClick={() => onDiscard?.(item.id)}
                id={`feed-post-discard-${item.id}`}
              >
                Discard
              </button>
            </>
          )}
        </div>
      )}
      <div
        className="post-user-row"
        style={{ cursor: 'pointer', padding: '14px 14px 0' }}
        aria-label={post.user.name}
        {...clickableDivProps(() => navigate(`/users/${post.user.id}`))}
      >
        <div className="avatar avatar-md">
          <SmartImage src={post.user.photo_url} width={36} fallback={<Icon name="user" size={16} />} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="post-user-name">{post.user.name}</div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
      </div>

      <div
        className="card-body"
        style={{ cursor: destination ? 'pointer' : 'default' }}
        {...(destination ? clickableDivProps(goToSource) : {})}
      >
        <p className={`post-content ${post.activity_type ? 'has-stats' : ''}`}>
          {post.content}{post.truncated ? '…' : ''}
        </p>

        {post.activity_type && (
          <div className="post-stat-strip">
            <Icon name="leaf" size={14} />
            <span>{activityLabel(post)}</span>
          </div>
        )}

        {post.photo_url && (
          <div style={{ height: 200, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 8 }}>
            <SmartImage
              src={post.photo_url}
              className="post-photo"
              width={430}
              priority={priority}
              style={{ height: '100%', width: '100%', objectFit: 'cover' }}
              fallback={<div style={{ height: '100%', background: 'var(--bg-tertiary)' }} />}
            />
          </div>
        )}

        {/* WS15: stacked reaction display */}
        <ReactionStack reactions={reactions} reactorsPreview={reactorsPreview} />
      </div>

      {/* WS13: minimal icon action row */}
      <div className="post-action-row">
        <ReactionPicker
          onReact={handleReact}
          onUnlockPurchase={() => setShowUnlockSheet(true)}
          viewerReactions={viewerReactions}
          hasWellcircleReaction={user?.has_wellcircle_reaction}
          disabled={reacting}
        />
        <button
          type="button"
          className="post-action-btn"
          onClick={handleToggleComments}
          id={`feed-post-comment-${item.id}`}
          aria-label="Comment"
        >
          <Icon name="message-circle" size={18} strokeWidth={1.5} />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      {destination && post.source?.name && (
        <div className="text-xs text-secondary" style={{ padding: '4px 14px 8px' }}>
          in <strong>{post.source.name}</strong>
        </div>
      )}

      {/* WS13: inline comment thread */}
      {commentsOpen && (
        <>
          {comments.length > 0 && (
            <div className="feed-comment-list">
              {comments.filter(c => !c.parent_comment_id).map(c => (
                <div key={c.id} className="feed-comment-item" style={{ opacity: c._pending ? 0.6 : 1 }}>
                  <strong>{c.user?.name || 'User'}</strong>
                  <span>{c.content}</span>
                </div>
              ))}
            </div>
          )}
          <div className="feed-comment-composer">
            <input
              ref={commentInputRef}
              type="text"
              placeholder="Write a comment…"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitComment(); }}
              disabled={commentSubmitting}
              id={`feed-post-comment-input-${item.id}`}
            />
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={commentSubmitting || !commentText.trim()}
              id={`feed-post-comment-send-${item.id}`}
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </>
      )}

      {/* WS15: unlock purchase sheet */}
      {showUnlockSheet && (
        <>
          <div className="sheet-overlay" onClick={() => setShowUnlockSheet(false)} />
          <div className="sheet" id="unlock-reaction-sheet">
            <div className="sheet-handle" />
            <h3 className="sheet-title">Unlock the Well Circle Reaction</h3>
            <p className="text-secondary" style={{ marginBottom: 16 }}>
              The exclusive Well Circle reaction costs <strong>50 points</strong>.
              Once unlocked, you can use it on any post.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={async () => {
                try {
                  const { unlockReaction } = await import('../../api/client');
                  await unlockReaction();
                  setShowUnlockSheet(false);
                } catch {
                  // toast handled by client
                }
              }}
              id="unlock-reaction-confirm"
            >
              <Icon name="coins" size={16} /> Unlock for 50 pts
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
