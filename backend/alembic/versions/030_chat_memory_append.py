"""Atomic append RPC for chatbot conversation memory.

Revision ID: 030
Revises: 027 (durable WhatsApp OTP — merged from dev; renumbered from an
earlier feature-branch 027 to keep the Alembic revision IDs unique)

The SQL file is the canonical definition. This revision executes it directly so
the Alembic and Supabase SQL-editor paths cannot drift.
"""

from pathlib import Path

from alembic import op

revision = "030"
down_revision = "027"
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
