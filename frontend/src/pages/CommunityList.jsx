import { useState, useEffect } from 'react';
import { getCommunities, joinCommunity, getCircles, createCircle } from '../api/client';
import { CATEGORIES } from '../data/mock';
import CommunityCard from '../components/CommunityCard';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function CommunityList() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [circles, setCircles] = useState([]);
  const [tab, setTab] = useState('explore'); // 'explore' | 'joined' | 'circles'
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [newCircleName, setNewCircleName] = useState('');

  useEffect(() => {
    setLoading(true);
    if (tab === 'circles') {
      getCircles()
        .then(res => setCircles(res.circles || []))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        getCommunities(tab === 'joined' ? true : null, category !== 'all' ? category : null),
        tab === 'explore' ? getCircles() : Promise.resolve({ circles: [] })
      ])
        .then(([commRes, circRes]) => {
          setCommunities(commRes.communities);
          setCircles(circRes.circles || []);
        })
        .finally(() => setLoading(false));
    }
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
  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return;
    try {
      await createCircle({ name: newCircleName, description: '' });
      setNewCircleName('');
      showToast('Circle created!', '✨');
      getCircles().then(res => setCircles(res.circles || []));
    } catch (err) {
      showToast('Error creating circle', '❌');
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
        >
          Explore
        </button>
        <button
          className={`chip ${tab === 'joined' ? 'active' : ''}`}
          onClick={() => setTab('joined')}
        >
          Joined
        </button>
        <button
          className={`chip ${tab === 'circles' ? 'active' : ''}`}
          onClick={() => setTab('circles')}
        >
          My Circles
        </button>
      </div>

      {tab !== 'circles' && (
        <div className="filter-chips">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`chip ${category === cat.value ? 'active' : ''}`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

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
      ) : tab === 'circles' ? (
        <div className="flex-col gap-12">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body flex gap-8">
              <input 
                type="text" 
                placeholder="New Circle Name..." 
                className="input" 
                value={newCircleName}
                onChange={e => setNewCircleName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleCreateCircle} disabled={!newCircleName.trim()}>Create</button>
            </div>
          </div>
          {circles.map(c => (
            <div key={c.id} className="card" onClick={() => navigate(`/circle/${c.id}`)}>
              <div className="card-body">
                <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{c.name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  👥 {c.member_count} members
                </div>
              </div>
            </div>
          ))}
          {circles.length === 0 && <div className="empty-state">No circles yet. Create one above!</div>}
        </div>
      ) : tab === 'explore' ? (
        <div className="flex-col gap-12">
          {communities.map(c => (
            <CommunityCard key={c.id} community={c} onJoin={handleJoin} />
          ))}
          {circles.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 16 }}>Community User Circles</h2>
              {circles.map(c => (
                <div key={c.id} className="card" onClick={() => navigate(`/circle/${c.id}`)}>
                  <div className="card-body">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>⭕ {c.name}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      👥 {c.member_count} members
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {communities.length === 0 && circles.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">No circles found.</div>
            </div>
          )}
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
