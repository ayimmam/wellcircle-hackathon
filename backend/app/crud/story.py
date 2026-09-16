"""Public story CRUD — posting, reading, view receipts, and the 72h purge
(WS1 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

Stories are public: any signed-in user can see any other user's active
story. There is no membership check anywhere in this file — that's the
whole point of the rebuild from `circle_story.py`, which gated everything
on circle membership.
"""

from collections import OrderedDict
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.story import STORY_TTL, Story, StoryView
from app.models.user import User
from app.utils.logger import get_logger

logger = get_logger(__name__)

# A ceiling on simultaneously-visible stories from one person. Without it a
# single member can push everyone else off the rail; with it the cost of
# abuse is bounded and self-healing, since the oldest expires first.
MAX_ACTIVE_STORIES_PER_USER = 10


def _now():
    return datetime.now(timezone.utc)


def _active_filter(query):
    """Unexpired and not yet purged — the definition of 'visible' everywhere."""
    return query.filter(
        Story.expires_at > _now(),
        Story.deleted_at.is_(None),
    )


def _destroy_asset(public_id: str) -> bool:
    """Best-effort Cloudinary delete. Never raises: a storage error must not
    keep a story visible, and the next purge run retries anything left behind."""
    if not public_id:
        return False
    try:
        from app.services.cloudinary_service import delete_file
        delete_file(public_id, resource_type="image")
        return True
    except Exception:
        logger.exception("Cloudinary delete failed for %s", public_id)
        return False


