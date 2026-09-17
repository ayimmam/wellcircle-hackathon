import { useMemo, useState } from 'react';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import StoryViewer from './StoryViewer';

const AVATAR_PX = 62;

/**
 * The horizontal rail of story rings.
 *
 * Grouped by person, Instagram-style: one ring per author, and tapping a
 * ring plays that person's stories in order. The ring is the close-friends
 * green — a solid colour rather than the multi-hue gradient — since a
 * signed-in viewer sees every story regardless of who posted it (WS1 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md: stories are public, not
 * circle-scoped).
 *
 * A group whose stories have all been seen drops to a flat grey ring, so the
 * rail answers "is there anything new" at a glance. The viewer's own ring
 * can additionally be `pending` (a conic-gradient progress arc while an
 * upload is in flight) or `failed` (a dashed red ring; tapping retries
 * instead of opening the viewer).
 *
 * @param {{groups?: Array, currentUser?: object, onAddStory?: () => void,
 *          canAddStory?: boolean, onViewed?: (storyId: string) => void,
 *          onDelete?: (storyId: string) => void,
 *          onRetryFailed?: () => void}} props
 */
export default function StoryRail({
  groups,
  currentUser,
  onAddStory,
  canAddStory = false,
  onViewed,
  onDelete,
  onRetryFailed,
}) {
  const [openAt, setOpenAt] = useState(null);

  // Only groups that still have something to play. The backend already
  // filters expired stories, but a rail warmed from cache can outlive them.
  const playable = useMemo(
    () => (groups || []).filter(g => (g.stories || []).length > 0),
    [groups],
  );

  const mine = playable.find(g => g.is_mine);
  const showAddTile = canAddStory && !mine;
  const pendingStory = mine?.stories?.find(s => s.pending);
  const failedStory = mine?.stories?.find(s => s.failed);

  if (playable.length === 0 && !showAddTile) return null;

  const ownRingStyle = pendingStory
    ? { background: `conic-gradient(var(--accent) ${(pendingStory.progress || 0) * 3.6}deg, var(--bg-tertiary) 0deg)` }
    : undefined;

  return (
    <>
      <div className="story-rail" id="story-rail">
        {showAddTile && (
          <button className="story-item" onClick={onAddStory} type="button" id="story-add-tile">
            <span className="story-ring story-ring--add">
              <span className="story-avatar">
                <SmartImage
                  src={currentUser?.photo_url}
                  alt=""
                  width={AVATAR_PX}
                  fallback={<span className="story-avatar-initial">{initial(currentUser?.name)}</span>}
                />
              </span>
              <span className="story-add-badge" aria-hidden="true">
                <Icon name="plus" size={12} />
              </span>
            </span>
            <span className="story-label">Your story</span>
          </button>
        )}

        {playable.map((group, i) => {
          const isMineWithUpload = group.is_mine && (pendingStory || failedStory);
          return (
            <button
              key={group.user_id}
              type="button"
              className="story-item"
              onClick={() => {
                if (failedStory) return onRetryFailed?.();
                if (pendingStory) return; // nothing to play yet
                setOpenAt(i);
              }}
              aria-label={
                failedStory ? 'Retry posting your story'
                  : group.is_mine ? 'Your story'
                    : `${group.user_name || 'Member'}'s story`
              }
              id={isMineWithUpload ? 'story-own-upload-ring' : undefined}
            >
              <span
                className={
                  failedStory ? 'story-ring story-ring--failed'
                    : pendingStory ? 'story-ring story-ring--pending'
                      : `story-ring ${group.has_unseen ? 'story-ring--unseen' : 'story-ring--seen'}`
                }
                style={group.is_mine ? ownRingStyle : undefined}
              >
                <span className="story-avatar">
                  <SmartImage
                    src={group.user_photo_url}
                    alt=""
                    width={AVATAR_PX}
                    fallback={<span className="story-avatar-initial">{initial(group.user_name)}</span>}
                  />
                </span>
                {group.is_mine && canAddStory && !pendingStory && (
                  <span
                    className="story-add-badge"
                    aria-hidden="true"
                    onClick={(e) => { e.stopPropagation(); onAddStory?.(); }}
                  >
                    <Icon name="plus" size={12} />
                  </span>
                )}
              </span>
              <span className="story-label">
                {failedStory ? 'Tap to retry'
                  : pendingStory ? 'Posting…'
                    : group.is_mine ? 'Your story' : firstName(group.user_name)}
              </span>
            </button>
          );
        })}
      </div>

      {openAt !== null && (
        <StoryViewer
          groups={playable}
          startIndex={openAt}
          onClose={() => setOpenAt(null)}
          onViewed={onViewed}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function firstName(name) {
  if (!name) return 'Member';
  return name.split(' ')[0];
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}
