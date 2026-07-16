"""Strava-style circle activity: post stats + one-level comment replies

Revision ID: 009
Revises: 008
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('activity_type', sa.String(length=30), nullable=True))
    op.add_column('posts', sa.Column('distance_km', sa.Numeric(6, 2), nullable=True))
    op.add_column('posts', sa.Column('duration_min', sa.Integer(), nullable=True))
    op.add_column('posts', sa.Column('photo_url', sa.String(length=500), nullable=True))
    op.add_column(
        'post_comments',
        sa.Column('parent_comment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('post_comments.id'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('post_comments', 'parent_comment_id')
    op.drop_column('posts', 'photo_url')
    op.drop_column('posts', 'duration_min')
    op.drop_column('posts', 'distance_km')
    op.drop_column('posts', 'activity_type')
