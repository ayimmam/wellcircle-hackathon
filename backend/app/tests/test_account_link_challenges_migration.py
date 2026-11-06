"""Live PostgreSQL verification for Alembic revision 034 (account linking).

Requires a DISPOSABLE database — never a shared or production target:

    DISPOSABLE_DB=postgresql://postgres@127.0.0.1:55433/phasea_mig \
        pytest app/tests/test_account_link_challenges_migration.py -q

The tests execute the revision's ``upgrade()``/``downgrade()`` directly through
Alembic's ``Operations`` context, against a database whose ``users`` table is in
the post-033 state.

Covered: fresh creation, canonical shape and indexes, idempotent re-apply,
clear failure on incompatible schema drift, cascade cleanup when a user is
deleted, and the safe downgrade (challenges are ephemeral).
"""

import importlib.util
import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

DISPOSABLE_DB = os.environ.get("DISPOSABLE_DB")

pytestmark = pytest.mark.skipif(
    not DISPOSABLE_DB,
    reason="set DISPOSABLE_DB to a disposable PostgreSQL URL to run migration tests",
)

REVISION_FILE = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "034_account_link_challenges.py"
)

_USERS_DDL = """
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

_USER_A = uuid.UUID("aaaaaaaa-1111-1111-1111-111111111111")
_USER_B = uuid.UUID("bbbbbbbb-2222-2222-2222-222222222222")

_EXPECTED_COLUMNS = {
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
}


def _load_revision():
    spec = importlib.util.spec_from_file_location("rev_034_under_test", REVISION_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(conn, function_name):
    """Execute a revision function with Alembic's ``op`` proxy installed."""
    operations = Operations(MigrationContext.configure(conn))
    context = getattr(Operations, "context", None)
    if context is not None:  # alembic >= 1.17
        with context(operations.migration_context):
            getattr(_load_revision(), function_name)()
    else:  # alembic 1.12 fallback
        with operations:
            getattr(_load_revision(), function_name)()


@pytest.fixture
def pg():
    engine = sa.create_engine(DISPOSABLE_DB, future=True)
    with engine.begin() as conn:
        conn.execute(sa.text("DROP TABLE IF EXISTS account_link_challenges CASCADE"))
        conn.execute(sa.text("DROP TABLE IF EXISTS auth_identities CASCADE"))
        conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
        conn.execute(sa.text(_USERS_DDL))
        conn.execute(
            sa.text("INSERT INTO users (id, telegram_id) VALUES (:id, 111)"),
            {"id": _USER_A},
        )
        conn.execute(
            sa.text("INSERT INTO users (id, telegram_id) VALUES (:id, 222)"),
            {"id": _USER_B},
        )
    yield engine
    engine.dispose()


def test_fresh_upgrade_creates_canonical_challenge_table(pg):
    with pg.begin() as conn:
        _run(conn, "upgrade")

        inspector = sa.inspect(conn)
        columns = {
            col["name"]: col
            for col in inspector.get_columns("account_link_challenges")
        }
        assert set(columns) == _EXPECTED_COLUMNS
        assert all(
            not columns[name]["nullable"]
            for name in ("id", "user_id", "provider", "status", "attempts", "created_at", "expires_at")
        )
        assert inspector.get_pk_constraint("account_link_challenges")[
            "constrained_columns"
        ] == ["id"]

        fk = inspector.get_foreign_keys("account_link_challenges")[0]
        assert fk["referred_table"] == "users"
        assert fk["constrained_columns"] == ["user_id"]
        assert (fk.get("ondelete") or (fk.get("options") or {}).get("ondelete")) == "CASCADE"

        indexes = {
            ix["name"] for ix in inspector.get_indexes("account_link_challenges")
        }
        assert {
            "ix_account_link_challenges_user_id",
            "ix_account_link_challenges_expires_at",
            "ix_link_user_created",
        } <= indexes

        # Canonical defaults are present for direct SQL inserts.
        conn.execute(
            sa.text(
                "INSERT INTO account_link_challenges "
                "(id, user_id, provider, created_at, expires_at) "
                "VALUES ('challenge-1', :user_id, 'google', 1, 2)"
            ),
            {"user_id": _USER_A},
        )
        row = conn.execute(
            sa.text(
                "SELECT status, attempts FROM account_link_challenges WHERE id = 'challenge-1'"
            )
        ).one()
        assert (row.status, row.attempts) == ("pending", 0)

        # Deleting a user removes their in-flight challenges (ON DELETE CASCADE).
        conn.execute(sa.text("DELETE FROM users WHERE id = :id"), {"id": _USER_A})
        remaining = conn.execute(
            sa.text("SELECT COUNT(*) FROM account_link_challenges")
        ).scalar()
        assert remaining == 0


def test_upgrade_is_idempotent_and_downgrade_is_safe(pg):
    with pg.begin() as conn:
        _run(conn, "upgrade")
        _run(conn, "upgrade")  # no-op on an already-canonical table

        # A challenge row does not block the downgrade: challenges are ephemeral.
        conn.execute(
            sa.text(
                "INSERT INTO account_link_challenges "
                "(id, user_id, provider, created_at, expires_at) "
                "VALUES ('challenge-2', :user_id, 'telegram', 1, 2)"
            ),
            {"user_id": _USER_B},
        )
        _run(conn, "downgrade")
        assert not sa.inspect(conn).has_table("account_link_challenges")

        # Re-running downgrade on an already-reversed database is harmless.
        _run(conn, "downgrade")

        _run(conn, "upgrade")  # and re-applying recreates it
        assert sa.inspect(conn).has_table("account_link_challenges")


def test_incompatible_schema_drift_fails_clearly(pg):
    with pg.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE account_link_challenges ("
                "id VARCHAR(64) PRIMARY KEY, "
                "user_id UUID NOT NULL, "
                "provider VARCHAR(16) NOT NULL)"
            )
        )

        with pytest.raises(RuntimeError) as failure:
            _run(conn, "upgrade")

        message = str(failure.value)
        assert "account_link_challenges" in message
        assert "missing column 'status'" in message
        assert "missing FK user_id -> users(id)" in message

        # The incomplete table is left untouched for an operator to inspect.
        assert sa.inspect(conn).has_table("account_link_challenges")
