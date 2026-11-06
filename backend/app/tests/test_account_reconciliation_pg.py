"""Live PostgreSQL dry-run verification for account reconciliation.

Requires a DISPOSABLE database — never a shared or production target:

    DISPOSABLE_DB=postgresql://postgres@127.0.0.1:55410/phasea_recon \
        pytest app/tests/test_account_reconciliation_pg.py -q

The real chat_memory/chat_profile schema uses jsonb and a composite primary
key, so SQLite coverage alone is not enough. These tests prove the planner
reads that schema safely without mutating it.
"""

import json
import os
import uuid
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

from app.database import Base
import app.models  # noqa: F401
import app.models.post  # noqa: F401
import app.models.story  # noqa: F401
from app.models.auth_identity import AuthIdentity
from app.models.point_transaction import PointTransaction
from app.models.user import User
from app.services.account_reconciliation import build_reconciliation_plan

DISPOSABLE_DB = os.environ.get("DISPOSABLE_DB")

pytestmark = pytest.mark.skipif(
    not DISPOSABLE_DB,
    reason="set DISPOSABLE_DB to a disposable PostgreSQL URL to run this test",
)

CHAT_DDL = (
    """
    CREATE TABLE chat_memory (
        session_id text PRIMARY KEY,
        messages jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        owner_type text NOT NULL CHECK (owner_type IN ('user', 'anonymous', 'legacy')),
        owner_id text NOT NULL
    )
    """,
    """
    CREATE TABLE chat_profile (
        owner_type text NOT NULL,
        owner_id text NOT NULL,
        display_name text,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        preferences_consent_at timestamptz,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_type, owner_id)
    )
    """,
)


@pytest.fixture
def pg():
    engine = sa.create_engine(DISPOSABLE_DB, future=True)
    with engine.begin() as conn:
        conn.execute(sa.text("DROP TABLE IF EXISTS chat_profile"))
        conn.execute(sa.text("DROP TABLE IF EXISTS chat_memory"))
        Base.metadata.drop_all(bind=conn)
        Base.metadata.create_all(bind=conn)
        for statement in CHAT_DDL:
            conn.execute(sa.text(statement))
    yield engine
    engine.dispose()


def _seed(engine):
    Session = sessionmaker(bind=engine)
    db = Session()
    canonical = User(telegram_id=910001, name="Canonical", points_balance=11)
    source = User(telegram_id=910002, name="Source", points_balance=22)
    db.add_all([canonical, source])
    db.commit()
    db.refresh(canonical)
    db.refresh(source)
    db.add_all([
        AuthIdentity(user_id=canonical.id, provider="telegram", subject="910001"),
        AuthIdentity(user_id=source.id, provider="google", subject="google-pg-subject", email="source@example.com"),
        PointTransaction(user_id=source.id, amount=14, type="booking_bonus", note="safe"),
    ])
    db.commit()
    return db, canonical, source


def test_pg_dry_run_reads_json_metadata_without_writing(pg):
    db, canonical, source = _seed(pg)
    db.execute(
        sa.text(
            "INSERT INTO chat_memory (session_id, messages, updated_at, owner_type, owner_id) "
            "VALUES (:sid, CAST(:messages AS jsonb), now(), 'user', :owner)"
        ),
        {"sid": "pg-session-source", "messages": json.dumps([{"role": "user", "content": "hidden chat text"}]), "owner": str(source.id)},
    )
    db.execute(
        sa.text(
            "INSERT INTO chat_profile (owner_type, owner_id, display_name, preferences, preferences_consent_at) "
            "VALUES ('user', :owner, :name, CAST(:prefs AS jsonb), now())"
        ),
        {"owner": str(canonical.id), "name": "Canonical Chat", "prefs": json.dumps({"interests": ["yoga"], "notes": "same"})},
    )
    db.execute(
        sa.text(
            "INSERT INTO chat_profile (owner_type, owner_id, display_name, preferences, preferences_consent_at) "
            "VALUES ('user', :owner, :name, CAST(:prefs AS jsonb), now())"
        ),
        {"owner": str(source.id), "name": "Source Chat", "prefs": json.dumps({"interests": ["gym"], "notes": "same"})},
    )
    db.commit()

    before = {
        "users": db.execute(sa.text("SELECT COUNT(*) FROM users")).scalar(),
        "chat_memory": db.execute(sa.text("SELECT COUNT(*) FROM chat_memory")).scalar(),
        "chat_profile": db.execute(sa.text("SELECT COUNT(*) FROM chat_profile")).scalar(),
        "chat_messages": db.execute(sa.text("SELECT messages::text FROM chat_memory ORDER BY session_id")).all(),
        "profiles": db.execute(sa.text("SELECT preferences::text FROM chat_profile ORDER BY owner_id")).all(),
    }

    plan = build_reconciliation_plan(db, canonical.id, source.id)

    after = {
        "users": db.execute(sa.text("SELECT COUNT(*) FROM users")).scalar(),
        "chat_memory": db.execute(sa.text("SELECT COUNT(*) FROM chat_memory")).scalar(),
        "chat_profile": db.execute(sa.text("SELECT COUNT(*) FROM chat_profile")).scalar(),
        "chat_messages": db.execute(sa.text("SELECT messages::text FROM chat_memory ORDER BY session_id")).all(),
        "profiles": db.execute(sa.text("SELECT preferences::text FROM chat_profile ORDER BY owner_id")).all(),
    }
    assert before == after

    tables = {row["table"]: row for row in plan["tables"]}
    assert tables["chat_memory"]["source_count"] == 1
    assert tables["chat_memory"]["transferable"] == 1
    assert plan["circler"]["chat_profile"]["display_name_conflict"] is True
    assert plan["circler"]["chat_profile"]["conflicting_preference_keys"] == ["interests"]
    # The non-conflicting "notes" key is deliberately not reported as a conflict.
    assert "notes" not in plan["circler"]["chat_profile"]["conflicting_preference_keys"]

    serialized = json.dumps(plan)
    for secret in ("hidden chat text", "source@example.com", "google-pg-subject", "Canonical Chat", "Source Chat"):
        assert secret not in serialized

    db.close()
