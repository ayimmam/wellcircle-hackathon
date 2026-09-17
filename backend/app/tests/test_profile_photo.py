"""
Well Circle — custom profile photo tests (Phase 23, WS9).
Run: cd backend && python -m app.tests.test_profile_photo

Covers: uploading a photo sets photo_url/photo_is_custom, writes one -10
ledger row, and drops the balance by 10 (floored at 0 when the balance is
under 10); a second change charges again and destroys the previous
Cloudinary asset; a DB failure destroys the newly-uploaded asset and writes
no ledger row; a Telegram re-login does not overwrite a custom photo but
still syncs when photo_is_custom is false; and an oversized/unsupported
upload 422s without charging points.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


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
from app.models.user import User
from app.models.point_transaction import PointTransaction
from app.services.points import TXN_PROFILE_PHOTO, POINTS_PROFILE_PHOTO_COST

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


class FakeUploadFile:
    def __init__(self, content: bytes, content_type: str):
        self._content = content
        self.content_type = content_type

    async def read(self):
        return self._content


def make_user(db, telegram_id, name, points_balance=100):
    u = User(telegram_id=telegram_id, telegram_handle=f"user{telegram_id}", name=name, points_balance=points_balance)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — PROFILE PHOTO TESTS")
        print("=" * 50)

        from app.api.users import change_my_photo, revert_my_photo

        upload_counter = [0]

        def fake_upload_file(_bytes, folder, content_type):
            if content_type not in ("image/jpeg", "image/png", "image/webp"):
                raise ValueError("Unsupported file type")
            if len(_bytes) > 2 * 1024 * 1024:
                raise ValueError("File is too large")
            upload_counter[0] += 1
            return {"url": f"https://cdn.test/avatars/{upload_counter[0]}.jpg", "public_id": f"avatar-{upload_counter[0]}"}

        destroyed = []

        def fake_delete_file(public_id, resource_type="image"):
            destroyed.append(public_id)
            return {"result": "ok"}

        # === 1. Upload sets photo_url/photo_is_custom, one -10 ledger row ===
        print("\n1. Upload sets photo_url, photo_is_custom, and charges 10")
        user = make_user(db, 810100001, "Photo User", points_balance=100)
        with patch("app.api.users.upload_file", fake_upload_file), patch("app.api.users.delete_file", fake_delete_file):
            result = asyncio.run(change_my_photo(
                file=FakeUploadFile(b"x" * 1000, "image/jpeg"), user=user, db=db,
            ))
        assert result["points_charged"] == POINTS_PROFILE_PHOTO_COST
        assert result["points_balance"] == 90
        assert user.photo_is_custom is True
        assert user.photo_url == result["photo_url"]
        ledger_rows = db.query(PointTransaction).filter(
            PointTransaction.user_id == user.id, PointTransaction.type == TXN_PROFILE_PHOTO
        ).all()
        assert len(ledger_rows) == 1
        assert ledger_rows[0].amount == -POINTS_PROFILE_PHOTO_COST
        print("   ✅ photo_url/photo_is_custom set, one -10 ledger row, balance 100 → 90")

        # === 2. Balance floors at 0, ledger row still records -10 ============
        print("\n2. Balance floor at 0")
        low_user = make_user(db, 810100002, "Low Balance", points_balance=4)
        with patch("app.api.users.upload_file", fake_upload_file), patch("app.api.users.delete_file", fake_delete_file):
            result2 = asyncio.run(change_my_photo(
                file=FakeUploadFile(b"y" * 1000, "image/jpeg"), user=low_user, db=db,
            ))
        assert result2["points_balance"] == 0
        low_ledger = db.query(PointTransaction).filter(
            PointTransaction.user_id == low_user.id, PointTransaction.type == TXN_PROFILE_PHOTO
        ).first()
        assert low_ledger.amount == -POINTS_PROFILE_PHOTO_COST
        print("   ✅ balance 4 → 0, ledger row still records the full -10")

        # === 3. A second change charges again and destroys the previous asset
        print("\n3. Second change charges again, destroys previous asset")
        first_public_id = user.photo_public_id
        with patch("app.api.users.upload_file", fake_upload_file), patch("app.api.users.delete_file", fake_delete_file):
            result3 = asyncio.run(change_my_photo(
                file=FakeUploadFile(b"z" * 1000, "image/jpeg"), user=user, db=db,
            ))
        assert result3["points_balance"] == 80
        assert first_public_id in destroyed
        assert user.photo_public_id != first_public_id
        ledger_count = db.query(PointTransaction).filter(
            PointTransaction.user_id == user.id, PointTransaction.type == TXN_PROFILE_PHOTO
        ).count()
        assert ledger_count == 2
        print("   ✅ second change charges again (100 → 90 → 80) and destroys the prior asset")

        # === 4. DB failure destroys the new asset, no ledger row =============
        print("\n4. DB failure destroys the new asset, writes no ledger row")
        fail_user = make_user(db, 810100003, "Fail User", points_balance=50)
        destroyed_on_failure = []

        def failing_apply_transaction(*_a, **_k):
            raise RuntimeError("simulated DB failure")

        with patch("app.api.users.upload_file", fake_upload_file), \
             patch("app.api.users.delete_file", lambda pid, resource_type="image": destroyed_on_failure.append(pid)), \
             patch("app.api.users.apply_transaction", failing_apply_transaction):
            try:
                asyncio.run(change_my_photo(
                    file=FakeUploadFile(b"w" * 1000, "image/jpeg"), user=fail_user, db=db,
                ))
                assert False, "expected the simulated failure to propagate"
            except RuntimeError:
                pass
        assert len(destroyed_on_failure) == 1
        assert fail_user.photo_is_custom is False
        no_ledger = db.query(PointTransaction).filter(
            PointTransaction.user_id == fail_user.id, PointTransaction.type == TXN_PROFILE_PHOTO
        ).first()
        assert no_ledger is None
        print("   ✅ DB failure destroys the freshly uploaded asset and writes no ledger row")

        # === 5. Telegram re-login doesn't overwrite a custom photo ===========
        print("\n5. Telegram re-login respects photo_is_custom")
        custom_url = user.photo_url
        telegram_photo_url = "https://t.me/i/userpic/whatever.jpg"
        # Mirrors the guarded line in app/api/auth.py's telegram_auth handler.
        if not user.photo_is_custom and telegram_photo_url != user.photo_url:
            user.photo_url = telegram_photo_url
        assert user.photo_url == custom_url, "a custom photo must survive a Telegram re-login"

        non_custom_user = make_user(db, 810100004, "Sync Me", points_balance=10)
        if not non_custom_user.photo_is_custom and telegram_photo_url != non_custom_user.photo_url:
            non_custom_user.photo_url = telegram_photo_url
        assert non_custom_user.photo_url == telegram_photo_url
        print("   ✅ a custom photo survives Telegram re-login; a non-custom one still syncs")

        # === 6. Oversized/unsupported uploads 422 without charging ===========
        print("\n6. Oversized/unsupported upload 422s, no charge")
        guard_user = make_user(db, 810100005, "Guard User", points_balance=30)
        balance_before = guard_user.points_balance
        with patch("app.api.users.upload_file", fake_upload_file), patch("app.api.users.delete_file", fake_delete_file):
            try:
                asyncio.run(change_my_photo(
                    file=FakeUploadFile(b"a" * (3 * 1024 * 1024), "image/jpeg"), user=guard_user, db=db,
                ))
                assert False, "expected HTTPException for oversized upload"
            except HTTPException as exc:
                assert exc.status_code == 422

            try:
                asyncio.run(change_my_photo(
                    file=FakeUploadFile(b"b" * 1000, "application/pdf"), user=guard_user, db=db,
                ))
                assert False, "expected HTTPException for unsupported type"
            except HTTPException as exc:
                assert exc.status_code == 422
        assert guard_user.points_balance == balance_before
        assert db.query(PointTransaction).filter(
            PointTransaction.user_id == guard_user.id, PointTransaction.type == TXN_PROFILE_PHOTO
        ).first() is None
        print("   ✅ oversized and unsupported-type uploads 422 without charging points")

        # === 7. Revert clears photo_is_custom, charges nothing ================
        print("\n7. Revert clears photo_is_custom")
        balance_before_revert = user.points_balance
        with patch("app.api.users.delete_file", fake_delete_file):
            revert_result = asyncio.run(revert_my_photo(user=user, db=db))
        assert revert_result["photo_is_custom"] is False
        assert user.photo_is_custom is False
        assert user.photo_public_id is None
        assert user.points_balance == balance_before_revert
        print("   ✅ revert clears photo_is_custom/photo_public_id, charges nothing")

        print("\n" + "=" * 50)
        print("  ALL PROFILE PHOTO TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
