"""Provider launch state — coming-soon gating, Sheets export flag, facilities
and navigation tips (For You / Boston Day Spa pilot).

Revision ID: 014
Revises: 013
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "providers",
        sa.Column("is_coming_soon", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "providers",
        sa.Column("sheets_export_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("providers", sa.Column("facilities", JSONB(), nullable=True))
    op.add_column("providers", sa.Column("navigation_tips", JSONB(), nullable=True))


def downgrade():
    op.drop_column("providers", "navigation_tips")
    op.drop_column("providers", "facilities")
    op.drop_column("providers", "sheets_export_enabled")
    op.drop_column("providers", "is_coming_soon")
