import { useState, useEffect } from 'react';
import { getCommunities, joinCommunity } from '../api/client';
import { CATEGORIES } from '../data/mock';
import CommunityCard from '../components/CommunityCard';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function CommunityList() {
  const { user, setUser } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState('explore'); // 'explore' | 'joined'
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCommunities(
      tab === 'joined' ? true : null,
      category !== 'all' ? category : null
    )
      .then(res => setCommunities(res.communities))
      .finally(() => setLoading(false));
  }, [tab, category]);

  const handleJoin = async (id) => {
    try {
      const res = await joinCommunity(id);
      showToast('Joined the circle! 🎉', '🤝');
      setCommunities(prev => prev.map(c =>
        c.id === id ? { ...c, user_joined: true, member_count: res.member_count } : c
      ));
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
    } catch (err) {
      showToast('Already a member', '👥');
    }
  };

  return (
    <div className="page" id="community-list-screen">
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>
        Community Circles
      </h1>

      {/* Tabs */}
      <div className="flex gap-8 mb-16">
        <button
          className={`chip ${tab === 'explore' ? 'active' : ''}`}
          onClick={() => setTab('explore')}
          id="tab-explore"
        >
          🌍 Explore
        </button>
        <button
          className={`chip ${tab === 'joined' ? 'active' : ''}`}
          onClick={() => setTab('joined')}
          id="tab-joined"
        >
          ✅ Joined
        </button>
      </div>

      {/* Category Filters */}
      <div className="filter-chips">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            className={`chip ${category === cat.value ? 'active' : ''}`}
            onClick={() => setCategory(cat.value)}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Community List */}
      {loading ? (
        <div className="flex-col gap-12">
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 12, width: '30%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : communities.length > 0 ? (
        <div className="flex-col gap-12">
          {communities.map(c => (
            <CommunityCard key={c.id} community={c} onJoin={handleJoin} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">{tab === 'joined' ? '🌱' : '🔍'}</div>
          <div className="empty-state-text">
            {tab === 'joined' ? "You haven't joined any circles yet." : 'No circles found for this category.'}
          </div>
        </div>
      )}
    </div>
  );
}
