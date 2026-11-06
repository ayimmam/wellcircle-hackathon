"""Ephemeral rate-limit counters for authenticated dry-run endpoints.

This table stores only a random id, user id, action name and timestamp. It
contains no provider proof, token, challenge secret, chat content or account
data. Rows are removed as their short window expires.
"""

import sqlalchemy as sa
from alembic import op

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None

_TABLE_SQL = """
CREATE TABLE api_rate_limits (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL
)
"""

_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS ix_api_rate_limits_user_action_created "
    "ON api_rate_limits(user_id, action, created_at)"
)

_EXPECTED_COLUMNS = {
    "id": "VARCHAR",
    "user_id": "UUID",
    "action": "VARCHAR",
    "created_at": "BIGINT",
}


def _drift_problems(inspector: sa.engine.reflection.Inspector) -> list[str]:
    problems: list[str] = []
    columns = {col["name"]: col for col in inspector.get_columns("api_rate_limits")}
    for name, expected_type in _EXPECTED_COLUMNS.items():
        if name not in columns:
            problems.append(f"missing column '{name}'")
            continue
        actual = type(columns[name]["type"]).__name__.upper()
        if actual != expected_type:
            problems.append(f"column '{name}' is {actual!r}, expected {expected_type}")
    for name in ("id", "user_id", "action", "created_at"):
        if name in columns and columns[name]["nullable"]:
            problems.append(f"column '{name}' must be NOT NULL")

    pk = set(
        inspector.get_pk_constraint("api_rate_limits").get("constrained_columns", [])
    )
    if pk != {"id"}:
        problems.append(f"primary key must be exactly (id), got {sorted(pk)}")

    fks = inspector.get_foreign_keys("api_rate_limits")
    user_fks = [
        fk
        for fk in fks
        if fk.get("referred_table") == "users"
        and fk.get("constrained_columns") == ["user_id"]
        and fk.get("referred_columns") == ["id"]
    ]

    def _ondelete(fk: dict) -> str | None:
        return fk.get("ondelete") or (fk.get("options") or {}).get("ondelete")

    if not user_fks:
        problems.append("missing FK user_id -> users(id)")
    elif _ondelete(user_fks[0]) != "CASCADE":
        problems.append(
            f"FK user_id -> users(id) must be ON DELETE CASCADE, got {_ondelete(user_fks[0])!r}"
        )

    indexes = {ix["name"] for ix in inspector.get_indexes("api_rate_limits")}
    if "ix_api_rate_limits_user_action_created" not in indexes:
        problems.append("missing index 'ix_api_rate_limits_user_action_created'")
    return problems


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("api_rate_limits"):
        problems = _drift_problems(inspector)
        if problems:
            raise RuntimeError(
                "api_rate_limits already exists but deviates from the canonical "
                "schema; refusing to continue silently. Problems: "
                + "; ".join(problems)
            )
    else:
        op.execute(_TABLE_SQL)
    op.execute(_INDEX_SQL)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("api_rate_limits"):
        return
    op.execute("DROP INDEX IF EXISTS ix_api_rate_limits_user_action_created")
    op.execute("DROP TABLE api_rate_limits")
