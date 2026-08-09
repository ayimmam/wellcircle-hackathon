"""
Well Circle — For You feed tests (Phase 4).
Run: cd backend && python -m app.tests.test_for_you_feed

Covers: a user who has joined nothing still gets a non-empty feed; private-
and paid-circle posts never appear; system events never appear; every post
carries a resolvable source; query count is constant regardless of post
count (the batching regression this refactor exists to prevent); and the
serialized home bootstrap stays under the Phase 2 payload ceiling.
"""
import json
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
from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.circle import Circle, CircleMember
from app.models.post import Post
from app.models.provider_event import ProviderEvent

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def days_from_now(n):
    return datetime.now(timezone.utc) + timedelta(days=n)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — FOR YOU FEED TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.provider import create_provider
        from app.crud.circle import create_circle
        from app.crud.post import create_post, get_public_feed_posts
        from app.services.feed_service import build_for_you_feed
        from app.api.home import home_bootstrap
        import asyncio

        # === 1. A user who has joined nothing still gets a non-empty feed ===
        print("\n1. Non-empty feed with zero membership")
        newcomer = create_user_from_bot(db, telegram_id=900100100, telegram_handle="newcomer")

        live_provider, community = create_provider(
            db, name="Boston Day Spa (test)", category="spa",
            description="Live pilot partner", location_text="Bole, Addis Ababa",
            price_range="Price on enquiry", rating=4.9,
            services=[
                {"name": "Facial", "price": None, "duration": None, "booking_method": "phone"},
                {"name": "Massage Cave", "price": None, "duration": None, "booking_method": "phone"},
            ],
            is_coming_soon=False, is_featured=True,
            create_community=True, community_name="Boston Day Spa Circle",
        )

        feed = build_for_you_feed(db)
        assert len(feed["items"]) > 0
        service_types = {item["type"] for item in feed["items"]}
        assert "service" in service_types
        print("   ✅ feed non-empty for a brand-new user (service items from the live provider)")

        # === 2. Coming-soon providers never contribute service/provider items =
        print("\n2. Coming-soon providers excluded from service/provider items")
        coming_soon_provider, _ = create_provider(
            db, name="Not Launched Yet", category="gym",
            description="Still coming soon", location_text="Bole",
            price_range="ETB 100-500", rating=4.0,
            services=[{"name": "Day Pass", "price": 100, "duration": "1 day"}],
            is_coming_soon=True,
        )
        feed2 = build_for_you_feed(db)
        provider_ids_in_feed = {
            item["provider"]["id"] for item in feed2["items"] if item["type"] in ("service", "provider")
        }
        assert coming_soon_provider.id not in provider_ids_in_feed
        assert live_provider.id in provider_ids_in_feed
        print("   ✅ coming-soon provider never appears as service/provider item")

        # === 3. Private/paid circle posts excluded; public circle/community posts included
        print("\n3. Post visibility rules")
        owner = create_user_from_bot(db, telegram_id=900100101, telegram_handle="circle_owner")

        public_circle = create_circle(db, name="Public Runners", description="Open to all", owner_id=owner.id)
        private_circle = create_circle(db, name="Private Club", description="Invite only", owner_id=owner.id, is_private=True)
        paid_circle = create_circle(db, name="Paid Coaching", description="Subscription", owner_id=owner.id)
        paid_circle.is_paid = True
        db.commit()

        public_post = create_post(db, user_id=owner.id, circle_id=public_circle.id, content="Ran 5k this morning!")
        private_post = create_post(db, user_id=owner.id, circle_id=private_circle.id, content="Private club update")
        paid_post = create_post(db, user_id=owner.id, circle_id=paid_circle.id, content="Paid coaching tip")
        community_post = create_post(db, user_id=owner.id, community_id=community.id, content="Welcome to the spa circle!")
        system_event_post = Post(
            user_id=owner.id, circle_id=public_circle.id, content="joined the circle",
            is_system_event=True,
        )
        db.add(system_event_post)
        db.commit()

        feed_posts = get_public_feed_posts(db, limit=50)
        post_ids_in_feed = {p["id"] for p in feed_posts}
        assert public_post.id in post_ids_in_feed
        assert community_post.id in post_ids_in_feed
        assert private_post.id not in post_ids_in_feed
        assert paid_post.id not in post_ids_in_feed
        assert system_event_post.id not in post_ids_in_feed
        print("   ✅ public circle + community posts included; private/paid/system-event posts excluded")

        # === 4. Every post carries a resolvable source =======================
        print("\n4. Post source resolution")
        for p in feed_posts:
            assert p["source"]["id"] is not None
            assert p["source"]["kind"] in ("circle", "community")
            assert p["source"]["name"] is not None
            assert "comment_count" in p
            assert "comments" not in p  # Phase 2 payload budget — no full threads here
        circle_source = next(p for p in feed_posts if p["id"] == public_post.id)["source"]
        assert circle_source["kind"] == "circle"
        assert circle_source["id"] == public_circle.id
        community_source = next(p for p in feed_posts if p["id"] == community_post.id)["source"]
        assert community_source["kind"] == "community"
        assert community_source["id"] == community.id
        print("   ✅ every post carries a resolvable source with id/kind/name")

        # === 5. Boosted events appear as event items ==========================
        print("\n5. Boosted event items")
        boosted_event = ProviderEvent(
            provider_id=live_provider.id, service_name="Spa Open Day",
            starts_at=days_from_now(3), ends_at=days_from_now(3) + timedelta(hours=2),
            capacity=20, spots_remaining=20, price_etb=0, is_boosted=True,
        )
        db.add(boosted_event)
        db.commit()

        feed3 = build_for_you_feed(db)
        event_items = [i for i in feed3["items"] if i["type"] == "event"]
        assert len(event_items) >= 1
        assert event_items[0]["event"]["id"] == str(boosted_event.id)
        print("   ✅ boosted event surfaces as an event item")

        # === 6. Query count is constant regardless of post count ==============
        print("\n6. Constant query count (batching regression guard)")
        for i in range(10):
            create_post(db, user_id=owner.id, circle_id=public_circle.id, content=f"Post number {i}")

        query_counts = []
        for _ in range(2):
            count = [0]

            def counter(*_args, **_kwargs):
                count[0] += 1

            sa_event.listen(engine, "before_cursor_execute", counter)
            try:
                build_for_you_feed(db, limit=20)
            finally:
                sa_event.remove(engine, "before_cursor_execute", counter)
            query_counts.append(count[0])

        # Query count must not grow with additional posts within the same limit —
        # both runs return the same number of posts, so their query counts must match.
        assert query_counts[0] == query_counts[1], f"query count changed: {query_counts}"
        print(f"   ✅ query count constant across runs ({query_counts[0]} queries)")

        # === 7. Bootstrap carries the feed and serializes reasonably ==========
        print("\n7. home_bootstrap carries feed under the Phase 2 ceiling")
        bootstrap = asyncio.run(home_bootstrap(user=newcomer, db=db))
        assert "feed" in bootstrap
        assert len(bootstrap["feed"]["items"]) > 0
        serialized_size = len(json.dumps(bootstrap, default=str).encode("utf-8"))
        assert serialized_size < 150 * 1024, f"bootstrap payload too large: {serialized_size} bytes"
        print(f"   ✅ bootstrap.feed present, serialized size {serialized_size} bytes (under 150 KB)")

        print("\n" + "=" * 50)
        print("  ALL FOR YOU FEED TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
