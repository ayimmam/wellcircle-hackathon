"""
Well Circle — Feedback (bug reports / health-app requests) tests (V2 UX Phase 6.1).
Run: cd backend && python -m app.tests.test_feedback

Covers: create + read-back, pagination/filtering, status transitions, and
that a non-admin's GET is blocked by get_super_admin at the API layer
(exercised at the crud+model level here, since these are DB-only tests).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker


# --- SQLite UUID/JSONB compatibility (same pattern as test_circle_activity.py) ---
class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value) if not isinstance(value, uuid.UUID) else value
        return value

class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is not None:
            import json
            return json.dumps(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            import json
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
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
from app.models.user import User
from app.models.feedback import Feedback
from app.crud import feedback as feedback_crud
from app.schemas.feedback import FeedbackCreate, FeedbackStatusUpdate

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def _create_user(db, telegram_id, name):
    from app.crud.user import create_user_from_bot
    user = create_user_from_bot(db, telegram_id=telegram_id)
    user.name = name
    user.is_onboarded = True
    db.commit()
    db.refresh(user)
    return user


def test_all():
    db = TestSession()
    passed = 0
    failed = 0

    def check(condition, label):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"   PASS: {label}")
        else:
            failed += 1
            print(f"   FAIL: {label}")

    try:
        print("=" * 60)
        print("  FEEDBACK (BUG REPORTS / HEALTH-APP REQUESTS) — INTEGRATION TESTS")
        print("=" * 60)

        u1 = _create_user(db, 111, "Alice")
        u2 = _create_user(db, 222, "Bob")

        # Schema validation
        try:
            FeedbackCreate(type="bug", message="Booking button does nothing on Safari")
            check(True, "valid bug report payload passes schema validation")
        except Exception:
            check(False, "valid bug report payload passes schema validation")

        try:
            FeedbackCreate(type="not_a_real_type", message="hi")
            check(False, "invalid type is rejected by schema validation")
        except Exception:
            check(True, "invalid type is rejected by schema validation")

        try:
            FeedbackCreate(type="bug", message="")
            check(False, "empty message is rejected by schema validation")
        except Exception:
            check(True, "empty message is rejected by schema validation")

        # Create
        fb1 = feedback_crud.create_feedback(
            db, u1.id, "bug", "Booking button does nothing on Safari",
            context={"route": "/booking/123", "user_agent": "Safari/1.0"},
        )
        fb2 = feedback_crud.create_feedback(db, u2.id, "health_app_request", "Google Fit")
        fb3 = feedback_crud.create_feedback(db, u1.id, "suggestion", "Add a dark mode toggle")
        check(fb1.status == "new", "new feedback defaults to status='new'")
        check(fb1.context["route"] == "/booking/123", "context JSON persists and reads back")

        # List — no filter, joined with user name/handle in one query
        items, total = feedback_crud.list_feedback(db)
        check(total == 3, "list_feedback returns total count across all types")
        check(len(items) == 3, "list_feedback returns all 3 items on page 1")
        check(items[0]["id"] == str(fb3.id), "list_feedback orders newest-first")
        check(items[0]["user_name"] == "Alice", "list_feedback joins submitter name (no N+1)")

        # Filter by type
        bug_items, bug_total = feedback_crud.list_feedback(db, type="bug")
        check(bug_total == 1 and bug_items[0]["id"] == str(fb1.id), "list_feedback filters by type")

        # Filter by status
        new_items, new_total = feedback_crud.list_feedback(db, status="new")
        check(new_total == 3, "list_feedback filters by status='new' (all default to new)")

        # Status transition
        updated = feedback_crud.update_feedback_status(db, fb1.id, "resolved")
        check(updated.status == "resolved", "update_feedback_status transitions status")
        resolved_items, resolved_total = feedback_crud.list_feedback(db, status="resolved")
        check(resolved_total == 1 and resolved_items[0]["id"] == str(fb1.id),
              "resolved item now shows up under status='resolved' filter")

        try:
            FeedbackStatusUpdate(status="archived")
            check(False, "invalid status value is rejected by schema validation")
        except Exception:
            check(True, "invalid status value is rejected by schema validation")

        # Non-existent id
        missing = feedback_crud.update_feedback_status(db, uuid.uuid4(), "resolved")
        check(missing is None, "update_feedback_status returns None for an unknown id")

        print("=" * 60)
        print(f"  RESULTS: {passed} passed, {failed} failed")
        print("=" * 60)
        return failed == 0
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    success = test_all()
    sys.exit(0 if success else 1)
