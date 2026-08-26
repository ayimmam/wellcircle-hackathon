"""Personal-best streak tracking: users.longest_streak

Revision ID: 016
Revises: 015
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '016'
down_revision: Union[str, None] = '015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('longest_streak', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('users', 'longest_streak')
