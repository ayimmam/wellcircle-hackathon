"""
Well Circle — Points Economy Integration Tests
Run: cd backend && source .venv/bin/activate && python -m app.tests.test_points_economy

Tests all features from POINTS_ECONOMY_PLAN.md:
  B1: Transaction ledger
  B2: Points engine consolidation
  B3: price_etb → points_cost rename
  C1: Provider customer list
  C2: Streak counter + streak freeze
  C5: Provider payout predictability
  D1: Recommended point costs
  D2: Evidence submission model
  D3: Provider-initiated point awards (with caps)
  Decay: Ledger-based decay eligibility
  E1: Referral fields
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, String, Text, TypeDecorator, event as sa_event
from sqlalchemy.orm import sessionmaker

# --- SQLite UUID/JSONB compatibility (reused from test_integration.py) ---
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
from app.models.product import Product
from app.models.user_redemption import UserRedemption
from app.models.point_transaction import PointTransaction
from app.models.evidence_submission import EvidenceSubmission
from app.models.provider_event import ProviderEvent

# Create in-memory SQLite
engine = create_engine("sqlite:///:memory:", echo=False)

# SQLite needs foreign key enforcement enabled per-connection
@sa_event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=OFF")  # OFF for testing flexibility
    cursor.close()

Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def _create_user(db, telegram_id, name=None, handle=None):
    """Helper: create a user."""
    from app.crud.user import create_user_from_bot
    user = create_user_from_bot(db, telegram_id=telegram_id, telegram_handle=handle)
    if name:
        user.name = name
        user.is_onboarded = True
        db.commit()
    return user


def _create_provider_with_community(db, owner_user, name="Test Provider", category="yoga"):
    """Helper: create a provider + community."""
    from app.crud.provider import create_provider
    provider, community = create_provider(
        db, name=name, category=category,
        description="Test", location_text="Bole, Addis Ababa",
        price_range="ETB 500-2000", rating=4.5,
        create_community=True, community_name=f"{name} Community",
    )
    provider.owner_user_id = owner_user.id
    owner_user.is_provider = True
    db.commit()
    db.refresh(provider)
    return provider, community


def test_all():
    db = TestSession()
    passed = 0
    failed = 0

    def check(condition, label):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"   ✅ {label}")
        else:
            failed += 1
            print(f"   ❌ FAIL: {label}")

    try:
        print("=" * 60)
        print("  POINTS ECONOMY — INTEGRATION TESTS")
        print("=" * 60)

        # ══════════════════════════════════════════════════════════
        # B1: Transaction Ledger
        # ══════════════════════════════════════════════════════════
        print("\n━━ B1: Transaction Ledger ━━")
        from app.services.points import (
            apply_transaction, get_user_transactions, get_points_tier,
            reverse_transaction, get_last_positive_transaction_at,
            POINTS_CHECKIN, POINTS_BOOKING_BONUS, POINTS_DECAY_PER_DAY,
            TXN_CHECKIN, TXN_BOOKING_BONUS, TXN_DECAY, TXN_REDEMPTION,
            TXN_GIFT_SENT, TXN_GIFT_RECEIVED, TXN_PROVIDER_AWARD,
            TXN_CHALLENGE, TXN_REFERRAL,
        )

        user1 = _create_user(db, 100001, "Meron Tadesse", "meron_t")

        # Apply a check-in transaction
        txn1 = apply_transaction(db, user1, POINTS_CHECKIN, TXN_CHECKIN, note="Test checkin")
        db.commit()
        check(user1.points_balance == 10, f"apply_transaction: checkin +10 → balance={user1.points_balance}")
        check(txn1.type == TXN_CHECKIN, f"Transaction type is '{txn1.type}'")
        check(txn1.amount == 10, f"Transaction amount is {txn1.amount}")

        # Apply a booking bonus
        txn2 = apply_transaction(db, user1, POINTS_BOOKING_BONUS, TXN_BOOKING_BONUS, note="Test booking")
        db.commit()
        check(user1.points_balance == 60, f"apply_transaction: booking +50 → balance={user1.points_balance}")

        # Verify history
        history = get_user_transactions(db, user1.id, limit=10)
        check(len(history) == 2, f"get_user_transactions returns {len(history)} rows")
        check(history[0].type == TXN_BOOKING_BONUS, "Most recent is booking_bonus (newest first)")

        # Reversal
        compensating = reverse_transaction(db, txn2, note="Test reversal")
        db.commit()
        check(user1.points_balance == 10, f"reverse_transaction: balance back to {user1.points_balance}")
        check(txn2.reversed_by == compensating.id, "Original txn marked as reversed")

        # Balance never goes below 0
        apply_transaction(db, user1, -999, TXN_DECAY, note="Force decay")
        db.commit()
        check(user1.points_balance == 0, f"Balance floored at 0 (not negative): {user1.points_balance}")

        # Reset balance for further tests
        apply_transaction(db, user1, 200, TXN_CHECKIN, note="Reset balance")
        db.commit()

        # ══════════════════════════════════════════════════════════
        # B2: Engine Consolidation
        # ══════════════════════════════════════════════════════════
        print("\n━━ B2: Engine Consolidation ━━")
        check(get_points_tier(0) == ("seed", "🌱"), "Tier: seed at 0")
        check(get_points_tier(100) == ("sprout", "🌿"), "Tier: sprout at 100")
        check(get_points_tier(300) == ("grove", "🌳"), "Tier: grove at 300")
        check(get_points_tier(700) == ("forest", "🌲"), "Tier: forest at 700")
        check(POINTS_CHECKIN == 10, "POINTS_CHECKIN constant = 10")
        check(POINTS_BOOKING_BONUS == 50, "POINTS_BOOKING_BONUS constant = 50")
        check(POINTS_DECAY_PER_DAY == 5, "POINTS_DECAY_PER_DAY constant = 5")

        # Legacy points_engine.py still importable for backwards compat
        from app.services.points_engine import POINTS_CHECKIN as legacy_checkin
        check(legacy_checkin == 10, "Legacy points_engine still importable")

        # ══════════════════════════════════════════════════════════
        # B3: Product price_etb → points_cost rename
        # ══════════════════════════════════════════════════════════
        print("\n━━ B3: Product price_etb → points_cost ━━")
        provider_user = _create_user(db, 100002, "Provider Owner", "provider_owner")
        provider, community = _create_provider_with_community(db, provider_user, "Zen Yoga")

        from app.crud.product import create_product
        product = create_product(
            db, provider.id, name="Day Pass", type="digital",
            price_etb=500, quantity_in_stock=10,
        )
        check(product.points_cost == 500, f"Product.points_cost = {product.points_cost}")
        check(product.price_etb == 500, f"Product.price_etb alias = {product.price_etb}")

        # Can set via the alias
        product.price_etb = 600
        db.commit()
        check(product.points_cost == 600, f"Setting price_etb alias updates points_cost = {product.points_cost}")

        # Reset
        product.points_cost = 500
        db.commit()

        # ══════════════════════════════════════════════════════════
        # C1: Provider Customer List
        # ══════════════════════════════════════════════════════════
        print("\n━━ C1: Provider Customer List ━━")
        from app.crud.provider import get_provider_customers

        # Make user1 a customer via community join + checkin
        from app.crud.community import join_community, checkin_community
        join_community(db, community.id, user1)
        checkin_community(db, community.id, user1)

        customers = get_provider_customers(db, provider.id)
        check(len(customers) >= 1, f"Customer list has {len(customers)} customer(s)")
        customer_ids = [c["user_id"] for c in customers]
        check(str(user1.id) in customer_ids, "user1 appears in customer list (via checkin)")

        # Also via booking
        user2 = _create_user(db, 100003, "Abel", "abel_t")
        from app.crud.booking import create_booking, update_booking_payment
        booking = create_booking(
            db, user_id=user2.id, provider_id=provider.id,
            service_name="Test Class", slot_datetime=datetime(2026, 7, 10, 9, 0, tzinfo=timezone.utc),
            amount_etb=800, payment_method="telebirr",
        )
        update_booking_payment(db, booking.id, "success", trade_no="WC_PE_001")
        customers = get_provider_customers(db, provider.id)
        customer_ids = [c["user_id"] for c in customers]
        check(str(user2.id) in customer_ids, "user2 appears in customer list (via booking)")

        # ══════════════════════════════════════════════════════════
        # C2: Streak Counter + Freeze
        # ══════════════════════════════════════════════════════════
        print("\n━━ C2: Streak Counter + Freeze ━━")
        streak_user = _create_user(db, 100010, "Streak Tester", "streak")

        # Create a community for streak testing
        from app.crud.provider import create_provider
        streak_provider, streak_community = create_provider(
            db, name="Streak Gym", category="gym",
            create_community=True, community_name="Streak Gym Community",
        )
        join_community(db, streak_community.id, streak_user)

        # First check-in sets streak to 1
        result = checkin_community(db, streak_community.id, streak_user)
        check(isinstance(result, dict), "First check-in succeeds")
        check(result.get("current_streak") == 1, f"Streak = {result.get('current_streak')} after first checkin")

        # Simulate consecutive day by manipulating last_checkin_at
        streak_user.last_checkin_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
        # Need to clear the duplicate check — delete today's feed event
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        db.query(CommunityFeedEvent).filter(
            CommunityFeedEvent.user_id == streak_user.id,
            CommunityFeedEvent.community_id == streak_community.id,
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= today_start,
        ).delete()
        db.commit()

        result2 = checkin_community(db, streak_community.id, streak_user)
        check(isinstance(result2, dict), "Second day check-in succeeds")
        check(result2.get("current_streak") == 2, f"Streak = {result2.get('current_streak')} after day 2")

        # Test streak freeze award (at day 7)
        streak_user.current_streak = 6  # Set to 6, next checkin makes 7
        streak_user.last_checkin_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
        db.query(CommunityFeedEvent).filter(
            CommunityFeedEvent.user_id == streak_user.id,
            CommunityFeedEvent.community_id == streak_community.id,
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= today_start,
        ).delete()
        db.commit()

        result3 = checkin_community(db, streak_community.id, streak_user)
        check(result3.get("current_streak") == 7, f"Streak = {result3.get('current_streak')} at day 7")
        check(result3.get("freeze_count", 0) >= 1, f"Freeze earned: freeze_count = {result3.get('freeze_count')}")

        # ══════════════════════════════════════════════════════════
        # D1: Price Suggestion
        # ══════════════════════════════════════════════════════════
        print("\n━━ D1: Price Suggestion ━━")
        from app.crud.provider import get_price_suggestion

        # With < 3 products → fallback
        suggestion = get_price_suggestion(db, "yoga")
        check(suggestion["has_comparables"] == False, "Falls back when < 3 products")
        check("set points equal" in suggestion["suggestion_text"].lower() or "not enough" in suggestion["suggestion_text"].lower(),
              "Fallback message present")

        # Add enough products to get real stats
        for i, price in enumerate([200, 400, 600, 800]):
            create_product(
                db, provider.id, name=f"Service {i}", type="digital",
                price_etb=price, quantity_in_stock=5,
            )
        suggestion2 = get_price_suggestion(db, "yoga")
        check(suggestion2["has_comparables"] == True, f"Has comparables with {suggestion2['sample_size']} products")
        check(suggestion2["median"] is not None, f"Median = {suggestion2['median']}")
        check(suggestion2["p25"] is not None, f"P25 = {suggestion2['p25']}")
        check(suggestion2["p75"] is not None, f"P75 = {suggestion2['p75']}")

        # ══════════════════════════════════════════════════════════
        # D2: Evidence Submission Model
        # ══════════════════════════════════════════════════════════
        print("\n━━ D2: Evidence Submission Model ━━")
        # Verify the model is usable
        event = ProviderEvent(
            provider_id=provider.id,
            service_name="Yoga Retreat",
            starts_at=datetime(2026, 7, 1, 9, 0, tzinfo=timezone.utc),
            ends_at=datetime(2026, 7, 1, 17, 0, tzinfo=timezone.utc),
            capacity=20, spots_remaining=20, price_etb=1000,
            staff_user_id=provider_user.id,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        check(event.staff_user_id == provider_user.id, "ProviderEvent.staff_user_id set correctly")

        submission = EvidenceSubmission(
            event_id=event.id,
            submitter_user_id=provider_user.id,
            telegram_file_id="AgACAgIAAxkBAAI_test_123",
            status="pending",
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        check(submission.status == "pending", "EvidenceSubmission created with pending status")
        check(submission.telegram_file_id == "AgACAgIAAxkBAAI_test_123", "telegram_file_id stored")

        # Simulate approval
        submission.status = "approved"
        submission.reviewed_by = provider_user.id
        submission.reviewed_at = datetime.now(timezone.utc)
        submission.points_per_participant = 25
        db.commit()
        check(submission.status == "approved", "Evidence approved")
        check(submission.points_per_participant == 25, "points_per_participant set")

        # ══════════════════════════════════════════════════════════
        # D3: Provider-Initiated Point Awards (with caps)
        # ══════════════════════════════════════════════════════════
        print("\n━━ D3: Provider Awards (with caps) ━━")
        from app.crud.provider import award_customer_points

        # user1 has a checkin at this provider's community → eligible
        initial_balance = user1.points_balance
        result = award_customer_points(db, provider.id, user1.id, 30, note="Great attendance!")
        check(result["points_awarded"] == 30, f"Awarded 30 pts")
        check(user1.points_balance == initial_balance + 30, f"Customer balance increased to {user1.points_balance}")
        check(result["provider_daily_remaining"] == 270, f"Provider daily remaining = {result['provider_daily_remaining']}")

        # Cap: max 1 award per customer per day
        try:
            award_customer_points(db, provider.id, user1.id, 10)
            check(False, "Should have raised for duplicate daily award")
        except ValueError as e:
            check("already awarded" in str(e).lower(), f"Blocked duplicate: {e}")

        # Cap: max 50 points per award
        try:
            award_customer_points(db, provider.id, user2.id, 51)
            check(False, "Should have raised for > 50 pts")
        except ValueError as e:
            check("maximum" in str(e).lower(), f"Blocked >50: {e}")

        # Cap: no interaction → rejected
        user_stranger = _create_user(db, 100099, "Stranger", "stranger")
        try:
            award_customer_points(db, provider.id, user_stranger.id, 10)
            check(False, "Should have raised for non-customer")
        except ValueError as e:
            check("no verified interaction" in str(e).lower(), f"Blocked non-customer: {e}")

        # Verify the ledger entry
        award_txns = [t for t in get_user_transactions(db, user1.id) if t.type == TXN_PROVIDER_AWARD]
        check(len(award_txns) >= 1, f"Provider award appears in ledger ({len(award_txns)} entries)")

        # ══════════════════════════════════════════════════════════
        # Decay: Ledger-based eligibility
        # ══════════════════════════════════════════════════════════
        print("\n━━ Decay: Ledger-based eligibility ━━")
        last_pos = get_last_positive_transaction_at(db, user1.id)
        check(last_pos is not None, f"Last positive txn found: {last_pos}")

        # User with no transactions
        empty_user = _create_user(db, 100050, "NoTxn", "notxn")
        last_pos_empty = get_last_positive_transaction_at(db, empty_user.id)
        check(last_pos_empty is None, "No txn user returns None")

        # ══════════════════════════════════════════════════════════
        # E1: Referral Fields
        # ══════════════════════════════════════════════════════════
        print("\n━━ E1: Referral Fields ━━")
        referrer = _create_user(db, 100060, "Referrer", "referrer")
        referee = _create_user(db, 100061, "Referee", "referee")
        referee.referred_by = referrer.id
        db.commit()
        db.refresh(referee)
        check(referee.referred_by == referrer.id, "User.referred_by correctly links to referrer")

        # Referral points via ledger
        from app.services.points import count_referrals_this_month, REFERRAL_MAX_PER_MONTH, POINTS_REFERRAL
        apply_transaction(db, referrer, POINTS_REFERRAL, TXN_REFERRAL, note="Referral bonus")
        apply_transaction(db, referee, POINTS_REFERRAL, TXN_REFERRAL, note="Referral bonus")
        db.commit()
        check(referrer.points_balance >= POINTS_REFERRAL, f"Referrer earned {POINTS_REFERRAL} pts")
        check(referee.points_balance >= POINTS_REFERRAL, f"Referee earned {POINTS_REFERRAL} pts")

        referral_count = count_referrals_this_month(db, referrer.id)
        check(referral_count >= 1, f"Referral count this month = {referral_count}")
        check(REFERRAL_MAX_PER_MONTH == 10, "Referral cap constant = 10")

        # ══════════════════════════════════════════════════════════
        # C5: Provider Points Analytics
        # ══════════════════════════════════════════════════════════
        print("\n━━ C5: Provider Points Analytics ━━")
        from app.crud.provider import get_provider_points_analytics
        analytics = get_provider_points_analytics(db, provider.id)
        check("weekly_trend" in analytics, "Analytics has weekly_trend key")
        check(len(analytics["weekly_trend"]) == 4, f"4 weeks of data: {len(analytics['weekly_trend'])}")

        # ══════════════════════════════════════════════════════════
        # Integration: Booking awards points via ledger
        # ══════════════════════════════════════════════════════════
        print("\n━━ Integration: Booking → Ledger ━━")
        user3 = _create_user(db, 100004, "Booking User", "booker")
        initial_bal = user3.points_balance or 0
        booking2 = create_booking(
            db, user_id=user3.id, provider_id=provider.id,
            service_name="Morning Class", slot_datetime=datetime(2026, 7, 11, 7, 0, tzinfo=timezone.utc),
            amount_etb=500, payment_method="telebirr",
        )
        update_booking_payment(db, booking2.id, "success", trade_no="WC_PE_002")
        db.refresh(user3)
        check(user3.points_balance == initial_bal + 50, f"Booking awards +50 via ledger → {user3.points_balance}")
        booking_txns = [t for t in get_user_transactions(db, user3.id) if t.type == TXN_BOOKING_BONUS]
        check(len(booking_txns) == 1, "Booking bonus appears in ledger")

        # ══════════════════════════════════════════════════════════
        # Integration: Redemption deducts via ledger
        # ══════════════════════════════════════════════════════════
        print("\n━━ Integration: Redemption → Ledger ━━")
        from app.crud.product import redeem_product
        user3.points_balance = 1000  # ensure enough
        db.commit()
        redeem_result = redeem_product(db, product.id, user3)
        check(redeem_result["details"]["points_spent"] == 500, f"Redemption cost 500 pts")
        redemption_txns = [t for t in get_user_transactions(db, user3.id) if t.type == TXN_REDEMPTION]
        check(len(redemption_txns) == 1, "Redemption appears in ledger")
        check(redemption_txns[0].amount == -500, f"Redemption ledger amount = {redemption_txns[0].amount}")

        # ══════════════════════════════════════════════════════════
        # Integration: Gift transfer via ledger
        # ══════════════════════════════════════════════════════════
        print("\n━━ Integration: Gift Transfer → Ledger ━━")
        from app.models.post import Post
        # Create a post for reaction
        post = Post(user_id=user2.id, community_id=community.id, content="Test post")
        db.add(post)
        db.commit()
        db.refresh(post)

        user1.points_balance = 100
        user2.points_balance = 50
        db.commit()

        from app.crud.post import react_to_post
        react_to_post(db, post.id, user1.id, "❤️", points_to_gift=20)
        db.refresh(user1)
        db.refresh(user2)
        check(user1.points_balance == 80, f"Gift sender balance: {user1.points_balance}")
        check(user2.points_balance == 70, f"Gift receiver balance: {user2.points_balance}")
        gift_sent = [t for t in get_user_transactions(db, user1.id) if t.type == TXN_GIFT_SENT]
        gift_recv = [t for t in get_user_transactions(db, user2.id) if t.type == TXN_GIFT_RECEIVED]
        check(len(gift_sent) >= 1, "Gift sent in ledger")
        check(len(gift_recv) >= 1, "Gift received in ledger")

        # ══════════════════════════════════════════════════════════
        # RESULTS
        # ══════════════════════════════════════════════════════════
        print("\n" + "=" * 60)
        total = passed + failed
        if failed == 0:
            print(f"  🎉 ALL {passed} TESTS PASSED")
            print("  Points Economy implementation verified!")
        else:
            print(f"  ⚠️  {passed}/{total} passed, {failed} FAILED")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
