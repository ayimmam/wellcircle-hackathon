"""Unit and integration tests for AuthIdentity and Web Auth endpoints."""

import os
import unittest
from datetime import datetime, timezone
import uuid

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker

# --- SQLite UUID & JSONB compatibility for testing ---
class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value
    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value is not None and not isinstance(value, uuid.UUID) else value

class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True
    def process_bind_param(self, value, dialect):
        import json
        return json.dumps(value) if value is not None else value
    def process_result_value(self, value, dialect):
        import json
        if value is not None:
            try:
                return json.loads(value)
            except Exception:
                return value
        return value

import sqlalchemy.dialects.postgresql as pg
pg.UUID = SQLiteUUID
pg.JSONB = SQLiteJSONB

from app.database import Base
from app.models.user import User
from app.models.auth_identity import AuthIdentity
from app.crud.auth_identity import (
    create_identity,
    get_identity,
    get_user_by_identity,
    get_user_identities,
    find_user_by_phone,
)
from app.services.otp import start_otp, verify_otp, _normalize_phone


class TestAuthIdentities(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_create_and_find_identities(self):
        # 1. Create a user without telegram_id (WhatsApp-first user)
        user = User(
            id=uuid.uuid4(),
            name="Abebe Bikila",
            phone_number="+251911223344",
            last_activity_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # 2. Add WhatsApp identity
        ident_wa = create_identity(self.db, user.id, "whatsapp", "+251911223344")
        self.assertIsNotNone(ident_wa.id)
        self.assertEqual(ident_wa.provider, "whatsapp")

        # 3. Lookup user by identity
        found_user = get_user_by_identity(self.db, "whatsapp", "+251911223344")
        self.assertIsNotNone(found_user)
        self.assertEqual(found_user.id, user.id)
        self.assertEqual(found_user.name, "Abebe Bikila")

        # 4. Account linking: later links Google identity
        create_identity(self.db, user.id, "google", "google-sub-12345", email="abebe@gmail.com")
        identities = get_user_identities(self.db, user.id)
        self.assertEqual(len(identities), 2)
        providers = [i.provider for i in identities]
        self.assertIn("whatsapp", providers)
        self.assertIn("google", providers)

    def test_phone_normalization_and_lookup(self):
        # Test Ethiopian phone normalization
        self.assertEqual(_normalize_phone("0911234567"), "+251911234567")
        self.assertEqual(_normalize_phone("+251911234567"), "+251911234567")
        self.assertEqual(_normalize_phone("911234567"), "+251911234567")

        user = User(
            id=uuid.uuid4(),
            name="Sara Haile",
            phone_number="+251922334455",
            last_activity_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        self.db.commit()

        found = find_user_by_phone(self.db, "+251922334455")
        self.assertIsNotNone(found)
        self.assertEqual(found.name, "Sara Haile")

    def test_otp_flow(self):
        # Start OTP
        res = start_otp("+251933445566")
        self.assertIsNotNone(res)
        request_id = res["request_id"]
        dev_code = res.get("_dev_code")
        self.assertIsNotNone(dev_code)
        self.assertEqual(len(dev_code), 6)

        # Verify with wrong code fails
        fail = verify_otp(request_id, "000000")
        self.assertIsNone(fail)

        # Verify with right code succeeds
        success_phone = verify_otp(request_id, dev_code)
        self.assertEqual(success_phone, "+251933445566")

        # Replay attempt fails (single use)
        replay = verify_otp(request_id, dev_code)
        self.assertIsNone(replay)


if __name__ == "__main__":
    unittest.main()
