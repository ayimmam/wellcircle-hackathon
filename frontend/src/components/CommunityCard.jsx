import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { clickableDivProps } from '../utils/a11y';

export default function CommunityCard({ community, onJoin, joining = false }) {
  const navigate = useNavigate();

  return (
    <div
      className="card community-card"
      {...clickableDivProps(() => navigate(`/community/${community.id}`))}
      aria-label={community.name}
      id={`community-card-${community.id}`}
    >
      <div className="card-body">
        <div className="community-card-header">
          <span className="community-card-name">{community.name}</span>
          <span className="community-card-members inline-icon-text">
            <Icon name="users" size={14} /> {community.member_count}
          </span>
        </div>
        <div className="community-card-provider">
          by {community.provider_name}
        </div>
        <div className="community-card-footer">
          <span className={`category-badge ${community.category}`}>
            {community.category}
          </span>
          {community.user_joined ? (
            <span className="category-badge badge-success-soft inline-icon-text">
              <Icon name="check" size={12} strokeWidth={2.5} /> Joined
            </span>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.(community.id);
              }}
              disabled={joining}
              id={`join-btn-${community.id}`}
            >
              {joining && <span className="btn-spinner" aria-hidden="true" />}
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
