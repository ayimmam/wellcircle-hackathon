"""Chat session ownership for the Circler concierge.

Revision ID: 031
Revises: 030 (renumbered from an earlier feature-branch 028 to keep the
Alembic revision IDs unique)

The SQL file is the canonical definition. This revision executes it directly so
the Alembic and Supabase SQL-editor paths cannot drift. Downgrade removes the
ownership columns and restores the Phase 1 RPC from its canonical SQL file.
"""

from pathlib import Path

from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None

_MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
_MIGRATION_SQL = _MIGRATIONS / "028_chat_memory_ownership.sql"
_PHASE1_SQL = _MIGRATIONS / "027_chat_memory_append.sql"


def upgrade():
    op.execute(_MIGRATION_SQL.read_text(encoding="utf-8"))


def downgrade():
    op.execute(
        """
        DROP FUNCTION IF EXISTS public.append_chat_turn(
            text, text, text, text, text, timestamptz, integer, double precision
        )
        """
    )
    op.execute(
        """
        ALTER TABLE public.chat_memory
            DROP COLUMN IF EXISTS owner_id,
            DROP COLUMN IF EXISTS owner_type
        """
    )
    # Restore the Phase 1 RPC shape. Revision 028 intentionally leaves RLS and
    # table-privilege hardening in place on downgrade.
    op.execute(_PHASE1_SQL.read_text(encoding="utf-8"))
