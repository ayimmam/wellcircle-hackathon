"""Live PostgreSQL verification for Alembic revision 033 (auth_identities).

Requires a DISPOSABLE database — never a shared or production target:

    DISPOSABLE_DB=postgresql://postgres@127.0.0.1:55433/phasea_mig \
        pytest app/tests/test_auth_identities_migration.py -q

The tests execute the revision's ``upgrade()``/``downgrade()`` directly through
Alembic's ``Operations`` context, against a database whose ``users`` table is in
the post-032 state (the migration only reads users.id/telegram_id/created_at).

Covered: fresh-database apply, backfill with preserved user UUIDs,
idempotent re-apply, acceptance of the out-of-band pre-existing table, clear
failure on incompatible schema drift, and the guarded downgrade.
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
    Path(__file__).resolve().parents[2] / "alembic" / "versions" / "033_auth_identities.py"
)

# Prerequisite state after revision 032 (only the columns revision 033 touches).
_USERS_DDL = """
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

# The out-of-band script's table shape: anonymous UNIQUE constraint name.
_OUT_OF_BAND_DDL = """
CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, subject)
)
"""

_USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
_USER_B = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _load_revision():
    spec = importlib.util.spec_from_file_location("rev_033_under_test", REVISION_FILE)
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
        conn.execute(sa.text("DROP TABLE IF EXISTS auth_identities CASCADE"))
        conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
        conn.execute(sa.text(_USERS_DDL))
    yield engine
    engine.dispose()


def _seed_telegram_user(conn, user_id, telegram_id, created_at="2024-05-01T10:00:00Z"):
    conn.execute(
        sa.text(
            "INSERT INTO users (id, telegram_id, created_at) "
            "VALUES (:id, :telegram_id, :created_at)"
        ),
        {"id": user_id, "telegram_id": telegram_id, "created_at": created_at},
    )


def test_fresh_database_backfills_and_preserves_user_ids(pg):
    with pg.begin() as conn:
        _seed_telegram_user(conn, _USER_A, 555000111)
        _seed_telegram_user(conn, _USER_B, 555000222)

        _run(conn, "upgrade")

        rows = conn.execute(
            sa.text(
                "SELECT user_id, provider, subject, verified_at, created_at "
                "FROM auth_identities ORDER BY subject"
            )
        ).fetchall()
        assert [(r.provider, r.subject) for r in rows] == [
            ("telegram", "555000111"),
            ("telegram", "555000222"),
        ]
        assert {r.user_id for r in rows} == {_USER_A, _USER_B}

        # Backfill timestamps come from the existing user row.
        user_created = conn.execute(
            sa.text("SELECT created_at FROM users WHERE id = :id"), {"id": _USER_A}
        ).scalar()
        assert next(r for r in rows if r.user_id == _USER_A).verified_at == user_created

        inspector = sa.inspect(conn)
        columns = {c["name"]: c for c in inspector.get_columns("auth_identities")}
        assert set(columns) == {
            "id", "user_id", "provider", "subject", "email", "verified_at", "created_at",
        }
        assert inspector.get_pk_constraint("auth_identities")["constrained_columns"] == ["id"]
        assert inspector.get_unique_constraints("auth_identities")[0]["column_names"] == [
            "provider", "subject",
        ]
        fk = inspector.get_foreign_keys("auth_identities")[0]
        assert fk["referred_table"] == "users"
        assert (fk.get("ondelete") or (fk.get("options") or {}).get("ondelete")) == "CASCADE"
        assert "ix_auth_identities_user_id" in {
            ix["name"] for ix in inspector.get_indexes("auth_identities")
        }

        # The revision makes users.telegram_id nullable for Google-only accounts.
        conn.execute(
            sa.text("INSERT INTO users (id, telegram_id) VALUES (:id, NULL)"),
            {"id": uuid.uuid4()},
        )

        # A duplicate (provider, subject) pair is rejected by the constraint.
        savepoint = conn.begin_nested()
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                sa.text(
                    "INSERT INTO auth_identities (user_id, provider, subject) "
                    "VALUES (:user_id, 'telegram', '555000111')"
                ),
                {"user_id": _USER_B},
            )
        savepoint.rollback()


