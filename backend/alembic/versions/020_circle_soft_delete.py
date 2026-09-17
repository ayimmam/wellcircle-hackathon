"""Circle soft delete (WS8 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

Adds `circles.deleted_at` so deleting a circle hides it (and its posts,
leaderboard, ranks, and social-proof counts) without destroying the row —
an admin can restore it later via `POST /api/admin/circles/{id}/restore`.

Revision ID: 020
Revises: 019
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("circles", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_circles_deleted_at", "circles", ["deleted_at"])


def downgrade():
    op.drop_index("ix_circles_deleted_at", table_name="circles")
    op.drop_column("circles", "deleted_at")
