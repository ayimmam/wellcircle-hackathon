"""
Well Circle — Integration test using in-memory SQLite.
Validates all business logic without needing a real PostgreSQL/Supabase connection.

Run: cd backend && source .venv/bin/activate && python -m app.tests.test_integration
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Use SQLite for testing — override UUID to String
engine = create_engine("sqlite:///:memory:", echo=False)
TestSession = sessionmaker(bind=engine)

# Patch UUID type for SQLite compatibility
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy import String, Text

PG_UUID.impl = String
JSONB.impl = Text

# Now import models (after patching)
from app.database import Base
from app.models.user import User
from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.booking import Booking

# Create tables
Base.metadata.create_all(bind=engine)


def test_all():
    db = TestSession()
    errors = []

    try:
        # ============ 1. USER CRUD ============
        print("1. Testing User CRUD...")

        from app.crud.user import (
            create_user_from_bot, get_user_by_telegram_id,
            onboard_user, update_user_profile, get_points_tier,
            get_user_joined_community_ids, get_inactive_users,
        )

        # Create user from bot /start
        user = create_user_from_bot(db, telegram_id=111222333, telegram_handle="test_meron")
        assert user.telegram_id == 111222333, "telegram_id mismatch"
        assert user.telegram_handle == "test_meron", "handle mismatch"
        assert user.is_onboarded == False, "should not be onboarded"
        print("   ✅ create_user_from_bot")

        # Find by telegram ID
        found = get_user_by_telegram_id(db, 111222333)
        assert found is not None, "user not found"
        assert str(found.id) == str(user.id), "id mismatch"
        print("   ✅ get_user_by_telegram_id")

        # Onboard
        onboard_user(db, user, name="Meron Tadesse", interest_category="yoga",
                     exercise_frequency="sometimes", goal="Stay healthy")
        assert user.is_onboarded == True, "should be onboarded"
        assert user.name == "Meron Tadesse", "name mismatch"
        assert user.interest_category == "yoga", "interest mismatch"
        assert user.goal == "Stay healthy", "goal mismatch"
        print("   ✅ onboard_user")

        # Update profile
        update_user_profile(db, user, location_neighborhood="Bole")
        assert user.location_neighborhood == "Bole", "neighborhood mismatch"
        print("   ✅ update_user_profile")

        # Points tiers
        assert get_points_tier(0) == ("seed", "🌱"), "tier 0"
        assert get_points_tier(50) == ("seed", "🌱"), "tier 50"
        assert get_points_tier(100) == ("sprout", "🌿"), "tier 100"
        assert get_points_tier(300) == ("grove", "🌳"), "tier 300"
        assert get_points_tier(700) == ("forest", "🌲"), "tier 700"
        print("   ✅ get_points_tier (all tiers)")

        # ============ 2. PROVIDER CRUD ============
        print("\n2. Testing Provider CRUD...")

        from app.crud.provider import create_provider, get_all_providers, get_provider_detail

        provider, community = create_provider(
            db, name="Zen Yoga Studio", category="yoga",
            description="Premium yoga in Bole", location_text="Bole, Addis Ababa",
            price_range="ETB 500-2000", rating=4.7,
            theme_primary_color="#10B981", theme_accent_color="#F59E0B",
            create_community=True, community_name="Zen Yoga Community",
        )
        assert provider.name == "Zen Yoga Studio", "provider name"
        assert community is not None, "community should be created"
        assert community.name == "Zen Yoga Community", "community name"
        assert community.category == "yoga", "community category inherited"
        print("   ✅ create_provider (with community)")

        providers = get_all_providers(db)
        assert len(providers) == 1, f"expected 1 provider, got {len(providers)}"
        assert providers[0]["community_id"] is not None, "should have community_id"
        print("   ✅ get_all_providers")

        detail = get_provider_detail(db, provider.id, user_id=user.id)
        assert detail is not None, "detail should exist"
        assert detail["community"]["name"] == "Zen Yoga Community", "community in detail"
        assert detail["theme_primary_color"] == "#10B981", "theme color"
        print("   ✅ get_provider_detail (with theme)")

        # ============ 3. COMMUNITY CRUD ============
        print("\n3. Testing Community CRUD...")

        from app.crud.community import (
            get_all_communities, get_community_detail,
            join_community, leave_community,
            checkin_community, get_community_feed,
            get_suggested_communities,
        )

        communities = get_all_communities(db, user_id=user.id)
        assert len(communities) == 1, "should have 1 community"
        assert communities[0]["user_joined"] == False, "not joined yet"
        print("   ✅ get_all_communities")

        # Join
        result = join_community(db, community.id, user)
        assert result["joined"] == True, "should be joined"
        assert result["member_count"] == 1, "member count should be 1"
        assert result["feed_event"]["event_type"] == "join", "feed event type"
        print("   ✅ join_community (+ feed event)")

        # Idempotent join
        result2 = join_community(db, community.id, user)
        assert result2["member_count"] == 1, "count shouldn't change"
        assert result2["feed_event"] is None, "no new event"
        print("   ✅ join_community (idempotent)")

        # Joined community IDs
        joined = get_user_joined_community_ids(db, user.id)
        assert len(joined) == 1, "should have 1 joined"
        print("   ✅ get_user_joined_community_ids")

        # Detail with join status
        detail = get_community_detail(db, community.id, user_id=user.id)
        assert detail["user_joined"] == True, "should show joined"
        assert detail["user_checked_in_today"] == False, "not checked in yet"
        print("   ✅ get_community_detail (joined)")

        # Check-in
        checkin = checkin_community(db, community.id, user)
        assert checkin["points_earned"] == 10, "should earn 10 points"
        assert checkin["new_balance"] == 10, "balance should be 10"
        assert checkin["tier"] == "seed", "should be seed tier"
        assert checkin["feed_event"]["event_type"] == "checkin", "checkin event"
        print("   ✅ checkin_community (points awarded)")

        # Double check-in (same day)
        result = checkin_community(db, community.id, user)
        assert result == "already_checked_in", "should block double checkin"
        print("   ✅ checkin_community (blocks duplicate)")

        # Check-in as non-member
        user2 = create_user_from_bot(db, telegram_id=444555666, telegram_handle="test_abel")
        result = checkin_community(db, community.id, user2)
        assert result == "not_member", "should require membership"
        print("   ✅ checkin_community (requires membership)")

        # Feed
        feed = get_community_feed(db, community.id)
        assert len(feed) == 2, f"should have 2 events (join + checkin), got {len(feed)}"
        assert feed[0]["event_type"] == "checkin", "most recent first"
        assert feed[1]["event_type"] == "join", "join second"
        print("   ✅ get_community_feed (ordered)")

        # Suggestions
        suggestions = get_suggested_communities(db, "yoga", user2.id)
        assert len(suggestions) == 1, "should suggest the yoga community"
        assert suggestions[0]["name"] == "Zen Yoga Community", "correct suggestion"
        print("   ✅ get_suggested_communities")

        # Leave
        leave = leave_community(db, community.id, user.id)
        assert leave["left"] == True, "should leave"
        assert leave["member_count"] == 0, "count should be 0"
        print("   ✅ leave_community")

        # ============ 4. BOOKING CRUD ============
        print("\n4. Testing Booking CRUD...")

        from app.crud.booking import create_booking, get_booking_by_id, update_booking_payment

        # Re-join for booking test
        join_community(db, community.id, user)

        booking = create_booking(
            db, user_id=user.id,
            provider_id=provider.id,
            service_name="Morning Vinyasa Flow",
            slot_datetime=datetime(2026, 6, 7, 7, 0, tzinfo=timezone.utc),
            amount_etb=800,
            payment_method="telebirr",
            phone_number="0911234567",
        )
        assert booking.payment_status == "pending", "should be pending"
        assert booking.amount_etb == 800, "amount"
        print("   ✅ create_booking")

        found_booking = get_booking_by_id(db, booking.id)
        assert found_booking is not None, "booking should be found"
        print("   ✅ get_booking_by_id")

        # Payment success → creates feed event
        updated = update_booking_payment(db, booking.id, "success", trade_no="WC_TEST_001")
        assert updated.payment_status == "success", "should be success"
        assert updated.telebirr_trade_no == "WC_TEST_001", "trade no stored"
        print("   ✅ update_booking_payment (success + feed event)")

        # Check feed has booking event
        feed = get_community_feed(db, community.id)
        booking_events = [e for e in feed if e["event_type"] == "booking"]
        assert len(booking_events) == 1, "should have booking event"
        print("   ✅ Booking feed event created")

        # ============ 5. ADMIN QUERIES ============
        print("\n5. Testing Admin queries...")

        from app.crud.user import get_all_users

        users, total = get_all_users(db, page=1, per_page=10)
        assert total == 2, f"should have 2 users, got {total}"
        print(f"   ✅ get_all_users (total: {total})")

        users, total = get_all_users(db, page=1, per_page=10, search="meron")
        assert total == 1, "search should find 1"
        print("   ✅ get_all_users (search)")

        users, total = get_all_users(db, page=1, per_page=10, is_onboarded=True)
        assert total == 1, "only 1 onboarded"
        print("   ✅ get_all_users (filter onboarded)")

        # ============ 6. PROVIDER STATS ============
        print("\n6. Testing Provider Dashboard Stats...")

        from app.crud.provider import get_provider_stats

        stats = get_provider_stats(db, provider.id)
        assert stats["stats"]["total_members"] == 1, "1 member"
        assert len(stats["recent_bookings"]) == 1, "1 booking"
        assert stats["theme_primary_color"] == "#10B981", "theme preserved"
        print(f"   ✅ get_provider_stats (members: {stats['stats']['total_members']}, bookings: {len(stats['recent_bookings'])})")

        # ============ 7. SERVICES ============
        print("\n7. Testing Services...")

        from app.services.telegram_auth import validate_init_data_dev
        result = validate_init_data_dev('{"id": 12345, "username": "test"}')
        assert result["telegram_id"] == 12345, "dev auth parse"
        print("   ✅ telegram_auth (dev mode)")

        from app.services.points_engine import POINTS_CHECKIN, POINTS_DECAY_PER_DAY
        assert POINTS_CHECKIN == 10, "checkin points"
        assert POINTS_DECAY_PER_DAY == 5, "decay per day"
        print("   ✅ points_engine constants")

        # ============ SUMMARY ============
        print("\n" + "=" * 50)
        print("🎉 ALL TESTS PASSED — Backend is ready!")
        print("=" * 50)

    except AssertionError as e:
        print(f"\n❌ ASSERTION FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
