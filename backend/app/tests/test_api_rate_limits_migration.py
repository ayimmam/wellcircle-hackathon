"""Live PostgreSQL verification for Alembic revision 035 (rate-limit counters).

Requires a disposable database; never point DISPOSABLE_DB at a shared target.
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

REVISION_FILE = Path(__file__).resolve().parents[2] / "alembic" / "versions" / "035_api_rate_limits.py"

_USERS_DDL = """
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def _load_revision():
    spec = importlib.util.spec_from_file_location("rev_035_under_test", REVISION_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(conn, function_name):
    operations = Operations(MigrationContext.configure(conn))
    context = getattr(Operations, "context", None)
    if context is not None:
        with context(operations.migration_context):
            getattr(_load_revision(), function_name)()
    else:
        with operations:
            getattr(_load_revision(), function_name)()


@pytest.fixture
def pg():
    engine = sa.create_engine(DISPOSABLE_DB, future=True)
    with engine.begin() as conn:
        conn.execute(sa.text("DROP TABLE IF EXISTS api_rate_limits CASCADE"))
        conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
        conn.execute(sa.text(_USERS_DDL))
        conn.execute(
            sa.text("INSERT INTO users (id) VALUES (:id)"),
            {"id": uuid.UUID("aaaaaaaa-1111-1111-1111-111111111111")},
        )
    yield engine
    engine.dispose()


def test_fresh_upgrade_and_downgrade_are_safe(pg):
    with pg.begin() as conn:
        _run(conn, "upgrade")
        inspector = sa.inspect(conn)
        columns = {c["name"]: c for c in inspector.get_columns("api_rate_limits")}
        assert set(columns) == {"id", "user_id", "action", "created_at"}
        fk = inspector.get_foreign_keys("api_rate_limits")[0]
        assert fk["referred_table"] == "users"
        assert (fk.get("ondelete") or (fk.get("options") or {}).get("ondelete")) == "CASCADE"
        assert "ix_api_rate_limits_user_action_created" in {
            ix["name"] for ix in inspector.get_indexes("api_rate_limits")
        }

        _run(conn, "upgrade")  # idempotent
        _run(conn, "downgrade")
        assert not sa.inspect(conn).has_table("api_rate_limits")
        _run(conn, "downgrade")  # harmless
        _run(conn, "upgrade")
        assert sa.inspect(conn).has_table("api_rate_limits")


def test_schema_drift_is_rejected(pg):
    with pg.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE api_rate_limits ("
                "id VARCHAR(64) PRIMARY KEY, user_id UUID NOT NULL, "
                "action VARCHAR(32) NOT NULL)"
            )
        )
        with pytest.raises(RuntimeError) as error:
            _run(conn, "upgrade")
        assert "api_rate_limits already exists but deviates" in str(error.value)
        assert "missing column 'created_at'" in str(error.value)
