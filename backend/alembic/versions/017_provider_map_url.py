"""Provider map_url — a direct Google Maps place link for "Open in Maps"
when a provider has a shared link but no coordinates.

Revision ID: 017
Revises: 016
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("providers", sa.Column("map_url", sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column("providers", "map_url")
