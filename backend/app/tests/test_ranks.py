"""
Well Circle — Ranks (weekly leaderboard) tests (V2 UX Phase 5.1).
Run: cd backend && python -m app.tests.test_ranks

Covers: 7-day window inclusion/exclusion, user + community ordering,
community sum = sum of its members, and "me" rank correctness.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker


# --- SQLite UUID/JSONB compatibility (same pattern as test_circle_activity.py) ---
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
from app.models.point_transaction import PointTransaction
from app.models.community import Community, CommunityMember
from app.models.provider import Provider
from app.crud import ranks as ranks_crud

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def _create_user(db, telegram_id, name):
    from app.crud.user import create_user_from_bot
    user = create_user_from_bot(db, telegram_id=telegram_id)
    user.name = name
    user.is_onboarded = True
    db.commit()
    db.refresh(user)
    return user


def _add_points(db, user_id, amount, days_ago=0):
    db.add(PointTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        amount=amount,
        type="checkin",
        created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
    ))
    db.commit()


def test_all():
    db = TestSession()
    passed = 0
    failed = 0

    def check(condition, label):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"   PASS: {label}")
        else:
            failed += 1
            print(f"   FAIL: {label}")

    try:
        print("=" * 60)
        print("  RANKS (WEEKLY LEADERBOARD) — INTEGRATION TESTS")
        print("=" * 60)

        u1 = _create_user(db, 111, "Alice")
        u2 = _create_user(db, 222, "Bob")
        u3 = _create_user(db, 333, "Carol")

        provider = Provider(id=uuid.uuid4(), name="Test Provider", category="gym", owner_user_id=u1.id)
        db.add(provider)
        db.commit()

        c1 = Community(id=uuid.uuid4(), provider_id=provider.id, name="Yoga Circle", member_count=2)
        c2 = Community(id=uuid.uuid4(), provider_id=provider.id, name="Gym Circle", member_count=1)
        db.add_all([c1, c2])
        db.commit()

        db.add_all([
            CommunityMember(community_id=c1.id, user_id=u1.id),
            CommunityMember(community_id=c1.id, user_id=u2.id),
            CommunityMember(community_id=c2.id, user_id=u3.id),
        ])
        db.commit()

        # Within the 7-day window
        _add_points(db, u1.id, 100, days_ago=1)
        _add_points(db, u2.id, 50, days_ago=2)
        _add_points(db, u3.id, 30, days_ago=6)
        # Negative amounts must not count toward weekly points
        _add_points(db, u1.id, -20, days_ago=1)
        # Outside the 7-day window — must be excluded
        _add_points(db, u1.id, 500, days_ago=10)

        users = ranks_crud.get_top_users(db)
        check(len(users) == 3, "get_top_users returns all 3 users who earned points")
        check(users[0]["user_id"] == str(u1.id) and users[0]["weekly_points"] == 100,
              "Alice ranks #1 with 100 weekly points (old 500 excluded, -20 reversal counted)")
        check(users[1]["user_id"] == str(u2.id) and users[1]["weekly_points"] == 50,
              "Bob ranks #2 with 50 weekly points")
        check(users[2]["rank"] == 3, "Carol ranks #3")

        communities = ranks_crud.get_top_communities(db)
        yoga = next((c for c in communities if c["community_id"] == str(c1.id)), None)
        gym = next((c for c in communities if c["community_id"] == str(c2.id)), None)
        check(yoga is not None and yoga["weekly_points"] == 150,
              "Yoga Circle weekly_points = sum of its members (100 + 50)")
        check(gym is not None and gym["weekly_points"] == 30,
              "Gym Circle weekly_points = its lone member's 30")
        check(communities[0]["community_id"] == str(c1.id), "Yoga Circle ranks #1 (higher sum)")
        check(yoga["member_count"] == 2, "Yoga Circle member_count passed through from denormalized column")

        me_alice = ranks_crud.get_my_rank(db, u1.id)
        check(me_alice["rank"] == 1 and me_alice["weekly_points"] == 100, "Alice's own rank is #1, 100 pts")

        u4 = _create_user(db, 444, "Dave")
        me_dave = ranks_crud.get_my_rank(db, u4.id)
        check(me_dave["rank"] is None and me_dave["weekly_points"] == 0,
              "Dave earned 0 this week — rank is null, not 0 or last place")

        # === League bucketing (small groups, not one global list) =========
        league_alice = ranks_crud.get_my_league(db, u1.id)
        # Only Alice, Bob, and Carol earned points this week — Dave (0 pts)
        # isn't part of anyone else's population, only his own league below.
        check(len(league_alice) == 3, "League includes everyone when population < LEAGUE_SIZE (3 earners)")
        check(any(e["is_me"] and e["user_id"] == str(u1.id) for e in league_alice),
              "Alice is flagged is_me in her own league")
        check(league_alice[0]["weekly_points"] >= league_alice[-1]["weekly_points"],
              "League entries are ordered by weekly points, descending")

        league_dave = ranks_crud.get_my_league(db, u4.id)
        dave_entry = next(e for e in league_dave if e["is_me"])
        check(dave_entry["weekly_points"] == 0, "Dave (0 pts) still gets a league — never excluded outright")

        # Many users spread across a wide points range: Alice's league should
        # be a bounded window near her own score, not the whole population.
        many_users = [_create_user(db, 1000 + i, f"Bulk{i}") for i in range(40)]
        for i, u in enumerate(many_users):
            _add_points(db, u.id, i * 10, days_ago=1)  # 0..390, spread wide
        league_alice_2 = ranks_crud.get_my_league(db, u1.id)
        check(len(league_alice_2) == ranks_crud.LEAGUE_SIZE,
              f"League caps at LEAGUE_SIZE ({ranks_crud.LEAGUE_SIZE}) once the population is large")
        check(any(e["is_me"] and e["user_id"] == str(u1.id) for e in league_alice_2),
              "Alice still appears in her own bucket after the population grows")

        print("=" * 60)
        print(f"  RESULTS: {passed} passed, {failed} failed")
        print("=" * 60)
        return failed == 0
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    success = test_all()
    sys.exit(0 if success else 1)
