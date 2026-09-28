import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPost } from '../api/client';
import FeedPostCard from '../components/feed/FeedPostCard';
import { useAuth } from '../context/AuthContext';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      sessionStorage.setItem('wc_post_redirect', `/post/${id}`);
      navigate('/login', { replace: true });
      return;
    }
    sessionStorage.removeItem('wc_post_redirect');
    let active = true;
    getPost(id).then(value => { if (active) setPost(value); })
      .catch(err => { if (active) setError(err.status === 403 ? 'Join this circle to view the post.' : 'Post unavailable.'); });
    return () => { active = false; };
  }, [id, user, loading, navigate]);

  return <div className="page" id="post-detail">
    <button type="button" className="btn btn-secondary mb-16" onClick={() => navigate('/home')}>Home</button>
    {error ? <p role="alert">{error}</p> : post ? <FeedPostCard item={{ id: post.id, type: 'post', post }} /> : <p>Loading post…</p>}
  </div>;
}
