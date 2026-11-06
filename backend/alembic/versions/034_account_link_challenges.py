"""account_link_challenges for verified account linking (WEB_APP_PLAN Phase B).

Phase A added ``auth_identities`` (one verified external identity per row,
all pointing at the canonical ``users.id``) but linking required an explicit,
auditable two-phase flow: a dashboard-authenticated account starts a
short-lived challenge, proves control of the target provider with a fresh
server-verified credential, and only then does confirmation attach the
identity.

This revision introduces the durable challenge store:

* random 256-bit single-use challenge ids (never a counter, never a client id);
* bound to one canonical user **and** provider at creation time;
* the verified provider subject is written only after the existing Google /
  Telegram verifier accepts the proof;
* ``expires_at`` bounds the whole flow (five minutes);
* ``status`` makes consumption one-way (``pending`` -> ``verified`` ->
  ``consumed``, or ``expired``/``failed``).

No provider tokens, codes, emails-for-matching or client-supplied subjects are
stored. The table is new, so ``upgrade`` creates it; if a table of the same
name already exists it must match the canonical shape exactly, otherwise the
migration raises with a specific problem list instead of silently continuing.

Revision ID: 034
Revises: 033
Create Date: 2026-11-01
"""
import sqlalchemy as sa
from alembic import op

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None

# Canonical DDL — must stay in lockstep with
# backend/app/models/account_link_challenge.py.
_TABLE_SQL = """
CREATE TABLE account_link_challenges (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL,
    target_subject VARCHAR(255) NULL,
    target_email VARCHAR(255) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    verified_at BIGINT NULL,
    consumed_at BIGINT NULL
)
"""

_INDEXES_SQL = (
    "CREATE INDEX IF NOT EXISTS ix_account_link_challenges_user_id "
    "ON account_link_challenges(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_account_link_challenges_expires_at "
    "ON account_link_challenges(expires_at)",
    "CREATE INDEX IF NOT EXISTS ix_link_user_created "
    "ON account_link_challenges(user_id, created_at)",
)

_EXPECTED_COLUMNS = (
    "id",
    "user_id",
    "provider",
    "target_subject",
    "target_email",
    "status",
    "attempts",
    "created_at",
    "expires_at",
    "verified_at",
    "consumed_at",
)
_REQUIRED_NOT_NULL = ("id", "user_id", "provider", "status", "attempts", "created_at", "expires_at")
_EXPECTED_TYPES = {
    "id": "VARCHAR",
    "user_id": "UUID",
    "provider": "VARCHAR",
    "target_subject": "VARCHAR",
    "target_email": "VARCHAR",
    "status": "VARCHAR",
    "attempts": "INTEGER",
    "created_at": "BIGINT",
    "expires_at": "BIGINT",
    "verified_at": "BIGINT",
    "consumed_at": "BIGINT",
}
_REQUIRED_INDEXES = (
    "ix_account_link_challenges_user_id",
    "ix_account_link_challenges_expires_at",
    "ix_link_user_created",
)


def _drift_problems(inspector: sa.engine.reflection.Inspector) -> list[str]:
    """Ways the existing table deviates from the canonical schema (empty = OK)."""
    problems: list[str] = []

    columns = {
        col["name"]: col for col in inspector.get_columns("account_link_challenges")
    }
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

    pk = set(
        inspector.get_pk_constraint("account_link_challenges").get(
            "constrained_columns", []
        )
    )
    if pk != {"id"}:
        problems.append(f"primary key must be exactly (id), got {sorted(pk)}")

    fks = inspector.get_foreign_keys("account_link_challenges")
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

    indexes = {ix["name"] for ix in inspector.get_indexes("account_link_challenges")}
    for name in _REQUIRED_INDEXES:
        if name not in indexes:
            problems.append(f"missing index '{name}'")

    return problems


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("account_link_challenges"):
        problems = _drift_problems(inspector)
        if problems:
            raise RuntimeError(
                "account_link_challenges already exists but deviates from the "
                "canonical schema; refusing to continue silently. Problems: "
                + "; ".join(problems)
            )
    else:
        op.execute(_TABLE_SQL)

    for statement in _INDEXES_SQL:
        op.execute(statement)


def downgrade() -> None:
    """Drop the challenge table.

    Challenges are ephemeral by construction (five-minute TTL, no provider
    credentials, no durable user data), so reversing this revision only cancels
    in-flight linking attempts. Linked identities live in ``auth_identities``
    and are untouched. No data migration is needed in either direction.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("account_link_challenges"):
        return

    for name in _REQUIRED_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
    op.execute("DROP TABLE account_link_challenges")
