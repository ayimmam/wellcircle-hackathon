"""Public, user-level stories (WS1 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

Replaces circle-scoped stories (018) with stories that belong to a user, not
a circle — visible to every signed-in user, not just circle members. Existing
rows in `circle_stories` are copied forward (dropping circle scoping; the
photo and its author carry over) so nobody's still-active story disappears
mid-flight. The old tables are left in place for one release rather than
dropped here — `app/crud/circle_story.py` and its API routes still exist
this release as a deprecated alias.

Revision ID: 019
Revises: 018
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("image_public_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_stories_active", "stories", ["expires_at", "deleted_at"])
    op.create_index("ix_stories_user", "stories", ["user_id", "created_at"])

    op.create_table(
        "story_views",
        sa.Column("story_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stories.id"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Carry forward any still-active circle stories, dropping circle scoping.
    op.execute("""
        INSERT INTO stories (id, user_id, image_url, image_public_id, created_at, expires_at, deleted_at)
        SELECT id, user_id, image_url, image_public_id, created_at, expires_at, deleted_at
        FROM circle_stories
        ON CONFLICT (id) DO NOTHING
    """)
    op.execute("""
        INSERT INTO story_views (story_id, user_id, viewed_at)
        SELECT story_id, user_id, viewed_at
        FROM circle_story_views
        ON CONFLICT (story_id, user_id) DO NOTHING
    """)


def downgrade():
    op.drop_table("story_views")
    op.drop_index("ix_stories_user", table_name="stories")
    op.drop_index("ix_stories_active", table_name="stories")
    op.drop_table("stories")
