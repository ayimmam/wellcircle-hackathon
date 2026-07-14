"""
Well Circle — Multi-day booking tests (booking_group_id).
Run: cd backend && python -m app.tests.test_multi_day_booking

Covers: sibling booking creation, discount applied to the primary day only,
group payment cascade (initiate + webhook paths), and the event-booking
rejection guard.
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
from app.models.provider_promotion import ProviderPromotion
from app.models.point_transaction import PointTransaction
from app.models.user_notification import UserNotification
from app.models.provider_event import ProviderEvent
from app.models.event_inventory_log import EventInventoryLog

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def days_from_now(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — MULTI-DAY BOOKING TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.provider import create_provider
        from app.crud.booking import get_booking_by_id, update_booking_group_payment
        from app.api.bookings import create_new_booking
        from app.schemas.booking import BookingCreate
        from fastapi import BackgroundTasks, HTTPException

        provider, _ = create_provider(
            db, name="Multi Day Gym", category="gym",
            description="Test provider", location_text="Bole",
            price_range="ETB 100-500", rating=4.5,
            services=[{"name": "Day Pass", "price": 180, "duration": "1 day"}],
        )
        user = create_user_from_bot(db, telegram_id=800100200, telegram_handle="multiday")

        # === 1. Multi-day booking creates siblings sharing a group id ======
        print("\n1. Sibling booking creation")
        primary_date = days_from_now(1)
        extra_dates = [days_from_now(2), days_from_now(3)]
        resp = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(provider.id),
                service_name="Day Pass",
                slot_datetime=primary_date,
                amount_etb=184,  # 180 + 2% fee, per day
                payment_method="telebirr",
                phone_number="0911000000",
                additional_slot_datetimes=extra_dates,
            ),
            background_tasks=BackgroundTasks(),
            user=user, db=db,
        ))
        assert len(resp.additional_booking_ids) == 2
        assert resp.total_amount_etb == 184 * 3
        primary = get_booking_by_id(db, uuid.UUID(resp.id))
        assert primary.booking_group_id is not None
        siblings = [get_booking_by_id(db, uuid.UUID(i)) for i in resp.additional_booking_ids]
        assert all(s.booking_group_id == primary.booking_group_id for s in siblings)
        assert all(s.amount_etb == 184 for s in siblings)
        assert all(s.payment_status == "pending" for s in siblings)
        print("   ✅ 3 bookings created (1 primary + 2 siblings), same group id")

        # === 2. Promo discount applies to the primary day only ============
        print("\n2. Presale discount applies to day 1 only")
        promo = ProviderPromotion(
            provider_id=provider.id, headline="Presale: 20% off",
            discount_pct=20, valid_until=days_from_now(14),
            is_active=True, audience="first_time",
        )
        db.add(promo)
        db.commit()

        fresh_user = create_user_from_bot(db, telegram_id=800100201, telegram_handle="fresh_multiday")
        resp2 = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(provider.id),
                service_name="Day Pass",
                slot_datetime=days_from_now(1),
                amount_etb=184,
                payment_method="telebirr",
                phone_number="0911000000",
                additional_slot_datetimes=[days_from_now(2)],
            ),
            background_tasks=BackgroundTasks(),
            user=fresh_user, db=db,
        ))
        assert resp2.promotion is not None
        assert resp2.promotion.discount_etb == 37  # round(184 * 0.20)
        assert resp2.amount_etb == 184 - 37
        sibling2 = get_booking_by_id(db, uuid.UUID(resp2.additional_booking_ids[0]))
        assert sibling2.amount_etb == 184  # full price — no discount on day 2
        assert sibling2.promotion_id is None
        assert resp2.total_amount_etb == (184 - 37) + 184
        print("   ✅ discount on primary day only; sibling charged full per-day rate")

        # === 3. Group payment cascade ======================================
        print("\n3. Group payment cascades to all siblings")
        group_id = primary.booking_group_id
        updated_primary = update_booking_group_payment(
            db, primary.id, group_id, "success", trade_no="TEST-TRADE-1",
        )
        assert updated_primary.payment_status == "success"
        assert updated_primary.telebirr_trade_no == "TEST-TRADE-1"
        for sib_id in resp.additional_booking_ids:
            sib = get_booking_by_id(db, uuid.UUID(sib_id))
            assert sib.payment_status == "success"
            assert sib.telebirr_trade_no is None  # only the primary carries the trade ref
        print("   ✅ primary carries trade_no; siblings flip to success without it")

        # Each successful sibling independently earned its own points bonus
        # (apply_transaction runs inside update_booking_payment per row)
        user_txns = (
            db.query(PointTransaction)
            .filter(PointTransaction.user_id == user.id, PointTransaction.type == "booking_bonus")
            .all()
        )
        assert len(user_txns) == 3  # primary + 2 siblings, each +50
        print("   ✅ each of the 3 bookings earned its own points bonus")

        # === 4. Event bookings reject multi-day ============================
        print("\n4. Event bookings can't be multi-day")
        event = ProviderEvent(
            provider_id=provider.id, service_name="Group Class",
            starts_at=days_from_now(1), ends_at=days_from_now(1) + timedelta(hours=1),
            capacity=10, spots_remaining=10, price_etb=100,
        )
        db.add(event)
        db.commit()
        try:
            asyncio.run(create_new_booking(
                request=BookingCreate(
                    provider_id=str(provider.id),
                    service_name="Group Class",
                    slot_datetime=days_from_now(1),
                    amount_etb=100,
                    payment_method="telebirr",
                    phone_number="0911000000",
                    event_id=str(event.id),
                    additional_slot_datetimes=[days_from_now(2)],
                ),
                background_tasks=BackgroundTasks(),
                user=user, db=db,
            ))
            assert False, "multi-day event booking should be rejected"
        except HTTPException as e:
            assert e.status_code == 422
        print("   ✅ multi-day + event_id rejected (422)")

        # === 5. Single-day booking still works (group of one) =============
        print("\n5. Single-day booking (group of one, backward compatible)")
        resp3 = asyncio.run(create_new_booking(
            request=BookingCreate(
                provider_id=str(provider.id),
                service_name="Day Pass",
                slot_datetime=days_from_now(5),
                amount_etb=184,
                payment_method="telebirr",
                phone_number="0911000000",
            ),
            background_tasks=BackgroundTasks(),
            user=user, db=db,
        ))
        assert resp3.additional_booking_ids == []
        assert resp3.total_amount_etb == resp3.amount_etb
        single = get_booking_by_id(db, uuid.UUID(resp3.id))
        assert single.booking_group_id is not None  # still assigned, just a group of one
        print("   ✅ single-day booking unaffected, still gets a group id")

        print("\n" + "=" * 50)
        print("  ALL MULTI-DAY BOOKING TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
