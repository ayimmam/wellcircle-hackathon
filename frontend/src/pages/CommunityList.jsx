import { useState } from 'react';
import { getCommunities, joinCommunity, getCircles, createCircle, getRanks, cacheKeys } from '../api/client';
import useResource from '../hooks/useResource';
import { CATEGORIES } from '../data/mock';
import CommunityCard from '../components/CommunityCard';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

const MEDALS = ['🥇', '🥈', '🥉'];
const EMPTY_LIST = [];

export default function CommunityList() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/home'));
  const { t } = useTranslation();
  const [tab, setTab] = useState('explore'); // 'explore' | 'joined' | 'circles' | 'ranks'
  const [category, setCategory] = useState('all');
  const [newCircleName, setNewCircleName] = useState('');
  const [ranksView, setRanksView] = useState('communities'); // 'communities' | 'individuals'

  // Each tab reads its own cache key, so switching between them is a render
  // rather than a refetch — and the lists Home already loaded are reused.
  const joinedOnly = tab === 'joined' ? true : null;
  const categoryFilter = category !== 'all' ? category : null;
  const showsCommunities = tab === 'explore' || tab === 'joined';

  const {
    data: communities, loading: communitiesLoading, setData: setCommunities,
  } = useResource(
    cacheKeys.communities(joinedOnly, categoryFilter),
    () => getCommunities(joinedOnly, categoryFilter),
    {
      enabled: showsCommunities,
      initialData: EMPTY_LIST,
      select: res => res.communities || EMPTY_LIST,
    },
  );

  const {
    data: circles, loading: circlesLoading, refresh: refreshCircles,
  } = useResource(
    cacheKeys.circles(),
    getCircles,
    {
      enabled: tab === 'circles' || tab === 'explore',
      initialData: EMPTY_LIST,
      select: res => res.circles || EMPTY_LIST,
    },
  );

  const { data: ranks, loading: ranksLoading } = useResource(
    cacheKeys.ranks(),
    getRanks,
    { enabled: tab === 'ranks' },
  );

  const loading = tab === 'ranks' ? ranksLoading
    : tab === 'circles' ? circlesLoading
      : communitiesLoading;

  const [joiningId, setJoiningId] = useState(null);

  const handleJoin = async (id) => {
    if (joiningId) return;
    setJoiningId(id);
    try {
      const res = await joinCommunity(id);
      showToast('Joined the circle!', 'success');
      setCommunities(prev => prev.map(c =>
        c.id === id ? { ...c, user_joined: true, member_count: res.member_count } : c
      ));
      if (user) {
        setUser(prev => ({
          ...prev,
          joined_communities: [...(prev.joined_communities || []), id]
        }));
      }
      // Land on the circle's Activity tab with a pre-filled intro, same as
      // joining directly from the detail page (CommunityDetail's justJoined flow).
      navigate(`/community/${id}`, { state: { justJoined: true } });
    } catch (err) {
      showToast('Already a member');
    } finally {
      setJoiningId(null);
    }
  };
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return;
    if (isPrivate && !joinCode.trim()) {
      showToast('Please enter a join code for the private circle', 'error');
      return;
    }
    try {
      await createCircle({ name: newCircleName, description: '', is_private: isPrivate, join_code: isPrivate ? joinCode : null });
      setNewCircleName('');
      setJoinCode('');
      setIsPrivate(false);
      showToast('Circle created!', 'success');
      refreshCircles();
    } catch (err) {
      showToast('Error creating circle', 'error');
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
        <button
          className={`chip inline-icon-text ${tab === 'ranks' ? 'active' : ''}`}
          onClick={() => setTab('ranks')}
          id="tab-ranks"
        >
          <Icon name="trophy" size={13} /> {t('Ranks')}
        </button>
      </div>

      {tab !== 'circles' && tab !== 'ranks' && (
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
      ) : tab === 'ranks' ? (
        <div id="ranks-panel">
          <div className="admin-subtabs mb-16" style={{ display: 'flex', gap: 8 }}>
            <button
              className={`admin-subtab ${ranksView === 'communities' ? 'active' : ''}`}
              onClick={() => setRanksView('communities')}
              id="ranks-view-communities"
            >
              {t('Communities')}
            </button>
            <button
              className={`admin-subtab ${ranksView === 'individuals' ? 'active' : ''}`}
              onClick={() => setRanksView('individuals')}
              id="ranks-view-individuals"
            >
              {t('Individuals')}
            </button>
          </div>

          {ranksView === 'communities' ? (
            ranks?.communities?.length > 0 ? (
              <div className="flex-col gap-8">
                {ranks.communities.map((c, i) => (
                  <div
                    key={c.community_id}
                    className="card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/community/${c.community_id}`)}
                    id={`rank-community-${c.community_id}`}
                  >
                    <div className="card-body flex items-center justify-between">
                      <div className="flex items-center gap-12">
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, width: 28 }}>
                          {MEDALS[i] || `#${c.rank}`}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.name}</div>
                          <div className="inline-icon-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <Icon name="users" size={12} /> {c.member_count}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800 }}>{c.weekly_points} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><Icon name="trophy" size={32} /></div>
                <div className="empty-state-text">{t('No points earned this week yet — check in to get on the board')}</div>
              </div>
            )
          ) : ranks?.users?.length > 0 ? (
            <div className="flex-col gap-8">
              {ranks.users.map((u, i) => {
                const isMe = u.user_id === user?.id;
                return (
                  <div
                    key={u.user_id}
                    className="card"
                    id={`rank-user-${u.user_id}`}
                    style={isMe ? { border: '2px solid var(--brand-primary)' } : undefined}
                  >
                    <div className="card-body flex items-center justify-between">
                      <div className="flex items-center gap-12">
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, width: 28 }}>
                          {MEDALS[i] || `#${u.rank}`}
                        </span>
                        <div style={{ fontWeight: 700 }}>{u.name}{isMe ? ` (${t('You')})` : ''}</div>
                      </div>
                      <div style={{ fontWeight: 800 }}>{u.weekly_points} pts</div>
                    </div>
                  </div>
                );
              })}
              {ranks?.me && !ranks.users.some(u => u.user_id === user?.id) && (
                <div className="card" id="rank-me-footer" style={{ border: '2px dashed var(--brand-primary)' }}>
                  <div className="card-body flex items-center justify-between">
                    <div style={{ fontWeight: 700 }}>
                      {t('You')} — {ranks.me.rank != null ? `#${ranks.me.rank} · ${ranks.me.weekly_points} pts` : t('Unranked')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="trophy" size={32} /></div>
              <div className="empty-state-text">{t('No points earned this week yet — check in to get on the board')}</div>
            </div>
          )}
        </div>
      ) : tab === 'circles' ? (
        <div className="flex-col gap-12">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div className="flex gap-8 mb-8">
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
              <div className="flex items-center gap-8">
                <label className="checkbox-row" style={{ margin: 0 }}>
                  <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                  <span style={{ fontSize: '0.85rem' }}>Private Circle</span>
                </label>
                {isPrivate && (
                  <input 
                    type="text" 
                    placeholder="Join Code (e.g. VIP2024)" 
                    className="input" 
                    style={{ flex: 1, padding: '4px 8px' }}
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          {circles.map(c => (
            <div key={c.id} className="card" onClick={() => navigate(`/circle/${c.id}`)}>
              <div className="card-body">
                <h3 className="flex items-center gap-6" style={{ fontSize: '1.1rem', marginBottom: 4 }}>
                  {c.is_private && <Icon name="lock" size={14} />}
                  {c.name}
                </h3>
                <div className="flex items-center gap-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Icon name="users" size={12} /> {c.member_count} members
                </div>
              </div>
            </div>
          ))}
          {circles.length === 0 && <div className="empty-state">No circles yet. Create one above!</div>}
        </div>
      ) : tab === 'explore' ? (
        <div className="flex-col gap-12">
          {communities.filter(c => !c.user_joined).map(c => (
            <CommunityCard key={c.id} community={c} onJoin={handleJoin} joining={joiningId === c.id} />
          ))}
          {circles.filter(c => !c.user_joined).length > 0 && (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 16 }}>Community User Circles</h2>
              {circles.filter(c => !c.user_joined).map(c => (
                <div key={c.id} className="card" onClick={() => navigate(`/circle/${c.id}`)}>
                  <div className="card-body">
                    <h3 className="flex items-center gap-6" style={{ fontSize: '1.1rem', marginBottom: 4 }}>
                      {c.is_private && <Icon name="lock" size={14} />}
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <Icon name="users" size={12} /> {c.member_count} members
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {communities.filter(c => !c.user_joined).length === 0 && circles.filter(c => !c.user_joined).length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="search" size={32} /></div>
              <div className="empty-state-text">No circles found.</div>
            </div>
          )}
        </div>
      ) : communities.length > 0 ? (
        <div className="flex-col gap-12">
          {communities.map(c => (
            <CommunityCard key={c.id} community={c} onJoin={handleJoin} joining={joiningId === c.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name={tab === 'joined' ? 'leaf' : 'search'} size={32} /></div>
          <div className="empty-state-text">
            {tab === 'joined' ? "You haven't joined any circles yet." : 'No circles found for this category.'}
          </div>
        </div>
      )}
    </div>
  );
}
