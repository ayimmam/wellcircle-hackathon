"""Persistent Circler profile and consented preferences.

Revision ID: 029
Revises: 028

The SQL file is the canonical definition. This revision executes it directly so
the Alembic and Supabase SQL-editor paths cannot drift.
"""

from pathlib import Path

from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None

_MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
_MIGRATION_SQL = _MIGRATIONS / "029_chat_profile.sql"


def upgrade():
    op.execute(_MIGRATION_SQL.read_text(encoding="utf-8"))


def downgrade():
    op.execute("DROP TABLE IF EXISTS public.chat_profile")
    op.execute("NOTIFY pgrst, 'reload schema'")