def test_upgrade_is_idempotent_when_table_already_exists(pg):
    with pg.begin() as conn:
        _seed_telegram_user(conn, _USER_A, 555000111)
        _seed_telegram_user(conn, _USER_B, 555000222)

        # Reproduce the out-of-band script's table with one identity already
        # recorded; user B is still missing theirs.
        conn.execute(sa.text(_OUT_OF_BAND_DDL))
        conn.execute(
            sa.text("CREATE INDEX ix_auth_identities_user_id ON auth_identities(user_id)")
        )
        conn.execute(
            sa.text(
                "INSERT INTO auth_identities (user_id, provider, subject) "
                "VALUES (:user_id, 'telegram', '555000111')"
            ),
            {"user_id": _USER_A},
        )

        _run(conn, "upgrade")  # must accept the compatible pre-existing table
        _run(conn, "upgrade")  # and be a no-op on the second run

        rows = conn.execute(
            sa.text("SELECT user_id, provider, subject FROM auth_identities ORDER BY subject")
        ).fetchall()
        assert [(r.provider, r.subject, r.user_id) for r in rows] == [
            ("telegram", "555000111", _USER_A),
            ("telegram", "555000222", _USER_B),
        ]


def test_incompatible_schema_drift_fails_clearly(pg):
    with pg.begin() as conn:
        _seed_telegram_user(conn, _USER_A, 555000111)
        conn.execute(
            sa.text(
                "CREATE TABLE auth_identities ("
                "id UUID PRIMARY KEY, "
                "user_id UUID NOT NULL, "
                "provider VARCHAR(20) NOT NULL, "
                "subject VARCHAR(255) NOT NULL, "
                "verified_at TIMESTAMPTZ NOT NULL, "
                "created_at TIMESTAMPTZ NOT NULL)"
            )
        )

        with pytest.raises(RuntimeError) as error:
            _run(conn, "upgrade")

        message = str(error.value)
        assert "auth_identities already exists but deviates" in message
        assert "missing column 'email'" in message
        assert "missing FK user_id -> users(id)" in message
        assert "missing unique constraint over (provider, subject)" in message


def test_downgrade_refuses_to_drop_non_telegram_identities(pg):
    with pg.begin() as conn:
        _seed_telegram_user(conn, _USER_A, 555000111)
        _run(conn, "upgrade")
        conn.execute(
            sa.text(
                "INSERT INTO auth_identities (user_id, provider, subject, email) "
                "VALUES (:user_id, 'google', 'google-sub-1', 'member@example.com')"
            ),
            {"user_id": _USER_A},
        )

        with pytest.raises(RuntimeError) as error:
            _run(conn, "downgrade")
        assert "cannot reverse 033" in str(error.value)
        assert "google" in str(error.value)
        assert sa.inspect(conn).has_table("auth_identities")

        conn.execute(sa.text("DELETE FROM auth_identities WHERE provider = 'google'"))
        _run(conn, "downgrade")

        inspector = sa.inspect(conn)
        assert not inspector.has_table("auth_identities")
        telegram_column = {
            c["name"]: c for c in inspector.get_columns("users")
        }["telegram_id"]
        assert telegram_column["nullable"] is False

        # Reversible: applying again restores the canonical table.
        _run(conn, "upgrade")
        assert sa.inspect(conn).has_table("auth_identities")


def test_downgrade_keeps_telegram_nullable_when_identity_less_users_exist(pg):
    with pg.begin() as conn:
        _seed_telegram_user(conn, _USER_A, 555000111)
        _run(conn, "upgrade")
        conn.execute(
            sa.text("INSERT INTO users (id, telegram_id) VALUES (:id, NULL)"),
            {"id": uuid.uuid4()},
        )

        _run(conn, "downgrade")

        inspector = sa.inspect(conn)
        assert not inspector.has_table("auth_identities")
        telegram_column = {
            c["name"]: c for c in inspector.get_columns("users")
        }["telegram_id"]
        assert telegram_column["nullable"] is True
