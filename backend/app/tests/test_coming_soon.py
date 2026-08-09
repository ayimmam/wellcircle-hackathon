"""
Well Circle — Provider launch-state (coming-soon gating) tests.
Run: cd backend && python -m app.tests.test_coming_soon

Covers: is_coming_soon defaults true for new providers, booking against a
coming-soon provider is rejected before any row is written, a live provider
can still be booked, get_all_providers/get_provider_detail expose
is_coming_soon, coming-soon providers sort behind live ones, and
set_provider_launch_state flips the flag.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone

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
from app.models.booking import Booking

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def days_from_now(n):
    return datetime.now(timezone.utc) + timedelta(days=n)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — COMING-SOON GATING TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.provider import (
            create_provider, get_all_providers, get_provider_detail,
            set_provider_launch_state, create_self_onboarded_provider,
        )
        from app.crud.provider_invite import create_invite
        from app.api.bookings import create_new_booking
        from app.schemas.booking import BookingCreate
        from fastapi import BackgroundTasks, HTTPException

        # === 1. Self-onboarded providers default to coming-soon; admin-
        # created providers go live immediately (a deliberate, trusted action).
        print("\n1. Default launch state")
        admin_created, _ = create_provider(
            db, name="Admin Added Studio", category="gym",
            description="Added via Add Provider Directly", location_text="Bole",
            price_range="ETB 500-2,000", rating=4.5,
            services=[{"name": "Day Pass", "price": 200, "duration": "1 day"}],
        )
        assert admin_created.is_coming_soon is False
        print("   ✅ create_provider (admin flow) defaults is_coming_soon to False")

        onboarding_user = create_user_from_bot(db, telegram_id=800200099, telegram_handle="self_onboarder")
        invite = create_invite(db, onboarding_user.id, expires_in_days=7)
        self_onboarded = create_self_onboarded_provider(
            db, onboarding_user, invite,
            name="Self-Onboarded Studio", category="spa",
            description="Not launched yet", location_text="Bole",
            price_range="Price on enquiry",
            services=[{"name": "Massage", "price": 1000, "duration": "60 min"}],
        )
        assert self_onboarded.is_coming_soon is True
        print("   ✅ create_self_onboarded_provider leaves the model default (True)")

        coming_soon_provider, _ = create_provider(
            db, name="New Wellness Studio", category="spa",
            description="Not launched yet", location_text="Bole",
            price_range="Price on enquiry", rating=None,
            services=[{"name": "Massage", "price": 1000, "duration": "60 min"}],
            is_coming_soon=True,
        )
        assert coming_soon_provider.is_coming_soon is True
        print("   ✅ is_coming_soon can be explicitly set True")

        live_provider, _ = create_provider(
            db, name="Boston Day Spa (test)", category="spa",
            description="Live pilot partner", location_text="Bole, Addis Ababa",
            price_range="Price on enquiry", rating=4.9,
            services=[{"name": "Facial", "price": None, "duration": None, "booking_method": "phone"}],
            is_coming_soon=False, sheets_export_enabled=True,
        )
        print("   ✅ live provider created with is_coming_soon=False")

        # === 2. Listing and detail expose is_coming_soon =====================
        print("\n2. get_all_providers / get_provider_detail")
        listing = get_all_providers(db)
        by_id = {p["id"]: p for p in listing}
        assert by_id[str(coming_soon_provider.id)]["is_coming_soon"] is True
        assert by_id[str(live_provider.id)]["is_coming_soon"] is False
        # Coming-soon providers stay in the listing (badge + block, not a filter)
        assert str(coming_soon_provider.id) in by_id
        print("   ✅ is_coming_soon present on list items; coming-soon providers stay listed")

        detail = get_provider_detail(db, coming_soon_provider.id)
        assert detail["is_coming_soon"] is True
        assert detail["facilities"] == []
        print("   ✅ detail exposes is_coming_soon and facilities")

        # === 3. Coming-soon sorts behind live providers ======================
        print("\n3. Sort order")
        ids_in_order = [p["id"] for p in listing]
        assert ids_in_order.index(str(live_provider.id)) < ids_in_order.index(str(coming_soon_provider.id))
        print("   ✅ live providers sort ahead of coming-soon providers")

        # === 4. Booking a coming-soon provider is rejected, no row written ==
        print("\n4. Booking block")
        user = create_user_from_bot(db, telegram_id=800200100, telegram_handle="comingsoon_user")
        before_count = db.query(Booking).count()
        try:
            asyncio.run(create_new_booking(
                request=BookingCreate(
                    provider_id=str(coming_soon_provider.id),
                    service_name="Massage",
                    slot_datetime=days_from_now(1),
                    amount_etb=1000,
                    payment_method="pay_on_site",
                    phone_number="0911000000",
                ),
                background_tasks=BackgroundTasks(),
                user=user, db=db,
            ))
            assert False, "booking a coming-soon provider should raise"
        except HTTPException as e:
            assert e.status_code == 400
        after_count = db.query(Booking).count()
        assert after_count == before_count
        print("   ✅ 400 raised, no booking row written")

        # === 5. Booking a live provider still works ==========================
        print("\n5. Live provider booking still works")
        resp = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(live_provider.id),
                service_name="Facial",
                slot_datetime=days_from_now(1),
                amount_etb=1,
                payment_method="pay_on_site",
                phone_number="0911000000",
            ),
            background_tasks=BackgroundTasks(),
            user=user, db=db,
        ))
        assert resp.id is not None
        print("   ✅ live provider booking succeeds")

        # === 6. Admin launch-state toggle =====================================
        print("\n6. set_provider_launch_state")
        updated = set_provider_launch_state(db, coming_soon_provider.id, False)
        assert updated.is_coming_soon is False
        print("   ✅ toggle flips is_coming_soon")

        print("\n" + "=" * 50)
        print("  ALL COMING-SOON GATING TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
