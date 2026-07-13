"""
Well Circle — Engagement-loop tests (UX psychology sprint).
Run: cd backend && python -m app.tests.test_engagement_loop

Covers: onboarding welcome points (endowed progress, idempotent),
checked_in_today on the communities list (Home check-in card),
streak-freeze consumption (one missed day survives), and the
streaks-at-risk feed for the bot's evening nudge.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


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
from app.models.community_challenge import CommunityChallenge

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — ENGAGEMENT LOOP TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot, onboard_user, get_streaks_at_risk
        from app.crud.provider import create_provider
        from app.crud.community import get_all_communities, join_community, checkin_community
        from app.services.points import POINTS_WELCOME, TXN_WELCOME

        provider, community = create_provider(
            db, name="Habit Studio", category="yoga",
            description="Engagement test provider", location_text="Bole",
            price_range="ETB 300-800", rating=4.5,
            create_community=True, community_name="Habit Circle",
        )

        # === 1. Welcome points (endowed progress) =========================
        print("\n1. Onboarding welcome points")
        user = create_user_from_bot(db, telegram_id=600100200, telegram_handle="endowed")
        assert (user.points_balance or 0) == 0
        onboard_user(db, user, name="Endowed User", interest_category="yoga",
                     exercise_frequency="sometimes")
        assert user.points_balance == POINTS_WELCOME
        welcome_txns = (
            db.query(PointTransaction)
            .filter(PointTransaction.user_id == user.id, PointTransaction.type == TXN_WELCOME)
            .all()
        )
        assert len(welcome_txns) == 1
        print(f"   ✅ +{POINTS_WELCOME} welcome points awarded once, ledgered")

        # Re-running onboard (retry path) must not double-award
        onboard_user(db, user, name="Endowed User", interest_category="yoga",
                     exercise_frequency="regular")
        assert user.points_balance == POINTS_WELCOME
        assert db.query(PointTransaction).filter(
            PointTransaction.user_id == user.id, PointTransaction.type == TXN_WELCOME
        ).count() == 1
        print("   ✅ re-onboard does not double-award")

        # === 2. checked_in_today on communities list ======================
        print("\n2. Communities list checked_in_today")
        join_community(db, community.id, user)
        comms = get_all_communities(db, user_id=user.id)
        me = next(c for c in comms if c["id"] == str(community.id))
        assert me["user_joined"] is True
        assert me["checked_in_today"] is False
        print("   ✅ false before check-in")

        res = checkin_community(db, community.id, user)
        assert isinstance(res, dict)
        assert res["current_streak"] == 1
        assert res["freeze_used"] is False
        comms = get_all_communities(db, user_id=user.id)
        me = next(c for c in comms if c["id"] == str(community.id))
        assert me["checked_in_today"] is True
        print("   ✅ true after check-in")

        # === 3. Streak freeze consumption =================================
        print("\n3. Streak freezes cover one missed day")
        frozen = create_user_from_bot(db, telegram_id=600100201, telegram_handle="frozen")
        onboard_user(db, frozen, name="Frozen User", interest_category="yoga",
                     exercise_frequency="daily")
        join_community(db, community.id, frozen)
        # Simulate: 6-day streak, 1 freeze, last check-in two days ago
        frozen.current_streak = 6
        frozen.freeze_count = 1
        frozen.last_checkin_at = datetime.now(timezone.utc) - timedelta(days=2)
        db.commit()

        res = checkin_community(db, community.id, frozen)
        assert res["freeze_used"] is True
        assert res["current_streak"] == 7 + 0 or res["current_streak"] == 7  # 6 + 1
        # the 7-day milestone also re-earns a freeze: 1 - 1 (used) + 1 (earned)
        assert res["freeze_count"] == 1
        print("   ✅ freeze consumed, streak survived (6 → 7)")

        # Without a freeze, a 2-day gap resets to 1
        broken = create_user_from_bot(db, telegram_id=600100202, telegram_handle="broken")
        onboard_user(db, broken, name="Broken User", interest_category="yoga",
                     exercise_frequency="daily")
        join_community(db, community.id, broken)
        broken.current_streak = 4
        broken.freeze_count = 0
        broken.last_checkin_at = datetime.now(timezone.utc) - timedelta(days=2)
        db.commit()
        res = checkin_community(db, community.id, broken)
        assert res["current_streak"] == 1
        assert res["freeze_used"] is False
        print("   ✅ no freeze → streak resets to 1")

        # === 4. Streaks at risk ===========================================
        print("\n4. Streaks-at-risk feed (bot evening nudge)")
        # 'atrisk' checked in yesterday with a live streak → at risk
        atrisk = create_user_from_bot(db, telegram_id=600100203, telegram_handle="atrisk")
        onboard_user(db, atrisk, name="At Risk", interest_category="gym",
                     exercise_frequency="regular")
        atrisk.current_streak = 3
        atrisk.freeze_count = 1
        atrisk.last_checkin_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()

        risky = get_streaks_at_risk(db)
        risky_ids = {u.telegram_id for u in risky}
        assert atrisk.telegram_id in risky_ids
        # users who checked in today are NOT at risk
        assert user.telegram_id not in risky_ids
        assert frozen.telegram_id not in risky_ids
        print("   ✅ yesterday-checked-in user flagged; today-checked-in excluded")

        # streak == 0 users are never at risk
        atrisk.current_streak = 0
        db.commit()
        assert atrisk.telegram_id not in {u.telegram_id for u in get_streaks_at_risk(db)}
        atrisk.current_streak = 3
        db.commit()
        print("   ✅ zero-streak users excluded")

        # === 5. Bot endpoint payload ======================================
        print("\n5. GET /api/bot/streaks-at-risk")
        from app.api.bot import streaks_at_risk
        payload = asyncio.run(streaks_at_risk(db=db, _=True))
        entry = next(u for u in payload["users"] if u["telegram_id"] == atrisk.telegram_id)
        assert entry["current_streak"] == 3
        assert entry["freeze_count"] == 1
        assert entry["name"] == "At Risk"
        print("   ✅ payload carries streak + freeze count")

        print("\n" + "=" * 50)
        print("  ALL ENGAGEMENT LOOP TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
