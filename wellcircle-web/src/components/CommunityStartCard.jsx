import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rankCommunities, communityActivityLabel } from '../utils/communityDiscovery';
import { track } from '../analytics';

// Kept on Home until membership is confirmed, including return visits.
export default function CommunityStartCard({ user, communities = [] }) {
  const navigate = useNavigate();
  const recommended = rankCommunities(
    communities.filter(c => !c.user_joined), user.interest_categories || [],
  )[0];
  useEffect(() => {
    track('community_start_view', { community_id: recommended?.id || null, source: 'home' });
  }, [recommended?.id]);

  return (
    <div className="card mb-24" style={{ padding: 16 }} id="home-join-community-prompt">
      <h3 style={{ fontWeight: 700, marginBottom: 6 }}>Join a community to check in</h3>
      <p className="text-sm text-secondary mb-12">
        Build a daily habit with people who share your interests. Join one community, then check in today.
      </p>
      {recommended && (
        <p className="text-sm mb-12">
          <strong>{recommended.name}</strong>
          {communityActivityLabel(recommended) && <span className="text-secondary" style={{ display: 'block' }}>{communityActivityLabel(recommended)}</span>}
        </p>
      )}
      <button className="btn btn-primary btn-sm" onClick={() => {
        track('community_discovery_open', { source: 'home_first_action', community_id: recommended?.id || null });
        if (recommended) navigate(`/community/${recommended.id}`);
        else navigate('/community', { state: { tab: 'explore' } });
      }}>{recommended ? 'Meet this community' : 'Find a community'}</button>
    </div>
  );
}
