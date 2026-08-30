import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { reactToPost } from '../../api/client';

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
 * Read-mostly feed card for a post item — no composer, gifting sheet, or
 * comment threads (those live on the destination circle/community screen).
 * Tapping the card body navigates to the post's source; tapping the
 * avatar/name goes to the author's profile, matching PostFeed.jsx.
 */
export default function FeedPostCard({ item, priority = false }) {
  const navigate = useNavigate();
  const post = item.post;
  const [reactions, setReactions] = useState(post.reactions || {});
  const [reacting, setReacting] = useState(false);

  const destination = post.source?.kind === 'community'
    ? `/community/${post.source.id}`
    : post.source?.kind === 'circle'
      ? `/circle/${post.source.id}`
      : null;

  const goToSource = () => { if (destination) navigate(destination); };

  const handleQuickReact = async (e) => {
    e.stopPropagation();
    if (reacting) return;
    setReacting(true);
    const prev = reactions;
    setReactions(r => ({ ...r, '🔥': (r['🔥'] || 0) + 1 }));
    try {
      await reactToPost(post.id, { emoji: '🔥', points_gifted: 0 });
    } catch {
      setReactions(prev);
    } finally {
      setReacting(false);
    }
  };

  return (
    <div className="card mb-12 feed-post-card" id={`feed-post-${item.id}`}>
      <div className="card-body" style={{ cursor: destination ? 'pointer' : 'default' }} onClick={goToSource}>
        <div
          className="post-user-row"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/users/${post.user.id}`); }}
        >
          <div className="avatar avatar-md">
            <SmartImage src={post.user.photo_url} width={36} fallback={<Icon name="user" size={16} />} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="post-user-name">{post.user.name}</div>
            <div className="post-time">{timeAgo(post.created_at)}</div>
          </div>
        </div>

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

        <div className="post-reactions">
          {Object.entries(reactions).map(([emoji, count]) => (
            <span key={emoji} className="btn btn-secondary post-reaction-btn" style={{ pointerEvents: 'none' }}>
              {emoji === 'coins' ? <Icon name="coins" size={13} /> : emoji} {count}
            </span>
          ))}
          <button
            className="btn btn-secondary post-reaction-btn"
            onClick={handleQuickReact}
            disabled={reacting}
            title="React with fire"
            id={`feed-post-react-${item.id}`}
          >
            🔥
          </button>
          {post.comment_count > 0 && (
            <span className="inline-icon-text post-reaction-btn" style={{ color: 'var(--text-secondary)' }}>
              <Icon name="message-circle" size={13} /> {post.comment_count}
            </span>
          )}
        </div>

        {destination && post.source?.name && (
          <div className="text-xs text-secondary" style={{ marginTop: 8 }}>
            in <strong>{post.source.name}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
