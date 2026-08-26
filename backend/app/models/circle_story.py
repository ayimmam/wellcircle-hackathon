"""Circle story ORM models — 72-hour ephemeral photos posted into a circle.

Two clocks matter here and they are deliberately different:

  * `expires_at` is the *visibility* clock. Every read filters on it, so a
    story stops being served the moment it turns 72 hours old, with no job
    involved.
  * `deleted_at` is the *storage* clock. It is stamped only once the bytes are
    actually gone from Cloudinary, which the daily maintenance job does. Until
    then the row survives so the purge has a `public_id` to delete.

Keeping them separate means a late or failed purge can never leak an expired
story back onto a screen — the worst case is an orphaned Cloudinary asset that
the next run picks up.
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


class CircleStory(Base):
    __tablename__ = "circle_stories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    # Cloudinary's handle for the asset — the purge job cannot delete without it.
    image_public_id = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False, default=_default_expires_at)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # The rail query is "everything unexpired, not yet purged, in these
        # circles" — this is the index that keeps it off a sequential scan as
        # the table grows.
        Index("ix_circle_stories_active", "circle_id", "expires_at", "deleted_at"),
        Index("ix_circle_stories_user", "user_id", "created_at"),
    )


class CircleStoryView(Base):
    """One row per (story, viewer). Drives both the dimmed ring on the rail and
    the viewer count the author sees on their own story."""

    __tablename__ = "circle_story_views"

    story_id = Column(UUID(as_uuid=True), ForeignKey("circle_stories.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    viewed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
