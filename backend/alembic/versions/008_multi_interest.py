"""Multi-select onboarding passions: interest_category -> interest_categories

Revision ID: 008
Revises: 007
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('interest_categories', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Backfill existing single-value rows into the new array column before
    # dropping the old one — no user should lose their one existing passion.
    op.execute(
        "UPDATE users SET interest_categories = to_jsonb(ARRAY[interest_category]) "
        "WHERE interest_category IS NOT NULL"
    )
    op.drop_column('users', 'interest_category')


def downgrade() -> None:
    op.add_column('users', sa.Column('interest_category', sa.String(length=50), nullable=True))
    op.execute(
        "UPDATE users SET interest_category = interest_categories->>0 "
        "WHERE interest_categories IS NOT NULL AND jsonb_array_length(interest_categories) > 0"
    )
    op.drop_column('users', 'interest_categories')
