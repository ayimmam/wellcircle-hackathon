"""Provider community channels for event RSVP hand-off

Revision ID: 022
Revises: 021
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '022'
down_revision: Union[str, None] = '021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # An event RSVP is a hand-off, not a checkout: WellCircle collects no
    # money for events, so the RSVP screen shows the price and the host's own
    # channel for the guest to arrange payment through. 006 added phone and
    # email for direct-contact *service* bookings; community event hosts
    # publish a wider mix — Telegram channels, Instagram, or just a website.
    #
    # Handles are stored without the leading '@' and the website without a
    # scheme, so the UI owns how each one is rendered as a link.
    op.add_column('providers', sa.Column('contact_telegram', sa.String(length=100), nullable=True))
    op.add_column('providers', sa.Column('contact_instagram', sa.String(length=100), nullable=True))
    op.add_column('providers', sa.Column('contact_website', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('providers', 'contact_website')
    op.drop_column('providers', 'contact_instagram')
    op.drop_column('providers', 'contact_telegram')
