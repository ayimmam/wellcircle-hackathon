"""Presale promo: promotion audience + booking discount tracking

Revision ID: 005
Revises: 004
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Who the promotion applies to: 'all' or 'first_time' (presale)
    op.add_column(
        'provider_promotions',
        sa.Column('audience', sa.String(length=20), server_default='all', nullable=False),
    )

    # Promotion applied to a booking at creation (server-side auto-apply)
    op.add_column(
        'bookings',
        sa.Column('promotion_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('provider_promotions.id'), nullable=True),
    )
    op.add_column('bookings', sa.Column('discount_etb', sa.Integer(), nullable=True))
    op.create_index('idx_bookings_promotion_id', 'bookings', ['promotion_id'])


def downgrade() -> None:
    op.drop_index('idx_bookings_promotion_id', table_name='bookings')
    op.drop_column('bookings', 'discount_etb')
    op.drop_column('bookings', 'promotion_id')
    op.drop_column('provider_promotions', 'audience')
