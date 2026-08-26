"""Circle story CRUD — posting, reading, view receipts and the 72h purge.

Membership is the access rule throughout: only members of a circle can post a
story into it or see one, and for a paid circle that means the same
`has_circle_access` gate the leaderboard already uses. There is no public
story anywhere.
"""

from collections import OrderedDict
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.circle import Circle, CircleMember
from app.models.circle_story import STORY_TTL, CircleStory, CircleStoryView
from app.models.user import User
from app.utils.logger import get_logger

logger = get_logger(__name__)

# A ceiling on simultaneously-visible stories from one person in one circle.
# Without it a single member can push everyone else off the rail; with it the
# cost of abuse is bounded and self-healing, since the oldest expires first.
MAX_ACTIVE_STORIES_PER_CIRCLE = 10


def _now():
    return datetime.now(timezone.utc)


def _active_filter(query):
    """Unexpired and not yet purged — the definition of 'visible' everywhere."""
    return query.filter(
        CircleStory.expires_at > _now(),
        CircleStory.deleted_at.is_(None),
    )


def _member_circle_ids(db: Session, user_id: UUID) -> List[UUID]:
    return [
        row[0] for row in
        db.query(CircleMember.circle_id).filter(CircleMember.user_id == user_id).all()
    ]


def create_story(db: Session, circle_id: UUID, user_id: UUID, image_url: str,
                 image_public_id: str) -> CircleStory:
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")

    from app.crud.circle_subscription import has_circle_access

    is_member = db.query(CircleMember).filter_by(
        circle_id=circle_id, user_id=user_id
    ).first() is not None
    if not (is_member or circle.owner_id == user_id):
        raise PermissionError("Join this circle to post a story")
    if not has_circle_access(db, circle_id, user_id):
        raise PermissionError("Paid circle access required")

    active = _active_filter(
        db.query(func.count(CircleStory.id)).filter(
            CircleStory.circle_id == circle_id, CircleStory.user_id == user_id
        )
    ).scalar() or 0
    if active >= MAX_ACTIVE_STORIES_PER_CIRCLE:
        raise ValueError(
            f"You already have {MAX_ACTIVE_STORIES_PER_CIRCLE} active stories in this circle"
        )

    now = _now()
    story = CircleStory(
        circle_id=circle_id,
        user_id=user_id,
        image_url=image_url,
        image_public_id=image_public_id,
        created_at=now,
        expires_at=now + STORY_TTL,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def _serialize(story: CircleStory, author: Optional[User], circle: Optional[Circle],
               seen: bool, view_count: int, viewer_id: UUID) -> dict:
    return {
        "id": str(story.id),
        "circle_id": str(story.circle_id),
        "circle_name": circle.name if circle else None,
        "user_id": str(story.user_id),
        "user_name": author.name if author else None,
        "user_photo_url": author.photo_url if author else None,
        "image_url": story.image_url,
        "created_at": story.created_at,
        "expires_at": story.expires_at,
        "seen": seen,
        # Only the author is told how many people looked — a viewer count is
        # the author's feedback, not another member's business.
        "view_count": view_count if story.user_id == viewer_id else None,
        "is_mine": story.user_id == viewer_id,
    }


def _hydrate(db: Session, stories: List[CircleStory], viewer_id: UUID) -> List[dict]:
    """Turn story rows into rail payloads with two batched lookups rather than
    per-story queries — the rail loads on every For You paint."""
    if not stories:
        return []

    story_ids = [s.id for s in stories]
    authors = {
        u.id: u for u in
        db.query(User).filter(User.id.in_({s.user_id for s in stories})).all()
    }
    circles = {
        c.id: c for c in
        db.query(Circle).filter(Circle.id.in_({s.circle_id for s in stories})).all()
    }
    seen_ids = {
        row[0] for row in
        db.query(CircleStoryView.story_id).filter(
            CircleStoryView.story_id.in_(story_ids),
            CircleStoryView.user_id == viewer_id,
        ).all()
    }
    view_counts = dict(
        db.query(CircleStoryView.story_id, func.count(CircleStoryView.user_id))
        .filter(CircleStoryView.story_id.in_(story_ids))
        .group_by(CircleStoryView.story_id).all()
    )

    return [
        _serialize(
            s, authors.get(s.user_id), circles.get(s.circle_id),
            seen=s.id in seen_ids,
            view_count=int(view_counts.get(s.id, 0)),
            viewer_id=viewer_id,
        )
        for s in stories
    ]


def get_circle_stories(db: Session, circle_id: UUID, user_id: UUID) -> List[dict]:
    """Active stories in one circle, oldest first (playback order)."""
    from app.crud.circle_subscription import has_circle_access

    is_member = db.query(CircleMember).filter_by(
        circle_id=circle_id, user_id=user_id
    ).first() is not None
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if not (is_member or circle.owner_id == user_id):
        return []
    if not has_circle_access(db, circle_id, user_id):
        return []

    stories = _active_filter(
        db.query(CircleStory).filter(CircleStory.circle_id == circle_id)
    ).order_by(CircleStory.created_at.asc()).all()
    return _hydrate(db, stories, user_id)


def get_story_rail(db: Session, user_id: UUID) -> List[dict]:
    """The For You rail: every active story from every circle the user is in,
    grouped by author.

    Ordering is the Instagram convention — people with something unseen come
    first, then most recent activity. Within a person, stories play oldest
    first. The caller's own group is pinned to the front so "Your story" is
    always the first ring.
    """
    circle_ids = _member_circle_ids(db, user_id)
    if not circle_ids:
        return []

    # A paid circle the user is a member of already passes has_circle_access
    # (members are grandfathered), so membership alone is the right filter here.
    stories = _active_filter(
        db.query(CircleStory).filter(CircleStory.circle_id.in_(circle_ids))
    ).order_by(CircleStory.created_at.asc()).all()
    if not stories:
        return []

    items = _hydrate(db, stories, user_id)

    groups: "OrderedDict[str, dict]" = OrderedDict()
    for item in items:
        group = groups.get(item["user_id"])
        if not group:
            group = {
                "user_id": item["user_id"],
                "user_name": item["user_name"],
                "user_photo_url": item["user_photo_url"],
                "is_mine": item["is_mine"],
                "stories": [],
            }
            groups[item["user_id"]] = group
        group["stories"].append(item)

    result = list(groups.values())
    for group in result:
        group["has_unseen"] = any(not s["seen"] for s in group["stories"])
        group["story_count"] = len(group["stories"])
        group["latest_at"] = group["stories"][-1]["created_at"]

    result.sort(
        key=lambda g: (not g["is_mine"], not g["has_unseen"], -g["latest_at"].timestamp())
    )
    return result


def mark_story_viewed(db: Session, story_id: UUID, user_id: UUID) -> int:
    """Record a view receipt (idempotent) and return the story's view count."""
    story = _active_filter(db.query(CircleStory).filter(CircleStory.id == story_id)).first()
    if not story:
        raise LookupError("Story not found")

    is_member = db.query(CircleMember).filter_by(
        circle_id=story.circle_id, user_id=user_id
    ).first() is not None
    if not is_member and story.user_id != user_id:
        raise PermissionError("Join this circle to view its stories")

    existing = db.query(CircleStoryView).filter_by(story_id=story_id, user_id=user_id).first()
    if not existing:
        db.add(CircleStoryView(story_id=story_id, user_id=user_id))
        db.commit()

    return int(
        db.query(func.count(CircleStoryView.user_id))
        .filter(CircleStoryView.story_id == story_id).scalar() or 0
    )


def delete_story(db: Session, story_id: UUID, user_id: UUID) -> None:
    """Author or circle owner removes a story early.

    The Cloudinary asset goes immediately — the whole point of the feature is
    that the photo does not outlive its window — and the row is stamped
    `deleted_at` so the nightly purge skips it.
    """
    story = db.query(CircleStory).filter(CircleStory.id == story_id).first()
    if not story or story.deleted_at:
        raise LookupError("Story not found")

    circle = db.query(Circle).filter(Circle.id == story.circle_id).first()
    if story.user_id != user_id and not (circle and circle.owner_id == user_id):
        raise PermissionError("Only the author or the circle owner can delete a story")

    _destroy_asset(story.image_public_id)
    story.deleted_at = _now()
    # Expire it too, so a failed Cloudinary call still takes the story off the
    # rail on the next read rather than leaving it visible.
    story.expires_at = _now()
    db.commit()


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


def purge_expired_stories(db: Session, limit: int = 500) -> int:
    """Hard-delete the Cloudinary assets behind stories past their 72 hours.

    Called from the daily maintenance job. Expired stories are already invisible
    (every read filters on `expires_at`), so this is purely about not keeping
    the bytes; rows whose delete fails keep `deleted_at` NULL and are retried on
    the next run.
    """
    expired = (
        db.query(CircleStory)
        .filter(CircleStory.expires_at <= _now(), CircleStory.deleted_at.is_(None))
        .order_by(CircleStory.expires_at.asc())
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
        db.query(CircleStoryView).filter(
            CircleStoryView.story_id.in_(purged_ids)
        ).delete(synchronize_session=False)

    db.commit()
    logger.info("Purged %s expired stories from Cloudinary", purged)
    return purged
