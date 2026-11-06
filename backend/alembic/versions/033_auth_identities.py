"""auth_identities into the Alembic chain (WEB_APP_PLAN Phase 1).

The ``auth_identities`` table (one verified external identity per row —
Telegram, WhatsApp, Google, password — all pointing at the canonical
``users.id``) previously existed only outside the revision chain:

* ``backend/apply_auth_identities_migration.py`` — one-off psycopg2 script;
* ``backend/app/database_schema.py::ensure_db_schema`` — boot-time self-heal
  fragments (only on non-serverless hosts).

This revision makes the same schema part of the reviewable contract. It is
*idempotent* on databases where the out-of-band script already ran (the exact
same DDL), but it is NOT tolerant of drift: if an existing table does not
match the canonical shape, the migration raises with a specific problem list
instead of silently continuing. Backfill preserves every user's existing
UUID — no users are created, matched, or replaced.

Revision ID: 033
Revises: 032
Create Date: 2026-10-31
"""
import sqlalchemy as sa
from alembic import op

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None

# Canonical DDL — byte-for-byte the same statement family as
# backend/apply_auth_identities_migration.py and the
# auth_identities fragments in backend/app/database_schema.py.
_TABLE_SQL = """
CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_identity_provider_subject UNIQUE (provider, subject)
)
"""

_TELEGRAM_NULLABLE_SQL = "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL"

_BACKFILL_SQL = """
INSERT INTO auth_identities (id, user_id, provider, subject, verified_at, created_at)
SELECT
    gen_random_uuid(),
    id,
    'telegram',
    telegram_id::text,
    COALESCE(created_at, NOW()),
    COALESCE(created_at, NOW())
FROM users
WHERE telegram_id IS NOT NULL
ON CONFLICT (provider, subject) DO NOTHING
"""

_EXPECTED_COLUMNS = ("id", "user_id", "provider", "subject", "email", "verified_at", "created_at")
_REQUIRED_NOT_NULL = ("user_id", "provider", "subject", "verified_at", "created_at")
# Reflection class names are driver-version independent; exact lengths are not
# enforced because the out-of-band script and the model agree on them already.
_EXPECTED_TYPES = {
    "id": "UUID",
    "user_id": "UUID",
    "provider": "VARCHAR",
    "subject": "VARCHAR",
    "email": "VARCHAR",
    "verified_at": "TIMESTAMP",
    "created_at": "TIMESTAMP",
}


def _drift_problems(inspector: sa.engine.reflection.Inspector) -> list[str]:
    """Return a human-readable list of ways the existing table deviates from
    the canonical schema, or an empty list when the shape matches exactly."""
    problems: list[str] = []

    columns = {col["name"]: col for col in inspector.get_columns("auth_identities")}
    for name in _EXPECTED_COLUMNS:
        if name not in columns:
            problems.append(f"missing column '{name}'")
            continue
        actual = type(columns[name]["type"]).__name__.upper()
        if actual != _EXPECTED_TYPES[name]:
            problems.append(
                f"column '{name}' is {actual!r}, expected {_EXPECTED_TYPES[name]}"
            )
    for name in _REQUIRED_NOT_NULL:
        if name in columns and columns[name]["nullable"]:
            problems.append(f"column '{name}' must be NOT NULL")

    pk = set(inspector.get_pk_constraint("auth_identities").get("constrained_columns", []))
    if pk != {"id"}:
        problems.append(f"primary key must be exactly (id), got {sorted(pk)}")

    fks = inspector.get_foreign_keys("auth_identities")
    user_fks = [
        fk
        for fk in fks
        if fk.get("referred_table") == "users"
        and fk.get("constrained_columns") == ["user_id"]
        and fk.get("referred_columns") == ["id"]
    ]

    def _ondelete(fk: dict) -> str | None:
        # Declared FKs expose ``ondelete``; reflected PostgreSQL FKs carry it
        # under ``options``.
        return fk.get("ondelete") or (fk.get("options") or {}).get("ondelete")

    if not user_fks:
        problems.append("missing FK user_id -> users(id)")
    elif _ondelete(user_fks[0]) != "CASCADE":
        problems.append(
            f"FK user_id -> users(id) must be ON DELETE CASCADE, got {_ondelete(user_fks[0])!r}"
        )

    # Accept the constraint whatever its name: the out-of-band script created an
    # unnamed UNIQUE (provider, subject), while the model names it
    # uq_auth_identity_provider_subject. Both enforce the same rule.
    uniques = inspector.get_unique_constraints("auth_identities")
    if not any(
        set(u.get("column_names", [])) == {"provider", "subject"} for u in uniques
    ):
        problems.append(
            "missing unique constraint over (provider, subject); got "
            f"{[u.get('column_names') for u in uniques]}"
        )

    indexes = {ix["name"] for ix in inspector.get_indexes("auth_identities")}
    if "ix_auth_identities_user_id" not in indexes:
        problems.append("missing index 'ix_auth_identities_user_id'")

    return problems


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("auth_identities"):
        problems = _drift_problems(inspector)
        if problems:
            raise RuntimeError(
                "auth_identities already exists but deviates from the canonical "
                "schema; refusing to continue silently. Problems: "
                + "; ".join(problems)
            )
    else:
        op.execute(_TABLE_SQL)

    # Same convergence statements as the out-of-band script and ensure_db_schema.
    op.execute(_TELEGRAM_NULLABLE_SQL)
    op.execute("CREATE INDEX IF NOT EXISTS ix_auth_identities_user_id ON auth_identities(user_id)")
    op.execute(_BACKFILL_SQL)


def downgrade() -> None:
    """Reverse safely: only when no non-Telegram identity row would be lost.

    Telegram rows can be reconstructed wholesale: the login flows (Phase A)
    now create missing identity rows on every Telegram login, and the
    telegram_id column still exists. Google/WhatsApp/password rows cannot be
    reconstructed from any other table, so a database carrying them refuses
    the downgrade instead of silently deleting verified credentials.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    non_telegram_providers: set[str] = set()
    if inspector.has_table("auth_identities"):
        rows = bind.execute(
            sa.text(
                "SELECT DISTINCT provider FROM auth_identities "
                "WHERE provider <> 'telegram'"
            )
        )
        non_telegram_providers = {r.provider for r in rows}

    if non_telegram_providers:
        raise RuntimeError(
            "cannot reverse 033: auth_identities holds non-Telegram identity "
            f"rows ({'/'.join(sorted(non_telegram_providers))}) "
            "that have no reconstructable source. Dropping them would delete "
            "verified sign-in methods."
        )

    if not inspector.has_table("auth_identities"):
        return

    op.execute("DROP INDEX IF EXISTS ix_auth_identities_user_id")
    op.execute("DROP TABLE auth_identities")

    # Restore the pre-revision telegram_id constraint only when no user has a
    # NULL telegram_id, so the wipe cannot strand identity-less users.
    null_telegram = bind.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE telegram_id IS NULL")
    ).scalar()
    if int(null_telegram or 0) == 0:
        op.execute("ALTER TABLE users ALTER COLUMN telegram_id SET NOT NULL")
