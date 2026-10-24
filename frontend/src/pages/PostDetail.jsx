import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPost, getCachedPost, cacheKeys } from '../api/client';
import FeedPostCard from '../components/feed/FeedPostCard';
import { useAuth } from '../context/AuthContext';
import ErrorScreen from '../components/ErrorScreen';
import useResource from '../hooks/useResource';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const preview = useMemo(() => getCachedPost(id), [id]);
  const { data, error, refresh } = useResource(user?.id ? cacheKeys.post(id) : null, () => getPost(id, { force: true }), {
    initialData: preview,
  });
  const post = String(data?.id) === String(id) ? data : preview;


  return <div className="page" id="post-detail">
    <button type="button" className="btn btn-secondary mb-16" onClick={() => navigate('/home')}>Home</button>
    {!user ? <p>{authLoading ? 'Loading post…' : 'Sign in to view this post.'}</p>
      : error ? <ErrorScreen error={error} onRetry={refresh} />
        : post ? <FeedPostCard item={{ id: post.id, type: 'post', post }} user={user} />
          : <p>Loading post…</p>}
  </div>;
}
