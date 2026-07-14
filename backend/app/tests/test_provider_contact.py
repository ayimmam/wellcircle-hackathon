"""
Well Circle — Direct-contact booking tests (Kuriftu gap analysis, Jul 15).
Run: cd backend && python -m app.tests.test_provider_contact

Covers: ServiceItem.booking_method validation, provider detail/me exposing
contact_phone/contact_email, and update_provider_me being able to set them.
"""
import sys
import uuid

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker

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
from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — PROVIDER CONTACT / BOOKING METHOD TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.provider import create_provider, get_provider_detail, get_provider_me, update_provider_me
        from app.schemas.provider import ServiceItem
        from pydantic import ValidationError

        # === 1. ServiceItem.booking_method validation ======================
        print("\n1. ServiceItem schema")
        online = ServiceItem(name="Yoga Class", price=500, duration="60 min")
        assert online.booking_method is None  # defaults unset (treated as online)
        phone = ServiceItem(name="Aroma Massage", price=5500, duration="90 min", booking_method="phone")
        assert phone.booking_method == "phone"
        print("   ✅ booking_method optional, accepts 'phone'")

        try:
            ServiceItem(name="Bad", price=100, duration="1h", booking_method="carrier_pigeon")
            assert False, "invalid booking_method should be rejected"
        except ValidationError:
            pass
        print("   ✅ invalid booking_method rejected")

        # === 2. Provider detail exposes contact fields ====================
        print("\n2. get_provider_detail contact fields")
        owner = create_user_from_bot(db, telegram_id=700100200, telegram_handle="kuriftu_owner")
        provider, _ = create_provider(
            db, name="Kuriftu Resort & Spa (test)", category="spa",
            description="Test provider", location_text="Bishoftu",
            price_range="ETB 600-5,500", rating=4.9,
            services=[
                {"name": "Aroma Massage", "price": 5500, "duration": "90 min", "booking_method": "phone"},
                {"name": "Steam & Sauna", "price": 2500, "duration": "2 hours", "booking_method": "phone"},
            ],
            contact_email="booking@kurifturesorts.com",
            owner_telegram_id=owner.telegram_id,
        )
        detail = get_provider_detail(db, provider.id, user_id=owner.id)
        assert detail["contact_email"] == "booking@kurifturesorts.com"
        assert detail["contact_phone"] is None  # not fabricated — none was confirmed
        assert detail["services"][0]["booking_method"] == "phone"
        print("   ✅ detail carries contact_email, no fabricated contact_phone")
        print("   ✅ services retain booking_method through the round trip")

        # A provider with no contact info set returns None cleanly (no KeyError)
        plain, _ = create_provider(
            db, name="Plain Online Studio", category="yoga",
            description="Normal online booking", location_text="Bole",
            price_range="ETB 300-800", rating=4.2,
            services=[{"name": "Yoga Class", "price": 500, "duration": "60 min"}],
        )
        plain_detail = get_provider_detail(db, plain.id)
        assert plain_detail["contact_phone"] is None
        assert plain_detail["contact_email"] is None
        assert plain_detail["services"][0].get("booking_method") is None
        print("   ✅ online-only provider has no contact fields, no booking_method")

        # === 3. get_provider_me / update_provider_me =======================
        print("\n3. Provider self-service (get_provider_me / update_provider_me)")
        me = get_provider_me(db, owner)
        assert me["contact_email"] == "booking@kurifturesorts.com"
        assert me["contact_phone"] is None
        print("   ✅ get_provider_me exposes contact fields")

        update_provider_me(db, owner, contact_phone="+251911223344")
        me_after = get_provider_me(db, owner)
        assert me_after["contact_phone"] == "+251911223344"
        assert me_after["contact_email"] == "booking@kurifturesorts.com"  # untouched
        print("   ✅ update_provider_me can set contact_phone without clobbering contact_email")

        print("\n" + "=" * 50)
        print("  ALL PROVIDER CONTACT / BOOKING METHOD TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
