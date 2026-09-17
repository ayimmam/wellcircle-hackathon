"""Custom avatar (WS9 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

`users.photo_url` was overwritten by the Telegram photo on every login,
reverting any custom photo the user set. `photo_is_custom` opts a user's
row out of that sync once they've paid to change it; `photo_public_id` lets
a later change destroy the Cloudinary asset it replaces instead of leaking it.

Revision ID: 021
Revises: 020
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("users", sa.Column("photo_is_custom", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("photo_public_id", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("users", "photo_public_id")
    op.drop_column("users", "photo_is_custom")
