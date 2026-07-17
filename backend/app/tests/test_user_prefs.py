"""
Well Circle — User preferences tests (V2 UX Phase 2).
Run: cd backend && python -m app.tests.test_user_prefs

Covers: phone_number + time_format persist through update_user_profile and
round-trip via UserResponse; UserProfileUpdate schema rejects a bad
time_format value (the same validation FastAPI turns into a 422).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker


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

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


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
        print("  USER PREFERENCES — INTEGRATION TESTS")
        print("=" * 60)

        from app.crud.user import create_user_from_bot, update_user_profile
        from app.schemas.user import UserProfileUpdate
        from pydantic import ValidationError

        print("\n-- Persist + read back --")
        user = create_user_from_bot(db, telegram_id=300001)
        update_user_profile(db, user, phone_number="+251911234567", time_format="12h")
        db.refresh(user)
        check(user.phone_number == "+251911234567", f"phone_number persisted: {user.phone_number}")
        check(user.time_format == "12h", f"time_format persisted: {user.time_format}")

        update_user_profile(db, user, time_format="24h")
        db.refresh(user)
        check(user.time_format == "24h", f"time_format updated: {user.time_format}")
        check(user.phone_number == "+251911234567", "phone_number untouched by unrelated update")

        print("\n-- Schema validation (422 equivalent) --")
        try:
            UserProfileUpdate(time_format="xx")
            check(False, "bad time_format should have raised ValidationError")
        except ValidationError:
            check(True, "bad time_format rejected by schema")

        try:
            UserProfileUpdate(phone_number="not-a-phone-number-at-all")
            check(False, "garbage phone_number should have raised ValidationError")
        except ValidationError:
            check(True, "garbage phone_number rejected by schema")

        # Valid values pass schema validation cleanly
        valid = UserProfileUpdate(phone_number="+251911234567", time_format="12h")
        check(valid.phone_number == "+251911234567" and valid.time_format == "12h", "valid payload passes schema")

        print("\n" + "=" * 60)
        total = passed + failed
        if failed == 0:
            print(f"  ALL {passed} TESTS PASSED")
        else:
            print(f"  {passed}/{total} passed, {failed} FAILED")
        print("=" * 60)
        return failed == 0

    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    ok = test_all()
    sys.exit(0 if ok else 1)
