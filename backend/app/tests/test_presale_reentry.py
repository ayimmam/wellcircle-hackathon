"""
Well Circle — Presale promo + re-entry loop tests (Biniyam sprint, Jul 13-19).
Run: cd backend && python -m app.tests.test_presale_reentry

Covers: promotion audience validation, first-time-visitor eligibility,
server-side booking discounts, and the promo payload the bot's re-entry
nudge reads from GET /api/bot/inactive-users.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Emoji check-marks in output; Windows consoles default to cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker


# --- SQLite UUID/JSONB compatibility (same pattern as test_integration) ---
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

# Monkey-patch PostgreSQL types BEFORE importing models
import sqlalchemy.dialects.postgresql as pg

class PatchedUUID(SQLiteUUID):
    def __init__(self, *args, **kwargs):
        super().__init__()

class PatchedJSONB(SQLiteJSONB):
    def __init__(self, *args, **kwargs):
        super().__init__()

pg.UUID = PatchedUUID
pg.JSONB = PatchedJSONB

# NOW import the app (models use the patched types)
from app.database import Base
from app.models.user import User
from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.booking import Booking
from app.models.provider_promotion import ProviderPromotion
from app.models.provider_event import ProviderEvent
from app.models.event_inventory_log import EventInventoryLog
from app.models.user_notification import UserNotification

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def days_from_now(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — PRESALE + RE-ENTRY TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot, onboard_user
        from app.crud.provider import create_provider
        from app.services.promotion_service import (
            get_active_promotion, get_eligible_promotion,
            user_is_first_time, compute_discount_etb,
            get_reengagement_promos,
        )

        # --- Fixtures -----------------------------------------------------
        guest = create_user_from_bot(db, telegram_id=500100200, telegram_handle="presale_guest")
        onboard_user(db, guest, name="Presale Guest", interest_categories=["spa"],
                     exercise_frequency="sometimes")
        repeat = create_user_from_bot(db, telegram_id=500100201, telegram_handle="repeat_guest")
        onboard_user(db, repeat, name="Repeat Guest", interest_categories=["spa"],
                     exercise_frequency="regular")

        provider, _ = create_provider(
            db, name="Kuriftu Resort & Spa (test)", category="spa",
            description="Presale test provider", location_text="Bishoftu",
            price_range="ETB 1000-5000", rating=4.9,
            services=[{"name": "Spa Day Pass", "price": 2000, "duration": "1 day"}],
        )
        other_provider, _ = create_provider(
            db, name="Other Studio", category="yoga",
            description="Second provider", location_text="Bole",
            price_range="ETB 300-800", rating=4.2,
        )

        # === 1. compute_discount_etb ======================================
        print("\n1. Discount math")
        assert compute_discount_etb(2040, 20) == 408
        assert compute_discount_etb(2040, None) == 0
        assert compute_discount_etb(2040, 0) == 0
        assert compute_discount_etb(0, 20) == 0
        assert compute_discount_etb(100, 100) == 100  # never below zero
        print("   ✅ compute_discount_etb (pct, none, zero, full)")

        # === 2. Promotion creation endpoint ===============================
        print("\n2. Promotion creation (POST /providers/me/promotions)")
        from app.api.providers import create_my_promotion
        from app.schemas.promotion import PromotionCreate
        from fastapi import HTTPException

        provider.owner_user_id = guest.id  # guest doubles as owner for this test
        db.commit()

        resp = asyncio.run(create_my_promotion(
            request=PromotionCreate(
                headline="Presale: 20% off your first visit",
                discount_pct=20,
                valid_until=days_from_now(14),
                audience="first_time",
            ),
            user=guest, db=db,
        ))
        assert resp.audience == "first_time"
        assert resp.discount_pct == 20
        assert resp.is_active is True
        presale_promo_id = uuid.UUID(resp.id)
        print("   ✅ presale promotion created with audience")

        try:
            asyncio.run(create_my_promotion(
                request=PromotionCreate(
                    headline="Broken presale", discount_pct=None,
                    valid_until=days_from_now(7), audience="first_time",
                ),
                user=guest, db=db,
            ))
            assert False, "presale without discount should be rejected"
        except HTTPException as e:
            assert e.status_code == 422
        print("   ✅ presale without discount_pct rejected (422)")

        # audience validated at the schema layer too
        try:
            PromotionCreate(headline="x", discount_pct=5,
                            valid_until=days_from_now(1), audience="vip")
            assert False, "invalid audience should fail validation"
        except Exception:
            pass
        print("   ✅ invalid audience rejected by schema")

        # === 3. Active promo lookup =======================================
        print("\n3. get_active_promotion")
        promo = get_active_promotion(db, provider.id)
        assert promo is not None
        assert promo["id"] == str(presale_promo_id)
        assert promo["audience"] == "first_time"
        assert get_active_promotion(db, other_provider.id) is None
        print("   ✅ active promo returned with id + audience")

        # expired promos are excluded
        expired = ProviderPromotion(
            provider_id=other_provider.id, headline="Too late",
            discount_pct=50, valid_until=days_from_now(-1), is_active=True,
            audience="all",
        )
        db.add(expired)
        db.commit()
        assert get_active_promotion(db, other_provider.id) is None
        print("   ✅ expired promo excluded")

        # === 4. First-time eligibility ====================================
        print("\n4. Eligibility (first-time visitors)")
        assert user_is_first_time(db, provider.id, guest.id) is True
        assert get_eligible_promotion(db, provider.id, guest.id)["id"] == str(presale_promo_id)
        print("   ✅ new guest eligible for presale promo")

        # a *pending* booking does not consume first-time status
        db.add(Booking(user_id=guest.id, provider_id=provider.id,
                       service_name="Spa Day Pass", slot_datetime=days_from_now(1),
                       amount_etb=2000, payment_method="telebirr",
                       payment_status="pending"))
        db.commit()
        assert user_is_first_time(db, provider.id, guest.id) is True
        print("   ✅ pending booking keeps first-time status")

        # a *successful* booking consumes it
        db.add(Booking(user_id=repeat.id, provider_id=provider.id,
                       service_name="Spa Day Pass", slot_datetime=days_from_now(-3),
                       amount_etb=2000, payment_method="telebirr",
                       payment_status="success"))
        db.commit()
        assert user_is_first_time(db, provider.id, repeat.id) is False
        assert get_eligible_promotion(db, provider.id, repeat.id) is None
        print("   ✅ repeat guest not eligible for presale promo")

        # audience='all' promos apply to repeat guests too
        general = ProviderPromotion(
            provider_id=provider.id, headline="Everyone: 5% off",
            discount_pct=5, valid_until=days_from_now(3), is_active=True,
            audience="all",
        )
        db.add(general)
        db.commit()
        eligible_repeat = get_eligible_promotion(db, provider.id, repeat.id)
        assert eligible_repeat is not None and eligible_repeat["audience"] == "all"
        # guest still sees the presale promo (latest valid_until wins)
        assert get_eligible_promotion(db, provider.id, guest.id)["id"] == str(presale_promo_id)
        print("   ✅ audience='all' promo applies to repeat guests")

        # === 5. Provider detail exposes per-user eligibility ==============
        print("\n5. Provider detail user_eligible flag")
        from app.crud.provider import get_provider_detail
        detail_guest = get_provider_detail(db, provider.id, user_id=guest.id)
        assert detail_guest["active_promotion"]["user_eligible"] is True
        detail_repeat = get_provider_detail(db, provider.id, user_id=repeat.id)
        # repeat guest is shown the promo they can actually use (the 'all' one)
        assert detail_repeat["active_promotion"]["user_eligible"] is True
        assert detail_repeat["active_promotion"]["audience"] == "all"
        print("   ✅ detail promo carries user_eligible per user")

        # === 6. Booking auto-applies the discount =========================
        print("\n6. Server-side discount at booking")
        from app.api.bookings import create_new_booking
        from app.schemas.booking import BookingCreate
        from fastapi import BackgroundTasks

        booking_resp = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(provider.id),
                service_name="Spa Day Pass",
                slot_datetime=days_from_now(2),
                amount_etb=2040,  # base 2000 + 2% fee
                payment_method="telebirr",
                phone_number="0911000000",
            ),
            background_tasks=BackgroundTasks(),
            user=guest, db=db,
        ))
        assert booking_resp.promotion is not None
        assert booking_resp.promotion.discount_pct == 20
        assert booking_resp.promotion.discount_etb == 408
        assert booking_resp.amount_etb == 2040 - 408
        row = db.query(Booking).filter(Booking.id == uuid.UUID(booking_resp.id)).first()
        assert row.promotion_id == presale_promo_id
        assert row.discount_etb == 408
        assert row.amount_etb == 1632
        print("   ✅ eligible booking discounted, promo recorded on row")

        # once that booking succeeds, the presale promo stops applying
        row.payment_status = "success"
        db.commit()
        second = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(provider.id),
                service_name="Spa Day Pass",
                slot_datetime=days_from_now(9),
                amount_etb=2040,
                payment_method="telebirr",
                phone_number="0911000000",
            ),
            background_tasks=BackgroundTasks(),
            user=guest, db=db,
        ))
        # guest now falls back to the general 5% promo, not the 20% presale
        assert second.promotion is not None
        assert second.promotion.discount_pct == 5
        assert second.amount_etb == 2040 - 102
        print("   ✅ presale consumed after first paid booking (falls back to 'all' promo)")

        # provider with no promos → untouched amount
        plain = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(other_provider.id),
                service_name="Yoga Class",
                slot_datetime=days_from_now(2),
                amount_etb=510,
                payment_method="mpesa",
                phone_number="254700000000",
            ),
            background_tasks=BackgroundTasks(),
            user=guest, db=db,
        ))
        assert plain.promotion is None
        assert plain.amount_etb == 510
        print("   ✅ no promo → no discount")

        # === 7. Re-entry promo payload ====================================
        print("\n7. Re-engagement promos (bot nudge)")
        promos = get_reengagement_promos(db, [guest, repeat])
        # guest has a paid booking now → presale gone; both fall back to
        # the soonest-expiring eligible discount promo ('Everyone: 5% off')
        assert promos[guest.telegram_id]["headline"] == "Everyone: 5% off"
        assert promos[repeat.telegram_id]["discount_pct"] == 5
        assert promos[repeat.telegram_id]["provider_name"].startswith("Kuriftu")
        assert promos[repeat.telegram_id]["valid_until"] is not None
        print("   ✅ batched promo lookup picks eligible, soonest-expiring promo")

        # a brand-new first-time user gets the richer presale promo instead
        fresh = create_user_from_bot(db, telegram_id=500100202, telegram_handle="fresh")
        onboard_user(db, fresh, name="Fresh Guest", interest_categories=["spa"],
                     exercise_frequency="rarely")
        promos = get_reengagement_promos(db, [fresh])
        # soonest-expiring wins: 'Everyone: 5% off' (3d) before presale (14d)
        assert promos[fresh.telegram_id]["headline"] == "Everyone: 5% off"
        print("   ✅ soonest-expiring eligible promo wins")

        # no users → no queries needed
        assert get_reengagement_promos(db, []) == {}
        print("   ✅ empty user list → empty mapping")

        # === 8. GET /api/bot/inactive-users carries promo =================
        print("\n8. Bot inactive-users endpoint")
        from app.api.bot import inactive_users

        # make fresh look inactive (10 days, never re-engaged)
        fresh.last_activity_at = datetime.now(timezone.utc) - timedelta(days=10)
        db.commit()
        payload = asyncio.run(inactive_users(days=7, db=db, _=True))
        entry = next(u for u in payload["inactive_users"] if u["telegram_id"] == fresh.telegram_id)
        assert entry["promo"] is not None
        assert entry["promo"]["discount_pct"] == 5
        assert entry["days_inactive"] >= 7
        print("   ✅ inactive user carries applicable promo payload")

        print("\n" + "=" * 50)
        print("  ALL PRESALE + RE-ENTRY TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
