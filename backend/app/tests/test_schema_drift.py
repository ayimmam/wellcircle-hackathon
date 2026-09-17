"""
Well Circle — schema drift report tests (Phase 23, WS0).
Run: cd backend && python -m app.tests.test_schema_drift

Covers: schema_drift() reports a missing table and a missing column against a
real (SQLite-approximated) engine, reports nothing when the schema matches,
and ensure_db_schema() stays a no-op on SQLite (never reaches the drift
check, never raises).
"""
import sys
import uuid
from sqlalchemy import create_engine, String, Text, TypeDecorator, event as sa_event

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value
    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value) if not isinstance(value, uuid.UUID) else value
        return value


class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is not None:
            import json as _json
            return _json.dumps(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            import json as _json
            try:
                return _json.loads(value)
            except (_json.JSONDecodeError, TypeError):
                return value
        return value


import sqlalchemy.dialects.postgresql as pg

class PatchedUUID(SQLiteUUID):
    def __init__(self, *args, **kwargs):
        super().__init__()

class PatchedJSONB(SQLiteJSONB):
    def __init__(self, *args, **kwargs):
        super().__init__()

pg.UUID = PatchedUUID
pg.JSONB = PatchedJSONB

from app.database import Base
import app.models  # noqa: F401 — registers every table on Base.metadata
# CircleStory isn't in app/models/__init__.py — it only gets registered on
# Base.metadata today because app.api.circles imports app.crud.circle_story,
# which imports it, and app.main imports app.api.circles at module level
# before ensure_db_schema() ever runs. Import it explicitly here so this
# test's Base.metadata matches what production actually has by boot time.
import app.models.circle_story  # noqa: F401
from app.database_schema import ensure_db_schema, schema_drift


def _fresh_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    return engine


def test_all():
    db = None
    try:
        print("=" * 50)
        print("  WELL CIRCLE — SCHEMA DRIFT TESTS")
        print("=" * 50)

        # 1. Fully matching schema -> empty report
        engine = _fresh_engine()
        report = schema_drift(engine)
        assert report == {}, f"expected no drift, got {report}"
        print("   ✅ matching schema reports no drift")

        # 2. A missing table is reported
        engine = _fresh_engine()
        with engine.begin() as conn:
            conn.exec_driver_sql("DROP TABLE circle_stories")
        report = schema_drift(engine)
        assert "circle_stories" in report.get("missing_tables", []), report
        print("   ✅ a dropped table is reported as missing")

        # 3. A missing column is reported (and the table itself isn't
        #    flagged missing, since it still exists)
        engine = _fresh_engine()
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE users DROP COLUMN bio")
        report = schema_drift(engine)
        assert "bio" in report.get("missing_columns", {}).get("users", []), report
        assert "users" not in report.get("missing_tables", []), report
        print("   ✅ a dropped column is reported as missing, table not flagged")

        # 4. Both at once
        engine = _fresh_engine()
        with engine.begin() as conn:
            conn.exec_driver_sql("DROP TABLE circle_story_views")
            conn.exec_driver_sql("ALTER TABLE circles DROP COLUMN banner_url")
        report = schema_drift(engine)
        assert "circle_story_views" in report["missing_tables"]
        assert "banner_url" in report["missing_columns"]["circles"]
        print("   ✅ multiple gaps reported together")

        # 5. ensure_db_schema is still a no-op on SQLite — never raises,
        #    never reaches the drift check (it would try Postgres-only SQL
        #    like "ADD COLUMN IF NOT EXISTS" against tables that may not
        #    match, which SQLite's ALTER dialect doesn't fully support).
        engine = _fresh_engine()
        ensure_db_schema(engine)  # must not raise
        print("   ✅ ensure_db_schema no-ops cleanly on SQLite")

        print("=" * 50)
        print("  ALL SCHEMA DRIFT TESTS PASSED")
        print("=" * 50)
    finally:
        if db is not None:
            db.close()


if __name__ == "__main__":
    test_all()
