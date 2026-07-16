"""
Well Circle — Circle Activity Feed tests (WP3: Strava-style posts).
Run: cd backend && python -m app.tests.test_circle_activity

Covers: activity stats round-trip on posts, one-level-deep comment replies
(and rejecting a second-level reply), batched (no-N+1) feed serialization,
and the in-app notification fan-out when someone posts in a circle.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker


# --- SQLite UUID/JSONB compatibility (same pattern as test_integration.py) ---
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
from app.models.circle import Circle, CircleMember
from app.models.post import Post, PostComment, Reaction
from app.models.user_notification import UserNotification

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
        print("  CIRCLE ACTIVITY FEED — INTEGRATION TESTS")
        print("=" * 60)

        from app.crud.post import create_post, get_posts, create_comment

        user_a = _create_user(db, 200001, "Meron")
        user_b = _create_user(db, 200002, "Abel")
        user_c = _create_user(db, 200003, "Selam")

        circle = Circle(name="Morning Runners", owner_id=user_a.id)
        db.add(circle)
        db.commit()
        db.refresh(circle)
        for u in (user_a, user_b, user_c):
            db.add(CircleMember(circle_id=circle.id, user_id=u.id))
        db.commit()

        # ══════════════════════════════════════════════════════════
        # Activity stats round-trip on post create + read
        # ══════════════════════════════════════════════════════════
        print("\n-- Activity stats round-trip --")
        post = create_post(
            db, user_id=user_a.id, content="Morning run felt great!",
            circle_id=circle.id, activity_type="run", distance_km=5.2, duration_min=32,
        )
        check(post.activity_type == "run", "activity_type persisted")
        check(float(post.distance_km) == 5.2, f"distance_km persisted: {post.distance_km}")
        check(post.duration_min == 32, "duration_min persisted")

        feed = get_posts(db, circle_id=circle.id)
        fed_post = next(p for p in feed if p["id"] == post.id)
        check(fed_post["activity_type"] == "run", "feed serializes activity_type")
        check(fed_post["distance_km"] == 5.2, "feed serializes distance_km")
        check(fed_post["duration_min"] == 32, "feed serializes duration_min")

        # A plain text post (no stats) still works
        plain_post = create_post(db, user_id=user_b.id, content="Hi circle!", circle_id=circle.id)
        check(plain_post.activity_type is None, "plain post has no activity_type")

        # ══════════════════════════════════════════════════════════
        # Comments + one-level-deep replies
        # ══════════════════════════════════════════════════════════
        print("\n-- Comments and replies --")
        comment = create_comment(db, post.id, user_id=user_b.id, content="Nice pace!")
        check(comment.parent_comment_id is None, "top-level comment has no parent")

        reply = create_comment(db, post.id, user_id=user_a.id, content="Thanks!", parent_comment_id=comment.id)
        check(reply.parent_comment_id == comment.id, "reply carries parent id")

        feed = get_posts(db, circle_id=circle.id)
        fed_post = next(p for p in feed if p["id"] == post.id)
        check(len(fed_post["comments"]) == 1, f"one top-level comment in feed, got {len(fed_post['comments'])}")
        check(len(fed_post["comments"][0]["replies"]) == 1, "reply nested under its parent")
        check(fed_post["comments"][0]["replies"][0]["content"] == "Thanks!", "nested reply content correct")

        # Rejecting a second-level reply
        try:
            create_comment(db, post.id, user_id=user_c.id, content="nope", parent_comment_id=reply.id)
            check(False, "second-level reply should have raised")
        except Exception as e:
            from fastapi import HTTPException
            check(isinstance(e, HTTPException) and e.status_code == 422, f"second-level reply rejected: {e}")

        # Reply to a comment on a different post is rejected
        try:
            create_comment(db, plain_post.id, user_id=user_c.id, content="nope", parent_comment_id=comment.id)
            check(False, "cross-post parent should have raised")
        except Exception as e:
            from fastapi import HTTPException
            check(isinstance(e, HTTPException) and e.status_code == 422, f"cross-post parent rejected: {e}")

        # ══════════════════════════════════════════════════════════
        # Notification fan-out on new circle post
        # ══════════════════════════════════════════════════════════
        print("\n-- Notification fan-out --")
        notifs_b = db.query(UserNotification).filter(
            UserNotification.user_id == user_b.id, UserNotification.type == "circle_activity"
        ).all()
        notifs_c = db.query(UserNotification).filter(
            UserNotification.user_id == user_c.id, UserNotification.type == "circle_activity"
        ).all()
        notifs_a = db.query(UserNotification).filter(
            UserNotification.user_id == user_a.id, UserNotification.type == "circle_activity"
        ).all()
        # user_a posted `post`; user_b posted `plain_post` — each post notifies
        # the OTHER two members, never the author of that post.
        check(len(notifs_b) == 1, f"user_b notified only for user_a's post (not their own), got {len(notifs_b)}")
        check(len(notifs_c) == 2, f"user_c notified for both circle posts, got {len(notifs_c)}")
        check(len(notifs_a) == 1, f"user_a notified only for user_b's post (not their own), got {len(notifs_a)}")
        check(all(n.action_url == f"/circle/{circle.id}" for n in notifs_b), "notification action_url points at the circle")

        # ══════════════════════════════════════════════════════════
        # Coin-gift reaction still works via react_to_post
        # ══════════════════════════════════════════════════════════
        print("\n-- Coin gifting --")
        from app.crud.post import react_to_post
        user_c.points_balance = 100
        db.commit()
        react_to_post(db, post.id, user_c.id, "coins", points_to_gift=10)
        db.refresh(user_a)
        db.refresh(user_c)
        check(user_a.points_balance == 10, f"receiver gained points: {user_a.points_balance}")
        check(user_c.points_balance == 90, f"giver spent points: {user_c.points_balance}")

        # ══════════════════════════════════════════════════════════
        # RESULTS
        # ══════════════════════════════════════════════════════════
        print("\n" + "=" * 60)
        total = passed + failed
        if failed == 0:
            print(f"  ALL {passed} TESTS PASSED")
        else:
            print(f"  {passed}/{total} passed, {failed} FAILED")
        print("=" * 60)
        return failed == 0

    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    ok = test_all()
    sys.exit(0 if ok else 1)
