import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPost } from '../api/client';
import FeedPostCard from '../components/feed/FeedPostCard';
import { useAuth } from '../context/AuthContext';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPost(id).then(value => { if (active) setPost(value); })
      .catch(err => { if (active) setError(err.status === 403 ? 'Join this circle to view the post.' : 'Post unavailable.'); });
    return () => { active = false; };
  }, [id]);

  return <div className="page" id="post-detail">
    <button type="button" className="btn btn-secondary mb-16" onClick={() => navigate('/home')}>Home</button>
    {error ? <p role="alert">{error}</p> : post ? <FeedPostCard item={{ id: post.id, type: 'post', post }} user={user} /> : <p>Loading post…</p>}
  </div>;
}
