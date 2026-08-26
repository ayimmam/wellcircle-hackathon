"""Circle stories (72h ephemeral photos) and circle banner images.

Revision ID: 018
Revises: 017
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("circles", sa.Column("banner_url", sa.String(length=500), nullable=True))
    op.add_column("circles", sa.Column("banner_public_id", sa.String(length=255), nullable=True))

    op.create_table(
        "circle_stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("circles.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("image_public_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_circle_stories_active", "circle_stories", ["circle_id", "expires_at", "deleted_at"]
    )
    op.create_index("ix_circle_stories_user", "circle_stories", ["user_id", "created_at"])

    op.create_table(
        "circle_story_views",
        sa.Column("story_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("circle_stories.id"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade():
    op.drop_table("circle_story_views")
    op.drop_index("ix_circle_stories_user", table_name="circle_stories")
    op.drop_index("ix_circle_stories_active", table_name="circle_stories")
    op.drop_table("circle_stories")
    op.drop_column("circles", "banner_public_id")
    op.drop_column("circles", "banner_url")
