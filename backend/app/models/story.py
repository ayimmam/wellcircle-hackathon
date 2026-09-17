"""Public, user-level story ORM models — 72-hour ephemeral photos, visible to
every signed-in user (WS1 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

Replaces `circle_story.py`'s circle-scoped version — a story belongs to a
user now, not a circle, and there is no membership check anywhere in this
file. The two-clock design carries over unchanged:

  * `expires_at` is the *visibility* clock. Every read filters on it, so a
    story stops being served the moment it turns 72 hours old, with no job
    involved.
  * `deleted_at` is the *storage* clock. It is stamped only once the bytes are
    actually gone from Cloudinary, which the daily maintenance job does. Until
    then the row survives so the purge has a `public_id` to delete.
"""

from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

# How long a story stays visible. Also the offset used to stamp expires_at at
# write time, so the lifetime of a story is fixed when it is posted rather than
# recomputed against a constant that might change later.
STORY_TTL = timedelta(hours=72)


def _default_expires_at():
    return datetime.now(timezone.utc) + STORY_TTL


class Story(Base):
    __tablename__ = "stories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    # Cloudinary's handle for the asset — the purge job cannot delete without it.
    image_public_id = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False, default=_default_expires_at)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # The rail query is "everyone's unexpired, not-yet-purged stories" —
        # this is the index that keeps it off a sequential scan as the table
        # grows.
        Index("ix_stories_active", "expires_at", "deleted_at"),
        Index("ix_stories_user", "user_id", "created_at"),
    )


class StoryView(Base):
    """One row per (story, viewer). Drives both the dimmed ring on the rail and
    the viewer count the author sees on their own story."""

    __tablename__ = "story_views"

    story_id = Column(UUID(as_uuid=True), ForeignKey("stories.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    viewed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
