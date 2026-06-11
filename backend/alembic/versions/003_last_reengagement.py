"""Add last_reengagement_at to users

Revision ID: 003_reengagement
Revises: 002_phase3
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_reengagement_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_reengagement_at")
