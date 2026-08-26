import { useMemo, useState } from 'react';
import SmartImage from '../SmartImage';
import Icon from '../Icon';
import StoryViewer from './StoryViewer';

const AVATAR_PX = 62;

/**
 * The horizontal rail of story rings.
 *
 * Grouped by person, Instagram-style: one ring per author regardless of how
 * many circles they posted into, and tapping a ring plays that person's
 * stories in order. The ring is the close-friends green — a solid colour
 * rather than the multi-hue gradient — because every story here is inside a
 * circle you belong to, which is exactly what that colour means on Instagram.
 *
 * A group whose stories have all been seen drops to a flat grey ring, so the
 * rail answers "is there anything new" at a glance.
 *
 * @param {{groups?: Array, currentUser?: object, onAddStory?: () => void,
 *          canAddStory?: boolean, onViewed?: (storyId: string) => void,
 *          onDelete?: (storyId: string) => void}} props
 */
export default function StoryRail({
  groups,
  currentUser,
  onAddStory,
  canAddStory = false,
  onViewed,
  onDelete,
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

  if (playable.length === 0 && !showAddTile) return null;

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

        {playable.map((group, i) => (
          <button
            key={group.user_id}
            type="button"
            className="story-item"
            onClick={() => setOpenAt(i)}
            aria-label={`${group.user_name || 'Member'}'s story`}
          >
            <span
              className={`story-ring ${group.has_unseen ? 'story-ring--unseen' : 'story-ring--seen'}`}
            >
              <span className="story-avatar">
                <SmartImage
                  src={group.user_photo_url}
                  alt=""
                  width={AVATAR_PX}
                  fallback={<span className="story-avatar-initial">{initial(group.user_name)}</span>}
                />
              </span>
              {group.is_mine && canAddStory && (
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
              {group.is_mine ? 'Your story' : firstName(group.user_name)}
            </span>
          </button>
        ))}
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
