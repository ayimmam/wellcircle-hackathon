"""User preferences: phone_number + time_format

Revision ID: 010
Revises: 009
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '010'
down_revision: Union[str, None] = '009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone_number', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('time_format', sa.String(length=3), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'time_format')
    op.drop_column('users', 'phone_number')
