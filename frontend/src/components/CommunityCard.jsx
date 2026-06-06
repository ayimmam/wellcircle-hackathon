import { useNavigate } from 'react-router-dom';

export default function CommunityCard({ community, onJoin }) {
  const navigate = useNavigate();

  return (
    <div
      className="card community-card"
      onClick={() => navigate(`/community/${community.id}`)}
      id={`community-card-${community.id}`}
    >
      <div className="card-body">
        <div className="community-card-header">
          <span className="community-card-name">{community.name}</span>
          <span className="community-card-members">
            👥 {community.member_count}
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
            <span className="category-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
              ✓ Joined
            </span>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.(community.id);
              }}
              id={`join-btn-${community.id}`}
            >
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