def create_story(db: Session, user: User, image_url: str, image_public_id: str) -> Story:
    """Create the row. Points are awarded by the API layer (POST
    /api/stories), not here, so this stays a pure "write the row" function —
    matching create_post()'s split in crud/post.py."""
    active = _active_filter(
        db.query(func.count(Story.id)).filter(Story.user_id == user.id)
    ).scalar() or 0
    if active >= MAX_ACTIVE_STORIES_PER_USER:
        raise ValueError(
            f"You already have {MAX_ACTIVE_STORIES_PER_USER} active stories"
        )

    now = _now()
    story = Story(
        user_id=user.id,
        image_url=image_url,
        image_public_id=image_public_id,
        created_at=now,
        expires_at=now + STORY_TTL,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def _serialize(story: Story, author: Optional[User], seen: bool, view_count: int,
               viewer_id: UUID, is_following: bool) -> dict:
    return {
        "id": str(story.id),
        "user_id": str(story.user_id),
        "user_name": author.name if author else None,
        "user_photo_url": author.photo_url if author else None,
        "image_url": story.image_url,
        "created_at": story.created_at,
        "expires_at": story.expires_at,
        "seen": seen,
        # Only the author is told how many people looked — a viewer count is
        # the author's feedback, not another viewer's business.
        "view_count": view_count if story.user_id == viewer_id else None,
        "is_mine": story.user_id == viewer_id,
        "is_following": is_following,
    }


def _hydrate(db: Session, stories: List[Story], viewer_id: UUID) -> List[dict]:
    """Turn story rows into rail payloads with a fixed number of batched
    lookups rather than per-story queries — the rail loads on every For You
    paint."""
    if not stories:
        return []

    story_ids = [s.id for s in stories]
    author_ids = {s.user_id for s in stories}
    authors = {u.id: u for u in db.query(User).filter(User.id.in_(author_ids)).all()}
    seen_ids = {
        row[0] for row in
        db.query(StoryView.story_id).filter(
            StoryView.story_id.in_(story_ids),
            StoryView.user_id == viewer_id,
        ).all()
    }
    view_counts = dict(
        db.query(StoryView.story_id, func.count(StoryView.user_id))
        .filter(StoryView.story_id.in_(story_ids))
        .group_by(StoryView.story_id).all()
    )
    from app.models.follower import Follower
    following_ids = {
        row[0] for row in
        db.query(Follower.following_id).filter(
            Follower.follower_id == viewer_id,
            Follower.following_id.in_(author_ids),
        ).all()
    }

    return [
        _serialize(
            s, authors.get(s.user_id),
            seen=s.id in seen_ids,
            view_count=int(view_counts.get(s.id, 0)),
            viewer_id=viewer_id,
            is_following=s.user_id in following_ids,
        )
        for s in stories
    ]


def get_story_rail(db: Session, viewer_id: UUID) -> List[dict]:
    """Every active story from every user, grouped by author.

    Ordering:
      1. the viewer's own group,
      2. authors the viewer follows, with an unseen story,
      3. everyone else with an unseen story,
      4. fully-seen groups;
    each tier sorted by most recent story first.
    """
    stories = _active_filter(db.query(Story)).order_by(Story.created_at.asc()).all()
    if not stories:
        return []

    items = _hydrate(db, stories, viewer_id)

    groups: "OrderedDict[str, dict]" = OrderedDict()
    for item in items:
        group = groups.get(item["user_id"])
        if not group:
            group = {
                "user_id": item["user_id"],
                "user_name": item["user_name"],
                "user_photo_url": item["user_photo_url"],
                "is_mine": item["is_mine"],
                "is_following": item["is_following"],
                "stories": [],
            }
            groups[item["user_id"]] = group
        group["stories"].append(item)

    result = list(groups.values())
    for group in result:
        group["has_unseen"] = any(not s["seen"] for s in group["stories"])
        group["story_count"] = len(group["stories"])
        group["latest_at"] = group["stories"][-1]["created_at"]

    def sort_key(g):
        # False sorts before True, so "not X" puts X=True groups first.
        tier = 0 if g["is_mine"] else (1 if g["is_following"] and g["has_unseen"] else (2 if g["has_unseen"] else 3))
        return (tier, -g["latest_at"].timestamp())

    result.sort(key=sort_key)
    return result


def mark_story_viewed(db: Session, story_id: UUID, user_id: UUID) -> int:
    """Record a view receipt (idempotent) and return the story's view count.
    No membership check — stories are public."""
    story = _active_filter(db.query(Story).filter(Story.id == story_id)).first()
    if not story:
        raise LookupError("Story not found")

    existing = db.query(StoryView).filter_by(story_id=story_id, user_id=user_id).first()
    if not existing:
        db.add(StoryView(story_id=story_id, user_id=user_id))
        db.commit()

    return int(
        db.query(func.count(StoryView.user_id))
        .filter(StoryView.story_id == story_id).scalar() or 0
    )


def delete_story(db: Session, story_id: UUID, user_id: UUID, is_admin: bool = False) -> None:
    """Author or a super admin removes a story early.

    The Cloudinary asset goes immediately — the whole point of the feature is
    that the photo does not outlive its window — and the row is stamped
    `deleted_at` so the nightly purge skips it.
    """
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story or story.deleted_at:
        raise LookupError("Story not found")

    if story.user_id != user_id and not is_admin:
        raise PermissionError("Only the author can delete a story")

    _destroy_asset(story.image_public_id)
    story.deleted_at = _now()
    # Expire it too, so a failed Cloudinary call still takes the story off the
    # rail on the next read rather than leaving it visible.
    story.expires_at = _now()
    db.commit()


def purge_expired_stories(db: Session, limit: int = 500) -> int:
    """Hard-delete the Cloudinary assets behind stories past their 72 hours.

    Called from the daily maintenance job. Expired stories are already invisible
    (every read filters on `expires_at`), so this is purely about not keeping
    the bytes; rows whose delete fails keep `deleted_at` NULL and are retried on
    the next run.
    """
    expired = (
        db.query(Story)
        .filter(Story.expires_at <= _now(), Story.deleted_at.is_(None))
        .order_by(Story.expires_at.asc())
        .limit(limit)
        .all()
    )
    if not expired:
        return 0

    purged = 0
    for story in expired:
        if _destroy_asset(story.image_public_id):
            story.deleted_at = _now()
            purged += 1

    # View receipts are worthless once the image is gone, and they are the only
    # thing referencing the row, so drop them with it.
    if purged:
        purged_ids = [s.id for s in expired if s.deleted_at]
        db.query(StoryView).filter(
            StoryView.story_id.in_(purged_ids)
        ).delete(synchronize_session=False)

    db.commit()
    logger.info("Purged %s expired stories from Cloudinary", purged)
    return purged
