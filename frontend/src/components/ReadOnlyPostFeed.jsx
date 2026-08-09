import Icon from './Icon';
import SmartImage from './SmartImage';

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

/**
 * Read-only rendering of a circle/community's recent posts for a
 * non-member's preview page — no composer, reaction buttons, or comment
 * boxes (those require membership). Shared by CircleDetailScreen.jsx and
 * CommunityDetail.jsx (Phase 6).
 */
export default function ReadOnlyPostFeed({ posts, id }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="message-circle" size={32} /></div>
        <div className="empty-state-text">No activity yet — be the first to post once you join.</div>
      </div>
    );
  }
  return (
    <div className="posts-list" id={id}>
      {posts.map(post => (
        <div key={post.id} className="card mb-12 post-card">
          <div className="card-body">
            <div className="post-user-row">
              <div className="avatar avatar-md">
                <SmartImage src={post.user.photo_url} width={36} fallback={<Icon name="user" size={16} />} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="post-user-name">{post.user.name}</div>
                <div className="post-time">{timeAgo(post.created_at)}</div>
              </div>
            </div>
            <p className="post-content">{post.content}</p>
            <SmartImage src={post.photo_url} className="post-photo" width={430} />
          </div>
        </div>
      ))}
    </div>
  );
}
