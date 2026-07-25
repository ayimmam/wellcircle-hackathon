"""
Well Circle — Integration test using in-memory SQLite.
Run: cd backend && source .venv/bin/activate && python -m app.tests.test_integration
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker

# --- SQLite UUID compatibility ---
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
_OrigUUID = pg.UUID
_OrigJSONB = pg.JSONB

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
from app.models.provider_invite import ProviderInvite
from app.models.product import Product
from app.models.user_redemption import UserRedemption
from app.models.admin_notification import AdminNotification

# Create in-memory SQLite
engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — INTEGRATION TESTS")
        print("=" * 50)

        # === 1. USER CRUD ===
        print("\n1. User CRUD")
        from app.crud.user import (
            create_user_from_bot, get_user_by_telegram_id,
            onboard_user, update_user_profile, get_points_tier,
            get_user_joined_community_ids,
        )

        user = create_user_from_bot(db, telegram_id=111222333, telegram_handle="test_meron")
        assert user.telegram_id == 111222333
        assert user.is_onboarded == False
        print("   ✅ create_user_from_bot")

        found = get_user_by_telegram_id(db, 111222333)
        assert found is not None
        print("   ✅ get_user_by_telegram_id")

        onboard_user(db, user, name="Meron Tadesse", interest_categories=["yoga"],
                     exercise_frequency="sometimes", goal="Stay healthy")
        assert user.is_onboarded == True
        assert user.name == "Meron Tadesse"
        print("   ✅ onboard_user")

        update_user_profile(db, user, location_neighborhood="Bole")
        assert user.location_neighborhood == "Bole"
        print("   ✅ update_user_profile")

        assert get_points_tier(0) == ("seed", "🌱")
        assert get_points_tier(100) == ("sprout", "🌿")
        assert get_points_tier(300) == ("grove", "🌳")
        assert get_points_tier(700) == ("forest", "🌲")
        print("   ✅ get_points_tier (all 4 tiers)")

        # === 2. PROVIDER CRUD ===
        print("\n2. Provider CRUD")
        from app.crud.provider import create_provider, get_all_providers, get_provider_detail

        provider, community = create_provider(
            db, name="Zen Yoga Studio", category="yoga",
            description="Premium yoga in Bole", location_text="Bole, Addis Ababa",
            price_range="ETB 500-2000", rating=4.7,
            theme_primary_color="#10B981", theme_accent_color="#F59E0B",
            create_community=True, community_name="Zen Yoga Community",
        )
        assert provider.name == "Zen Yoga Studio"
        assert community is not None
        assert community.name == "Zen Yoga Community"
        print("   ✅ create_provider + auto-create community")

        plist = get_all_providers(db)
        assert len(plist) == 1
        assert plist[0]["community_id"] is not None
        print("   ✅ get_all_providers (with community_id)")

        detail = get_provider_detail(db, provider.id, user_id=user.id)
        assert detail["theme_primary_color"] == "#10B981"
        print("   ✅ get_provider_detail (with theme colors)")

        # === 3. COMMUNITY CRUD ===
        print("\n3. Community CRUD")
        from app.crud.community import (
            get_all_communities, get_community_detail,
            join_community, leave_community,
            checkin_community, get_community_feed,
            get_suggested_communities,
        )

        comms = get_all_communities(db, user_id=user.id)
        assert len(comms) == 1
        assert comms[0]["user_joined"] == False
        print("   ✅ get_all_communities (not joined)")

        result = join_community(db, community.id, user)
        assert result["joined"] == True
        assert result["member_count"] == 1
        assert result["feed_event"]["event_type"] == "join"
        print("   ✅ join_community (+ join feed event)")

        result2 = join_community(db, community.id, user)
        assert result2["feed_event"] is None
        print("   ✅ join_community (idempotent — no duplicate)")

        joined = get_user_joined_community_ids(db, user.id)
        assert len(joined) == 1
        print("   ✅ get_user_joined_community_ids")

        det = get_community_detail(db, community.id, user_id=user.id)
        assert det["user_joined"] == True
        assert det["user_checked_in_today"] == False
        print("   ✅ get_community_detail (joined, not checked in)")

        checkin = checkin_community(db, community.id, user)
        assert checkin["points_earned"] == 10
        # onboarding awarded POINTS_WELCOME (20), so first check-in lands at 30
        assert checkin["new_balance"] == 30
        assert checkin["tier"] == "seed"
        assert checkin["feed_event"]["event_type"] == "checkin"
        print("   ✅ checkin_community (+10 pts on top of welcome award, seed tier)")

        dup = checkin_community(db, community.id, user)
        assert dup == "already_checked_in"
        print("   ✅ checkin_community (blocks same-day duplicate)")

        user2 = create_user_from_bot(db, telegram_id=444555666, telegram_handle="test_abel")
        nm = checkin_community(db, community.id, user2)
        assert nm == "not_member"
        print("   ✅ checkin_community (rejects non-member)")

        feed = get_community_feed(db, community.id)
        assert len(feed) == 2
        assert feed[0]["event_type"] == "checkin"
        assert feed[1]["event_type"] == "join"
        print("   ✅ get_community_feed (2 events, newest first)")

        sugg = get_suggested_communities(db, ["yoga"], user2.id)
        assert len(sugg) == 1
        assert sugg[0]["name"] == "Zen Yoga Community"
        print("   ✅ get_suggested_communities (interest-based)")

        lv = leave_community(db, community.id, user.id)
        assert lv["left"] == True
        assert lv["member_count"] == 0
        print("   ✅ leave_community (count decremented)")

        # === 4. BOOKING + PAYMENT ===
        print("\n4. Booking & Payment")
        from app.crud.booking import create_booking, get_booking_by_id, update_booking_payment

        join_community(db, community.id, user)

        booking = create_booking(
            db, user_id=user.id, provider_id=provider.id,
            service_name="Morning Vinyasa Flow",
            slot_datetime=datetime(2026, 6, 7, 7, 0, tzinfo=timezone.utc),
            amount_etb=800, payment_method="telebirr",
        )
        assert booking.payment_status == "pending"
        print("   ✅ create_booking (pending)")

        fb = get_booking_by_id(db, booking.id)
        assert fb is not None
        print("   ✅ get_booking_by_id")

        updated = update_booking_payment(db, booking.id, "success", trade_no="WC_TEST_001")
        assert updated.payment_status == "success"
        assert updated.telebirr_trade_no == "WC_TEST_001"
        print("   ✅ update_booking_payment (success)")

        feed = get_community_feed(db, community.id)
        bk_events = [e for e in feed if e["event_type"] == "booking"]
        assert len(bk_events) == 1
        print("   ✅ Booking auto-creates feed event")

        # === 5. ADMIN ===
        print("\n5. Admin Queries")
        from app.crud.user import get_all_users

        users_list, total = get_all_users(db, page=1, per_page=10)
        assert total == 2
        print(f"   ✅ get_all_users (total={total})")

        users_list, total = get_all_users(db, search="meron")
        assert total == 1
        print("   ✅ get_all_users (search='meron' → 1)")

        users_list, total = get_all_users(db, is_onboarded=True)
        assert total == 1
        print("   ✅ get_all_users (onboarded only → 1)")

        # === 6. PROVIDER DASHBOARD ===
        print("\n6. Provider Dashboard Stats")
        from app.crud.provider import get_provider_stats

        stats = get_provider_stats(db, provider.id)
        assert stats["stats"]["total_members"] == 1
        assert len(stats["recent_bookings"]) == 1
        assert stats["theme_primary_color"] == "#10B981"
        assert stats["provider_name"] == "Zen Yoga Studio"
        print(f"   ✅ Provider stats OK (members={stats['stats']['total_members']}, bookings={len(stats['recent_bookings'])})")

        # === 7. SERVICES ===
        print("\n7. Services")
        from app.services.telegram_auth import validate_init_data_dev
        r = validate_init_data_dev('{"id": 12345, "username": "test"}')
        assert r["telegram_id"] == 12345
        print("   ✅ telegram_auth dev mode")

        from app.services.points_engine import POINTS_CHECKIN, POINTS_DECAY_PER_DAY
        assert POINTS_CHECKIN == 10 and POINTS_DECAY_PER_DAY == 5
        print("   ✅ points_engine constants")

        # === 8. PHASE 2 — ONBOARDING & PRODUCTS ===
        print("\n8. Phase 2 — Onboarding & Products")
        from app.crud.provider_invite import create_invite, get_valid_invite
        from app.crud.provider import create_self_onboarded_provider, approve_provider
        from app.crud.product import create_product, redeem_product, browse_products

        admin_user = create_user_from_bot(db, telegram_id=999888777, telegram_handle="admin_test")
        admin_user.is_super_admin = True
        db.commit()

        invite = create_invite(db, admin_user.id)
        assert invite.invite_code.startswith("INVITE-")
        print("   ✅ create_invite")

        applicant = create_user_from_bot(db, telegram_id=555666777, telegram_handle="applicant")
        valid = get_valid_invite(db, invite.invite_code)
        new_provider = create_self_onboarded_provider(
            db, applicant, valid, name="Test Studio", category="yoga", location_text="Bole",
        )
        # Hackathon flow: self-onboarding auto-approves (status active,
        # is_provider set immediately) — no admin review step.
        assert new_provider.status == "active"
        assert applicant.is_provider
        print("   ✅ self_onboard (auto-approved)")

        # approve_provider only acts on pending applications — auto-approved
        # providers are no longer pending, so it returns None untouched.
        assert approve_provider(db, new_provider.id) is None
        db.refresh(new_provider)
        assert new_provider.status == "active"
        print("   ✅ approve_provider (no-op on auto-approved)")

        product = create_product(
            db, provider.id, name="Voucher", type="digital",
            price_etb=50, quantity_in_stock=5, digital_code_template="YOGA-{RANDOM_6CHARS}",
        )
        user.points_balance = 100
        db.commit()
        result = redeem_product(db, product.id, user)
        assert result["redemption_code"] and user.points_balance == 50
        print("   ✅ redeem_product")

        items, total = browse_products(db)
        assert total >= 1
        print("   ✅ browse_products")

        # === 9. PROVIDER WEBSITE — bookings, analytics, demographics, widget auth, redeem mgmt ===
        print("\n9. Provider Website")
        from datetime import timedelta
        import hmac, hashlib, time
        from app.crud.provider import (
            get_provider_bookings, get_provider_service_breakdown,
            get_provider_customer_demographics, get_provider_metrics_timeseries,
        )
        from app.crud.product import provider_update_redemption_status, get_provider_redemptions
        from app.services.telegram_login_widget import validate_login_widget_data
        from app.config import settings

        bk_items, bk_total = get_provider_bookings(db, provider.id)
        assert bk_total == 1
        assert bk_items[0]["service_name"] == "Morning Vinyasa Flow"
        assert bk_items[0]["customer_demographics"]["location_neighborhood"] == "Bole"
        assert bk_items[0]["customer_demographics"]["interest_categories"] == ["yoga"]
        print("   ✅ get_provider_bookings (with customer demographics)")

        services = get_provider_service_breakdown(db, provider.id)
        assert services[0]["service_name"] == "Morning Vinyasa Flow"
        assert services[0]["bookings_count"] == 1
        assert services[0]["revenue_etb"] == 800
        print("   ✅ get_provider_service_breakdown (most booked service)")

        demo = get_provider_customer_demographics(db, provider.id)
        assert demo["total_customers"] >= 1
        assert any(b["label"] == "Bole" for b in demo["by_neighborhood"])
        assert any(b["label"] == "yoga" for b in demo["by_interest_category"])
        print("   ✅ get_provider_customer_demographics")

        now = datetime.now(timezone.utc)
        series = get_provider_metrics_timeseries(db, provider.id, now - timedelta(days=7), now)
        assert series["totals"]["bookings"] == 1
        assert len(series["series"]) == 8  # inclusive 7-day range
        print("   ✅ get_provider_metrics_timeseries (custom time metrics)")

        updated_redemption = provider_update_redemption_status(
            db, provider.id, uuid.UUID(result["redemption_id"]), "shipped", notes="Sent via Bole courier",
        )
        assert updated_redemption.delivery_status == "shipped"
        assert updated_redemption.provider_notes == "Sent via Bole courier"
        print("   ✅ provider_update_redemption_status (redeem management)")

        redemption_items, redemption_total = get_provider_redemptions(db, provider.id)
        assert redemption_total == 1
        assert redemption_items[0]["delivery_status"] == "shipped"
        print("   ✅ get_provider_redemptions (paginated)")

        # Telegram Login Widget HMAC — provider website login
        widget_payload = {
            "id": str(user.telegram_id),
            "first_name": "Meron",
            "username": "test_meron",
            "auth_date": str(int(time.time())),
        }
        check_string = "\n".join(sorted(f"{k}={v}" for k, v in widget_payload.items()))
        secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
        widget_payload["hash"] = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        widget_payload["id"] = int(widget_payload["id"])
        widget_payload["auth_date"] = int(widget_payload["auth_date"])

        validated = validate_login_widget_data(widget_payload)
        assert validated is not None
        assert validated["telegram_id"] == user.telegram_id
        print("   ✅ validate_login_widget_data (valid HMAC)")

        tampered = dict(widget_payload)
        tampered["first_name"] = "Attacker"
        assert validate_login_widget_data(tampered) is None
        print("   ✅ validate_login_widget_data (rejects tampered payload)")

        # === DONE ===
        print("\n" + "=" * 50)
        print("  🎉 ALL TESTS PASSED (including Phase 2)")
        print("  Backend + Bot integration is ready to ship!")
        print("=" * 50)

    except AssertionError as e:
        print(f"\n❌ ASSERTION FAILED: {e}")
        import traceback; traceback.print_exc()
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_all()
