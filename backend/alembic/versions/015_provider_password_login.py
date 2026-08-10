"""Provider portal username/password login — alt path to the Telegram
Login Widget for provider staff accounts without a linked Telegram login.

Revision ID: 015
Revises: 014
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("users", sa.Column("login_username", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_login_username", "users", ["login_username"])
    op.create_index("ix_users_login_username", "users", ["login_username"])


def downgrade():
    op.drop_index("ix_users_login_username", table_name="users")
    op.drop_constraint("uq_users_login_username", "users", type_="unique")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "login_username")
