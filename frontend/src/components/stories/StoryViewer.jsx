import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import { followUser, unfollowUser, toggleStoryLike, getStoryViewers } from '../../api/client';
import useOptimisticAction from '../../hooks/useOptimisticAction';
import { shareBrandedImage } from '../../utils/brandedCanvas';

// How long one story holds the screen before advancing.
const STORY_MS = 5000;
// Progress bars repaint on a timer rather than requestAnimationFrame: the
// Telegram WebView on a mid-range Android throttles rAF hard when the app is
// backgrounded, and a 60fps bar is not worth the battery here.
const TICK_MS = 50;

/**
 * Fullscreen tap-through story player.
 *
 * Plays one author's stories in order, then rolls onto the next author, which
 * is what makes the rail feel like one continuous reel rather than a set of
 * separate popups. Tap right (or →) advances, tap left (or ←) goes back, and
 * holding pauses — the gestures people already have muscle memory for.
 *
 * A view receipt fires once per story, the first time it is actually shown.
 * The `sentRef` set is what keeps a back-tap from double-counting.
 */
export default function StoryViewer({ groups, startIndex = 0, onClose, onViewed, onDelete }) {
  const [groupAt, setGroupAt] = useState(startIndex);
  const [storyAt, setStoryAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const sentRef = useRef(new Set());
  const navigate = useNavigate();
  const runOptimistic = useOptimisticAction();
  // Per-author override so a follow toggle sticks as you tap through that
  // author's own stories, without needing the parent rail to re-render.
  const [followOverrides, setFollowOverrides] = useState({});

  // WS11b: like state per story
  const [likeOverrides, setLikeOverrides] = useState({});
  const [likeCountOverrides, setLikeCountOverrides] = useState({});

  // WS11d: viewers sheet
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);

  const group = groups[groupAt];
  const story = group?.stories?.[storyAt];
  const isFollowing = group ? (followOverrides[group.user_id] ?? group.is_following) : false;

  // WS11b: resolved like state
  const liked = story ? (likeOverrides[story.id] ?? story.liked_by_viewer) : false;
  const likeCount = story ? (likeCountOverrides[story.id] ?? story.like_count ?? 0) : 0;

  const close = useCallback(() => onClose?.(), [onClose]);

  const next = useCallback(() => {
    setElapsed(0);
    if (!group) return close();
    if (storyAt + 1 < group.stories.length) {
      setStoryAt(storyAt + 1);
    } else if (groupAt + 1 < groups.length) {
      setGroupAt(groupAt + 1);
      setStoryAt(0);
    } else {
      close();
    }
  }, [group, groupAt, groups.length, storyAt, close]);

  const prev = useCallback(() => {
    setElapsed(0);
    if (storyAt > 0) {
      setStoryAt(storyAt - 1);
    } else if (groupAt > 0) {
      const previousGroup = groups[groupAt - 1];
      setGroupAt(groupAt - 1);
      setStoryAt(Math.max(0, previousGroup.stories.length - 1));
    }
  }, [groupAt, groups, storyAt]);

  // Advance timer. Restarting on every story change is what resets the bar.
  useEffect(() => {
    if (paused || viewersOpen || !story) return undefined;
    const id = setInterval(() => {
      setElapsed(value => {
        if (value + TICK_MS >= STORY_MS) {
          // Defer the transition out of the state updater — calling next()
          // inline would set state during another component's render.
          queueMicrotask(next);
          return STORY_MS;
        }
        return value + TICK_MS;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, viewersOpen, story, next]);

  // One view receipt per story, sent as it appears.
  useEffect(() => {
    if (!story || sentRef.current.has(story.id)) return;
    sentRef.current.add(story.id);
    onViewed?.(story.id);
  }, [story, onViewed]);

  // A story player owns the whole screen, so it owns the keyboard and the
  // page's scroll while it is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, next, prev]);

  if (!story) return null;

  const handleDelete = async () => {
    // Move off the story first: deleting the frame you are looking at and
    // then unmounting reads as a crash, whereas advancing reads as "done".
    const target = story.id;
    next();
    await onDelete?.(target);
  };

  const goToAuthor = () => {
    if (group.is_mine) return;
    navigate(`/users/${group.user_id}`);
  };

  const toggleFollow = () => {
    const authorId = group.user_id;
    const next = !isFollowing;
    runOptimistic({
      apply: () => {
        setFollowOverrides(prev => ({ ...prev, [authorId]: next }));
        return () => setFollowOverrides(prev => ({ ...prev, [authorId]: !next }));
      },
      request: () => (next ? followUser(authorId) : unfollowUser(authorId)),
      failureMessage: 'Could not update that follow',
      dedupeKey: `story-follow-${authorId}`,
    });
  };

  // WS11b: like toggle
  const handleLike = () => {
    const storyId = story.id;
    const nextLiked = !liked;
    const nextCount = likeCount + (nextLiked ? 1 : -1);
    runOptimistic({
      apply: () => {
        setLikeOverrides(prev => ({ ...prev, [storyId]: nextLiked }));
        setLikeCountOverrides(prev => ({ ...prev, [storyId]: nextCount }));
        return () => {
          setLikeOverrides(prev => ({ ...prev, [storyId]: !nextLiked }));
          setLikeCountOverrides(prev => ({ ...prev, [storyId]: likeCount }));
        };
      },
      request: () => toggleStoryLike(storyId),
      failureMessage: 'Could not like that story',
      dedupeKey: `story-like-${storyId}`,
    });
  };

  // WS11d: open viewers sheet
  const handleViewersOpen = async () => {
    setPaused(true);
    setViewersOpen(true);
    try {
      const data = await getStoryViewers(story.id);
      setViewers(data.viewers || []);
    } catch {
      setViewers([]);
    }
  };

  // WS12: share story
  const handleShare = () => {
    shareBrandedImage({
      imageUrl: story.image_url,
      title: `${group.user_name || 'Someone'}'s story`,
      subtitle: 'on Well Circle',
      tag: 'story_share',
    });
  };

  const viewer = (
    <div className="story-viewer" id="story-viewer" role="dialog" aria-modal="true">
      <div className="story-viewer-progress">
        {group.stories.map((s, i) => (
          <span key={s.id} className="story-progress-track">
            <span
              className="story-progress-fill"
              style={{
                width: i < storyAt ? '100%'
                  : i > storyAt ? '0%'
                    : `${Math.min(100, (elapsed / STORY_MS) * 100)}%`,
              }}
            />
          </span>
        ))}
      </div>

      <div className="story-viewer-header">
        <span
          className="story-viewer-avatar"
          onClick={goToAuthor}
          style={{ cursor: group.is_mine ? 'default' : 'pointer' }}
        >
          <SmartImage
            src={group.user_photo_url}
            alt=""
            width={32}
            fallback={<span className="story-avatar-initial">{(group.user_name || '?').charAt(0)}</span>}
          />
        </span>
        <div
          className="story-viewer-meta"
          onClick={goToAuthor}
          style={{ cursor: group.is_mine ? 'default' : 'pointer' }}
        >
          <strong>{group.is_mine ? 'Your story' : group.user_name}</strong>
          <span>{timeAgo(story.created_at)}</span>
        </div>
        {story.is_mine && typeof story.view_count === 'number' && (
          <button
            className="story-viewer-count"
            title="People who viewed this story"
            onClick={handleViewersOpen}
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.85)' }}
            id="story-viewers-btn"
          >
            <Icon name="eye" size={14} /> {story.view_count}
          </button>
        )}
        {story.is_mine && onDelete && (
          <button className="story-viewer-btn" onClick={handleDelete} aria-label="Delete story" type="button">
            <Icon name="trash" size={17} />
          </button>
        )}
        <button className="story-viewer-btn" onClick={close} aria-label="Close" type="button">
          <Icon name="x" size={19} />
        </button>
      </div>

      <SmartImage
        key={story.id}
        src={story.image_url}
        alt=""
        width={720}
        priority
        className="story-viewer-image"
      />

      {/* Tap targets sit above the image and below the header controls. */}
      <button
        className="story-tap story-tap--prev"
        onClick={prev}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label="Previous story"
        type="button"
      />
      <button
        className="story-tap story-tap--next"
        onClick={next}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label="Next story"
        type="button"
      />

      {/* WS11b/WS12: action row with like + share */}
      <div className="story-viewer-actions">
        <button
          type="button"
          className={`story-like-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          id="story-like-btn"
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Icon name="heart" size={20} strokeWidth={liked ? 0 : 1.5} /> {likeCount > 0 ? likeCount : ''}
        </button>
        <button type="button" className="story-share-btn" onClick={handleShare} id="story-share-btn" aria-label="Share story">
          <Icon name="share" size={18} /> Share
        </button>
      </div>

      {!group.is_mine && (
        <div className="story-viewer-follow">
          <button
            type="button"
            className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
            onClick={toggleFollow}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      )}

      <div className="story-viewer-footer">
        Disappears {expiryLabel(story.expires_at)}
      </div>

      {/* WS11d: viewers bottom sheet */}
      {viewersOpen && (
        <>
          <div className="sheet-overlay" onClick={() => { setViewersOpen(false); setPaused(false); }} />
          <div className="story-viewers-sheet" id="story-viewers-sheet">
            <div className="sheet-handle" />
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>
              <Icon name="eye" size={16} /> {viewers.length} viewer{viewers.length !== 1 ? 's' : ''}
            </h4>
            <ul className="story-viewers-list">
              {viewers.map(v => (
                <li key={v.user_id} className="story-viewer-row" onClick={() => { setViewersOpen(false); navigate(`/users/${v.user_id}`); }}>
                  <div className="avatar avatar-sm">
                    <SmartImage src={v.photo_url} width={32} fallback={<Icon name="user" size={14} />} />
                  </div>
                  <div>
                    <div className="story-viewer-row-name">{v.name || 'User'}</div>
                    <div className="story-viewer-row-time">{timeAgo(v.viewed_at)}</div>
                  </div>
                </li>
              ))}
              {viewers.length === 0 && (
                <li style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '16px 0' }}>
                  No viewers yet
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );

  // Portalled to <body> so the circle screen's own stacking contexts and
  // bottom nav cannot clip a fullscreen player.
  return typeof document === 'undefined' ? viewer : createPortal(viewer, document.body);
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function expiryLabel(iso) {
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3600000);
  if (hours <= 0) return 'any moment now';
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
