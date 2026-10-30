"""Atomic append RPC for chatbot conversation memory.

Revision ID: 027
Revises: 026

The SQL file is the canonical definition. This revision executes it directly so
the Alembic and Supabase SQL-editor paths cannot drift.
"""

from pathlib import Path

from alembic import op

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None

_MIGRATION_SQL = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "027_chat_memory_append.sql"
)


def upgrade():
    op.execute(_MIGRATION_SQL.read_text(encoding="utf-8"))


def downgrade():
    op.execute(
        """
        DROP FUNCTION IF EXISTS public.append_chat_turn(
            text, text, text, timestamptz, integer, double precision
        )
        """
    )
    op.execute("NOTIFY pgrst, 'reload schema'")
