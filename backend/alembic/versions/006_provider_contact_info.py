"""Provider direct-contact fields for phone/email-only bookings

Revision ID: 006
Revises: 005
Create Date: 2026-07-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Some providers/services aren't booked online at all (Kuriftu gap
    # analysis, Jul 15) — the guest contacts the provider directly and pays
    # on-site after the service. Individual services flag this via the
    # existing `booking_method` key in the `services` JSONB (no migration
    # needed for that part); these columns hold the contact details the
    # booking screen shows for those services.
    op.add_column('providers', sa.Column('contact_phone', sa.String(length=30), nullable=True))
    op.add_column('providers', sa.Column('contact_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('providers', 'contact_email')
    op.drop_column('providers', 'contact_phone')
