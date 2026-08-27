import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { followUser, getFollowers, getFollowing, unfollowUser } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import VerifiedBadge from '../components/VerifiedBadge';

export default function FollowersList() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAvailable: nativeBack } = useTelegramBackButton(() => navigate(-1));
  const { user } = useAuth();
  const mode = location.pathname.endsWith('/following') ? 'following' : 'followers';
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (nextPage = 1) => {
    setLoading(true);
    try {
      const result = mode === 'followers'
        ? await getFollowers(id, nextPage)
        : await getFollowing(id, nextPage);
      const rows = (result.users || result[mode] || []).map(person => ({
        ...person,
        // The current backend list item omits viewer relationship state.
        // On the signed-in user's own Following list this value is implied.
        is_following: person.is_following ?? (mode === 'following' && id === user?.id),
      }));
      setItems(current => nextPage === 1 ? rows : [...current, ...rows]);
      setPage(result.page || nextPage);
      setPages(result.pages || 1);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [id, mode, user?.id]);

  const toggleFollow = async (person) => {
    try {
      if (person.is_following) await unfollowUser(person.id);
      else await followUser(person.id);
      setItems(current => current.map(item => item.id === person.id ? { ...item, is_following: !item.is_following } : item));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="page" id="followers-list-screen">
      <div className="page-heading">
        {!nativeBack && (
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Back"><Icon name="chevron-left" /></button>
        )}
        <h1>Connections</h1>
      </div>
      <div className="theme-toggle mb-16" role="group" aria-label="Connections">
        <button aria-pressed={mode === 'followers'} className={`theme-toggle-btn ${mode === 'followers' ? 'active' : ''}`} onClick={() => navigate(`/users/${id}/followers`)}>Followers</button>
        <button aria-pressed={mode === 'following'} className={`theme-toggle-btn ${mode === 'following' ? 'active' : ''}`} onClick={() => navigate(`/users/${id}/following`)}>Following</button>
      </div>
      {loading && items.length === 0 ? <div className="skeleton" style={{ height: 180 }} /> : (
        <div className="feed">
          {items.map(person => (
            <div className="cell" key={person.id}>
              <button className="avatar avatar-lg" onClick={() => navigate(`/users/${person.id}`)} aria-label={person.name}>
                <SmartImage src={person.photo_url} width={40} fallback={<Icon name="user" />} />
              </button>
              <button className="cell-body text-left" onClick={() => navigate(`/users/${person.id}`)}>
                <div className="cell-title">{person.name} {person.is_verified_trainer && <VerifiedBadge compact />}</div>
                <div className="cell-subtitle">@{person.telegram_handle || 'wellcircle'}</div>
              </button>
              {person.id !== user?.id && (
                <button className={`btn btn-sm ${person.is_following ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleFollow(person)}>
                  {person.is_following ? 'Unfollow' : 'Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && items.length === 0 && <div className="empty-state">No {mode} yet.</div>}
      {page < pages && <button className="btn btn-secondary btn-block mt-16" onClick={() => load(page + 1)}>Load more</button>}
    </div>
  );
}
