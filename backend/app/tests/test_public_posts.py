"""
Well Circle — standalone (public, non-circle) posts tests (Phase 23, WS2).
Run: cd backend && python -m app.tests.test_public_posts

Covers: a post created with neither community_id nor circle_id is valid and
appears in the public feed with source=None; private/paid circle posts stay
excluded (regression); the daily points cap (+10, 3/day) is shared across
standalone and circle posts; a system event post earns nothing; feed query
count stays constant with standalone posts mixed in.
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
from app.models.circle import Circle, CircleMember
from app.models.post import Post
from app.crud.post import create_post, get_public_feed_posts
from app.services.points import TXN_POST, POINTS_POST, POST_POINTS_DAILY_CAP, award_capped

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def make_user(db, telegram_id, name):
    u = User(telegram_id=telegram_id, telegram_handle=f"user{telegram_id}", name=name, points_balance=0)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — STANDALONE POSTS TESTS")
        print("=" * 50)

        alice = make_user(db, 800001, "Alice")

        # === 1. A standalone post is valid and appears in the feed =========
        print("\n1. Standalone post creation + feed visibility")
        post = create_post(db, user_id=alice.id, content="Just a thought, no circle attached")
        assert post.community_id is None and post.circle_id is None
        items = get_public_feed_posts(db)
        item = next(i for i in items if i["id"] == post.id)
        assert item["source"] is None, f"expected source=None, got {item['source']}"
        assert item["user"]["id"] == alice.id
        print("   ✅ a standalone post is created and appears with source=None")

        # === 2. Private/paid circle posts stay excluded (regression) ========
        print("\n2. Private/paid circle exclusion (regression)")
        owner = make_user(db, 800002, "Owner")
        private_circle = Circle(name="Secret Circle", owner_id=owner.id, is_private=True, is_paid=False)
        paid_circle = Circle(name="Paid Circle", owner_id=owner.id, is_private=False, is_paid=True)
        db.add_all([private_circle, paid_circle])
        db.commit()
        db.refresh(private_circle)
        db.refresh(paid_circle)
        db.add_all([
            CircleMember(circle_id=private_circle.id, user_id=owner.id),
            CircleMember(circle_id=paid_circle.id, user_id=owner.id),
        ])
        db.commit()

        private_post = create_post(db, user_id=owner.id, content="private stuff", circle_id=private_circle.id)
        paid_post = create_post(db, user_id=owner.id, content="paid stuff", circle_id=paid_circle.id)
        items2 = get_public_feed_posts(db, limit=50)
        ids2 = {i["id"] for i in items2}
        assert private_post.id not in ids2
        assert paid_post.id not in ids2
        assert post.id in ids2, "the standalone post from step 1 should still be there"
        print("   ✅ private and paid circle posts stay excluded; standalone posts unaffected")

        # === 3. Daily points cap shared across standalone + circle posts ====
        print("\n3. Points cap")
        bob = make_user(db, 800003, "Bob")
        public_circle = Circle(name="Open Circle", owner_id=bob.id, is_private=False, is_paid=False)
        db.add(public_circle)
        db.commit()
        db.refresh(public_circle)

        awarded = []
        for i in range(4):
            p = create_post(db, user_id=bob.id, content=f"post {i}", circle_id=public_circle.id if i % 2 else None)
            awarded.append(award_capped(db, bob, TXN_POST, POINTS_POST, POST_POINTS_DAILY_CAP, reference_id=p.id))
            db.commit()
            db.refresh(bob)
        assert awarded == [POINTS_POST, POINTS_POST, POINTS_POST, 0], awarded
        assert bob.points_balance == POINTS_POST * POST_POINTS_DAILY_CAP
        print(f"   ✅ posts 1–{POST_POINTS_DAILY_CAP} award +{POINTS_POST} each, the {POST_POINTS_DAILY_CAP + 1}th awards 0")
        print("   ✅ the cap is shared between standalone and circle posts")

        # === 4. A system event post earns nothing (never even attempted) ====
        print("\n4. System events")
        carol = make_user(db, 800004, "Carol")
        sys_post = Post(user_id=carol.id, content="joined the circle", is_system_event=True)
        db.add(sys_post)
        db.commit()
        feed_items = get_public_feed_posts(db, limit=50)
        assert all(i["id"] != sys_post.id for i in feed_items), "system events must never reach the public feed"
        print("   ✅ a system event post never appears in the public feed")

        # === 5. Feed query count stays constant with standalone posts mixed in
        print("\n5. Query count with standalone posts mixed in")
        for i in range(15):
            create_post(db, user_id=alice.id, content=f"bulk standalone {i}")

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

        db_a = TestSession()
        db_b = TestSession()
        try:
            n_a = count_queries(lambda: get_public_feed_posts(db_a, limit=50))
        finally:
            db_a.close()

        for i in range(15):
            create_post(db, user_id=alice.id, content=f"bulk standalone round2 {i}")

        try:
            n_b = count_queries(lambda: get_public_feed_posts(db_b, limit=50))
        finally:
            db_b.close()

        assert n_a == n_b, f"query count should stay constant: {n_a} vs {n_b}"
        print(f"   ✅ feed query count constant with standalone posts mixed in ({n_a} queries)")

        print("\n" + "=" * 50)
        print("  ALL STANDALONE POSTS TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
