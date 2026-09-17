"""
Well Circle — public stories tests (Phase 23, WS1).
Run: cd backend && python -m app.tests.test_public_stories

Covers: any authenticated user sees any other user's active story (no
membership needed); expired/soft-deleted stories are excluded; rail
ordering (own -> followed+unseen -> unseen -> seen) and is_following;
constant query count for the rail; the daily point cap via award_capped();
the active-story cap; view receipts; delete permissions.
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator, event as sa_event
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
            import json as _json
            return _json.dumps(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            import json as _json
            try:
                return _json.loads(value)
            except (_json.JSONDecodeError, TypeError):
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
from app.models.follower import Follower
from app.models.story import Story, StoryView
import app.crud.story as story_crud
from app.services.points import (
    TXN_STORY, POINTS_STORY, STORY_POINTS_DAILY_CAP, award_capped,
)

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def make_user(db, telegram_id, name):
    u = User(telegram_id=telegram_id, telegram_handle=f"user{telegram_id}", name=name, points_balance=0)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def make_story(db, user, minutes_ago=0, expires_in_hours=72):
    now = datetime.now(timezone.utc)
    s = Story(
        user_id=user.id,
        image_url="https://example.com/a.jpg",
        image_public_id="wellcircle/stories/a",
        created_at=now - timedelta(minutes=minutes_ago),
        expires_at=now + timedelta(hours=expires_in_hours) - timedelta(minutes=minutes_ago),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — PUBLIC STORIES TESTS")
        print("=" * 50)

        alice = make_user(db, 900001, "Alice")
        bob = make_user(db, 900002, "Bob")
        carol = make_user(db, 900003, "Carol")

        # === 1. Any user sees any other user's story — no membership ========
        print("\n1. Public visibility")
        bob_story = make_story(db, bob)
        rail = story_crud.get_story_rail(db, alice.id)
        assert any(g["user_id"] == str(bob.id) for g in rail), "Alice should see Bob's story"
        print("   ✅ a user with no relationship to the author sees the story")

        # === 2. Expired and soft-deleted are excluded ========================
        print("\n2. Expired / deleted exclusion")
        expired = make_story(db, carol, minutes_ago=200 * 60)  # way past 72h
        deleted = make_story(db, carol)
        deleted.deleted_at = datetime.now(timezone.utc)
        db.commit()
        rail2 = story_crud.get_story_rail(db, alice.id)
        carol_group = next((g for g in rail2 if g["user_id"] == str(carol.id)), None)
        assert carol_group is None, "Carol has no active stories, should not appear"
        print("   ✅ expired and soft-deleted stories are excluded")

        # === 3. Rail order: own -> followed+unseen -> unseen -> seen ========
        print("\n3. Rail ordering")
        # Alice follows Bob. Dave posts too but Alice doesn't follow him.
        dave = make_user(db, 900004, "Dave")
        make_story(db, dave)
        alice_story = make_story(db, alice)
        db.add(Follower(follower_id=alice.id, following_id=bob.id))
        db.commit()

        rail3 = story_crud.get_story_rail(db, alice.id)
        order = [g["user_id"] for g in rail3]
        assert order[0] == str(alice.id), f"own group should be first, got {order}"
        assert order.index(str(bob.id)) < order.index(str(dave.id)), \
            "followed author should rank ahead of a stranger"
        bob_group = next(g for g in rail3 if g["user_id"] == str(bob.id))
        assert bob_group["is_following"] is True
        dave_group = next(g for g in rail3 if g["user_id"] == str(dave.id))
        assert dave_group["is_following"] is False
        print("   ✅ own group first, followed+unseen ranks ahead of unseen strangers")
        print("   ✅ is_following is correct per group")

        # Now mark Bob's story seen — Bob should drop behind an unseen Dave.
        story_crud.mark_story_viewed(db, bob_story.id, alice.id)
        rail4 = story_crud.get_story_rail(db, alice.id)
        order4 = [g["user_id"] for g in rail4]
        assert order4.index(str(dave.id)) < order4.index(str(bob.id)), \
            "an unseen stranger should now rank ahead of a seen followed author"
        print("   ✅ seen groups sink behind unseen ones, even across follow status")

        # === 4. Rail query count is constant regardless of author count =====
        print("\n4. Query count")
        for i in range(20):
            u = make_user(db, 910000 + i, f"Bulk{i}")
            make_story(db, u)

        def count_queries(fn):
            counter = {"n": 0}
            def on_execute(*a, **kw):
                counter["n"] += 1
            sa_event.listen(engine, "before_cursor_execute", on_execute)
            try:
                fn()
            finally:
                sa_event.remove(engine, "before_cursor_execute", on_execute)
            return counter["n"]

        small_db = TestSession()
        big_db = TestSession()
        try:
            n_small = count_queries(lambda: story_crud.get_story_rail(small_db, alice.id))
        finally:
            small_db.close()

        for i in range(20):
            u = make_user(db, 920000 + i, f"Bulk2_{i}")
            make_story(db, u)

        try:
            n_big = count_queries(lambda: story_crud.get_story_rail(big_db, alice.id))
        finally:
            big_db.close()

        assert n_big == n_small, f"query count should be constant: {n_small} vs {n_big}"
        print(f"   ✅ rail query count constant regardless of author count ({n_small} queries)")

        # === 5. Daily point cap via award_capped() ============================
        print("\n5. Points cap")
        eve = make_user(db, 900005, "Eve")
        awarded1 = award_capped(db, eve, TXN_STORY, POINTS_STORY, STORY_POINTS_DAILY_CAP)
        db.commit()
        db.refresh(eve)
        assert awarded1 == POINTS_STORY
        assert eve.points_balance == POINTS_STORY
        print(f"   ✅ first story of the day awards +{POINTS_STORY}")

        awarded2 = award_capped(db, eve, TXN_STORY, POINTS_STORY, STORY_POINTS_DAILY_CAP)
        db.commit()
        db.refresh(eve)
        assert awarded2 == 0
        assert eve.points_balance == POINTS_STORY, "balance must not change on a capped award"
        print("   ✅ a second story the same day awards 0")

        # A story from "yesterday" doesn't count toward today's cap.
        from app.models.point_transaction import PointTransaction
        yesterday_txn = db.query(PointTransaction).filter_by(user_id=eve.id, type=TXN_STORY).first()
        yesterday_txn.created_at = datetime.now(timezone.utc) - timedelta(days=1, hours=1)
        db.commit()
        awarded3 = award_capped(db, eve, TXN_STORY, POINTS_STORY, STORY_POINTS_DAILY_CAP)
        db.commit()
        db.refresh(eve)
        assert awarded3 == POINTS_STORY, "a new UTC day should reset the cap"
        print("   ✅ the cap resets on a new UTC day")

        # === 6. Active-story cap ==============================================
        print("\n6. Active-story cap")
        frank = make_user(db, 900006, "Frank")
        for _ in range(story_crud.MAX_ACTIVE_STORIES_PER_USER):
            story_crud.create_story(db, frank, "https://example.com/x.jpg", "pub-id")
        try:
            story_crud.create_story(db, frank, "https://example.com/x.jpg", "pub-id")
            assert False, "expected ValueError at the active-story cap"
        except ValueError:
            pass
        print(f"   ✅ create_story raises past {story_crud.MAX_ACTIVE_STORIES_PER_USER} active stories")

        # === 7. View receipts =================================================
        print("\n7. View receipts")
        grace = make_user(db, 900007, "Grace")
        g_story = story_crud.create_story(db, grace, "https://example.com/g.jpg", "pub-g")
        c1 = story_crud.mark_story_viewed(db, g_story.id, alice.id)
        c2 = story_crud.mark_story_viewed(db, g_story.id, alice.id)  # idempotent
        assert c1 == c2 == 1
        rail_grace_self = story_crud.get_story_rail(db, grace.id)
        grace_group = next(g for g in rail_grace_self if g["user_id"] == str(grace.id))
        assert grace_group["stories"][0]["view_count"] == 1
        rail_grace_other = story_crud.get_story_rail(db, bob.id)
        grace_group_other = next(g for g in rail_grace_other if g["user_id"] == str(grace.id))
        assert grace_group_other["stories"][0]["view_count"] is None, \
            "a non-author must not see the view count"
        print("   ✅ view receipt is idempotent; view_count is author-only")

        # === 8. Delete permissions ============================================
        print("\n8. Delete permissions")
        h_story = story_crud.create_story(db, grace, "https://example.com/h.jpg", "pub-h")
        try:
            story_crud.delete_story(db, h_story.id, alice.id)
            assert False, "a non-author should not be able to delete"
        except PermissionError:
            pass
        story_crud.delete_story(db, h_story.id, grace.id)
        assert db.query(Story).filter_by(id=h_story.id).first().deleted_at is not None
        print("   ✅ non-author delete forbidden; author delete succeeds")

        print("\n" + "=" * 50)
        print("  ALL PUBLIC STORIES TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
