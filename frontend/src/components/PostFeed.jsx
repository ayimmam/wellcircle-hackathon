import { useState, useEffect } from 'react';
import { getPosts, createPost, reactToPost } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';

export default function PostFeed({ communityId, circleId }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [communityId, circleId]);

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

  const handlePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      await createPost({ content: newPostContent, community_id: communityId, circle_id: circleId });
      setNewPostContent('');
      loadPosts();
      showToast('Posted successfully!', '📝');
    } catch (err) {
      showToast('Error posting', '❌');
    }
  };

  const handleReact = async (postId, emoji, points) => {
    try {
      await reactToPost(postId, { emoji, points_gifted: points });
      showToast(`Reacted with ${emoji}${points ? ' and gifted ' + points + ' points' : ''}`, '🎉');
      loadPosts();
    } catch (err) {
      showToast('Error reacting. Not enough points?', '❌');
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
          />
          <button className="btn btn-primary" onClick={handlePost} disabled={!newPostContent.trim()}>
            📝 Post
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
                    : <span style={{ fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>👤</span>
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
              <p style={{ fontSize: '0.95rem', marginBottom: 12, lineHeight: 1.5 }}>{post.content}</p>
              
              {/* Reactions */}
              <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
                {Object.entries(post.reactions || {}).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20 }}
                    onClick={() => handleReact(post.id, emoji, emoji === '👏' ? 5 : 0)}
                  >
                    {emoji} {count}
                  </button>
                ))}
                {/* Quick add reactions */}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.6 }}
                  onClick={() => handleReact(post.id, '🔥', 0)}
                  title="React with fire"
                >
                  🔥+
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: 20, opacity: 0.6 }}
                  onClick={() => handleReact(post.id, '👏', 5)}
                  title="Clap and gift 5 Legacy Points"
                >
                  👏 Gift 5pts
                </button>
              </div>

              {post.total_points_gifted > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', marginTop: 8, fontWeight: 500 }}>
                  🌿 +{post.total_points_gifted} Legacy Points gifted
                </div>
              )}
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-text">No posts yet. Start the conversation!</div>
          </div>
        )}
      </div>
    </div>
  );
}
