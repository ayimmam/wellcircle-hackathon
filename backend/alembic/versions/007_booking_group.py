"""Multi-day booking group correlation id

Revision ID: 007
Revises: 006
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bookings created together for a multi-day selection (same service/time,
    # several days) share this key so one payment can cascade to the whole
    # group. No FK — it's a correlation id, not a relationship.
    op.add_column('bookings', sa.Column('booking_group_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('idx_bookings_group_id', 'bookings', ['booking_group_id'])


def downgrade() -> None:
    op.drop_index('idx_bookings_group_id', table_name='bookings')
    op.drop_column('bookings', 'booking_group_id')
