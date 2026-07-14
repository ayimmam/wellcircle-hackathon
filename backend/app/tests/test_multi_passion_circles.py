"""
Well Circle — Multi-passion onboarding + circle creation tests.
Run: cd backend && python -m app.tests.test_multi_passion_circles

Covers: onboarding with multiple interests, community suggestions matching
ANY selected interest, admin analytics/product personalization across
multi-value interests, and circle creation with auto-generated join codes.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone

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
from app.models.circle import Circle, CircleMember
from app.models.product import Product
from app.models.user_redemption import UserRedemption

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — MULTI-PASSION + CIRCLES TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot, onboard_user
        from app.crud.provider import create_provider
        from app.crud.community import get_suggested_communities, join_community
        from app.crud.circle import create_circle, join_circle, get_circles, _generate_join_code
        from app.crud.product import browse_products, create_product

        # === 1. Onboarding with multiple interests ==========================
        print("\n1. Multi-interest onboarding")
        user = create_user_from_bot(db, telegram_id=900100200, telegram_handle="multi_passion")
        onboard_user(db, user, name="Multi Passion", interest_categories=["yoga", "gym", "nutrition"],
                     exercise_frequency="regular")
        assert user.interest_categories == ["yoga", "gym", "nutrition"]
        print("   ✅ interest_categories stores all selected passions")

        # === 2. Suggested communities match ANY selected interest ==========
        print("\n2. get_suggested_communities — OR match across interests")
        yoga_provider, yoga_comm = create_provider(
            db, name="Zen Studio", category="yoga", description="Yoga",
            location_text="Bole", price_range="ETB 300-800", rating=4.5,
            create_community=True, community_name="Zen Yogis",
        )
        gym_provider, gym_comm = create_provider(
            db, name="Iron Gym", category="gym", description="Gym",
            location_text="Kazanchis", price_range="ETB 300-800", rating=4.2,
            create_community=True, community_name="Iron Lifters",
        )
        running_provider, running_comm = create_provider(
            db, name="Trail Runners", category="running", description="Running",
            location_text="Piassa", price_range="ETB 100-500", rating=4.0,
            create_community=True, community_name="Trail Club",
        )

        suggestions = get_suggested_communities(db, ["yoga", "gym", "nutrition"], user.id)
        suggested_names = {s["name"] for s in suggestions}
        assert "Zen Yogis" in suggested_names
        assert "Iron Lifters" in suggested_names
        assert "Trail Club" not in suggested_names  # running wasn't selected
        print("   ✅ suggests communities matching any of the 3 interests, excludes non-matches")

        # Already-joined communities are excluded even if they match
        join_community(db, yoga_comm.id, user)
        suggestions_after_join = get_suggested_communities(db, ["yoga", "gym", "nutrition"], user.id)
        assert "Zen Yogis" not in {s["name"] for s in suggestions_after_join}
        assert "Iron Lifters" in {s["name"] for s in suggestions_after_join}
        print("   ✅ excludes communities already joined")

        # === 3. Product personalization across multiple interests ==========
        print("\n3. Product 'recommended for you' across multiple interests")
        create_product(db, gym_provider.id, name="Gym Voucher", type="digital",
                       price_etb=50, quantity_in_stock=5)
        create_product(db, running_provider.id, name="Running Voucher", type="digital",
                       price_etb=30, quantity_in_stock=5)
        items, _ = browse_products(db, user_interests=["yoga", "gym", "nutrition"])
        by_name = {i["name"]: i for i in items}
        assert by_name["Gym Voucher"]["is_recommended"] is True
        assert by_name["Running Voucher"]["is_recommended"] is False
        print("   ✅ gym product recommended (interest match), running product not")

        # === 4. Admin analytics — each interest counts in its own bucket ===
        print("\n4. Admin analytics multi-interest grouping")
        from collections import Counter
        all_interests = (
            db.query(User.interest_categories)
            .filter(User.interest_categories.isnot(None))
            .all()
        )
        counts = Counter()
        for (categories,) in all_interests:
            counts.update(categories or [])
        assert counts["yoga"] >= 1
        assert counts["gym"] >= 1
        assert counts["nutrition"] >= 1
        print("   ✅ user with 3 interests contributes to 3 separate buckets")

        # === 5. Circle creation with auto-generated join_code ===============
        print("\n5. Circle creation — auto join_code")
        circle = create_circle(db, name="Morning Yogis", description=None, owner_id=user.id)
        assert circle.join_code is not None
        assert len(circle.join_code) == 8
        print(f"   ✅ auto-generated join_code: {circle.join_code}")

        # Owner is auto-added as a member
        membership = db.query(CircleMember).filter(
            CircleMember.circle_id == circle.id, CircleMember.user_id == user.id
        ).first()
        assert membership is not None
        print("   ✅ creator auto-added as a circle member")

        # Explicit join_code is respected, not overwritten
        circle2 = create_circle(db, name="Explicit Code Circle", description=None,
                                owner_id=user.id, join_code="MYCODE01")
        assert circle2.join_code == "MYCODE01"
        print("   ✅ explicit join_code is preserved, not regenerated")

        # Uniqueness: generated codes never collide (spot check)
        codes = {create_circle(db, name=f"Circle {i}", description=None, owner_id=user.id).join_code
                 for i in range(5)}
        assert len(codes) == 5
        print("   ✅ 5 auto-generated codes are all unique")

        # === 6. Join a circle, join_code exposed to the new member ==========
        print("\n6. Joining an existing circle exposes its join_code")
        other_user = create_user_from_bot(db, telegram_id=900100201, telegram_handle="joiner")
        joined_circle = join_circle(db, circle.id, other_user.id)
        assert joined_circle is not None
        circles_list = get_circles(db, user_id=other_user.id)
        entry = next(c for c in circles_list if c["id"] == circle.id)
        assert entry["is_joined"] is True
        assert entry["join_code"] == circle.join_code
        print("   ✅ join_code visible to a member after joining")

        # Non-members don't see the join_code
        stranger = create_user_from_bot(db, telegram_id=900100202, telegram_handle="stranger")
        circles_list2 = get_circles(db, user_id=stranger.id)
        entry2 = next(c for c in circles_list2 if c["id"] == circle.id)
        assert entry2["is_joined"] is False
        assert entry2["join_code"] is None
        print("   ✅ join_code hidden from non-members")

        print("\n" + "=" * 50)
        print("  ALL MULTI-PASSION + CIRCLES TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
