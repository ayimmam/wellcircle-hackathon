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

  if (loading) return <div>Loading posts...</div>;

  return (
    <div className="post-feed">
      <div className="create-post card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <textarea 
            value={newPostContent}
            onChange={e => setNewPostContent(e.target.value)}
            placeholder="Share an update or milestone..."
            className="input"
            style={{ minHeight: 80, marginBottom: 8, resize: 'none' }}
          />
          <button className="btn btn-primary" onClick={handlePost} disabled={!newPostContent.trim()}>
            Post
          </button>
        </div>
      </div>

      <div className="posts-list">
        {posts.map(post => (
          <div key={post.id} className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div className="flex items-center gap-8 mb-8">
                <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#ccc' }}>
                  {post.user.photo_url ? <img src={post.user.photo_url} alt="" style={{ width:'100%', borderRadius: '50%' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{post.user.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{new Date(post.created_at).toLocaleString()}</div>
                </div>
              </div>
              <p style={{ fontSize: '0.95rem', marginBottom: 12 }}>{post.content}</p>
              
              <div className="flex gap-8">
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleReact(post.id, '🔥', 0)}>
                  🔥 {post.reactions?.['🔥'] || 0}
                </button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleReact(post.id, '👏', 5)}>
                  👏 Gift 5 pts ({post.reactions?.['👏'] || 0})
                </button>
              </div>
              {post.total_points_gifted > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                  +{post.total_points_gifted} Legacy Points gifted to this post
                </div>
              )}
            </div>
          </div>
        ))}
        {posts.length === 0 && <div className="empty-state">No posts yet. Be the first to share!</div>}
      </div>
    </div>
  );
}
