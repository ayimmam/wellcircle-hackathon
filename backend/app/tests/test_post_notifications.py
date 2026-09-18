"""
Well Circle — Post Notifications Tests.
Covers:
1. Post like / reaction creates in-app notification for post author (self-like ignored).
2. Post comment creates notification for author; comment reply notifies parent comment author.
3. Post share creates notification for author (self-share ignored).
4. Creating a post sends follower_post notifications to all author's followers.
5. PUSH_WORTHY_TYPES includes post_liked, post_comment, post_shared, follower_post.
"""
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
    cache_ok = True
    def __init__(self, *args, **kwargs):
        super().__init__()

class PatchedJSONB(SQLiteJSONB):
    cache_ok = True
    def __init__(self, *args, **kwargs):
        super().__init__()

pg.UUID = PatchedUUID
pg.JSONB = PatchedJSONB

from app.database import Base
from app.models.user import User
from app.models.follower import Follower
from app.models.post import Post, Reaction, PostComment
from app.models.user_notification import UserNotification
from app.crud.post import (
    create_post, toggle_reaction, react_to_post, create_comment, share_post,
)
from app.api.bot import PUSH_WORTHY_TYPES

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def make_user(db, telegram_id, name):
    u = User(telegram_id=telegram_id, telegram_handle=f"user_{telegram_id}", name=name, points_balance=100)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_post_notifications():
    db = TestSession()
    try:
        alice = make_user(db, 910001, "Alice")
        bob = make_user(db, 910002, "Bob")
        charlie = make_user(db, 910003, "Charlie")
        david = make_user(db, 910004, "David")

        # Bob and Charlie follow Alice
        db.add(Follower(follower_id=bob.id, following_id=alice.id))
        db.add(Follower(follower_id=charlie.id, following_id=alice.id))
        db.commit()

        # 1. Follower notifications on new post
        post = create_post(db, user_id=alice.id, content="Morning run along the lake!", activity_type="run", distance_km=5.2)

        bob_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == bob.id,
            UserNotification.type == "follower_post",
        ).all()
        assert len(bob_notifs) == 1
        assert "Alice" in bob_notifs[0].title
        assert bob_notifs[0].actor_user_id == alice.id

        charlie_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == charlie.id,
            UserNotification.type == "follower_post",
        ).all()
        assert len(charlie_notifs) == 1

        david_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == david.id,
            UserNotification.type == "follower_post",
        ).all()
        assert len(david_notifs) == 0

        # Alice should not receive a follower notification for her own post
        alice_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "follower_post",
        ).all()
        assert len(alice_notifs) == 0

        # 2. Like / Reaction notifications
        # Bob reacts to Alice's post
        toggle_reaction(db, post.id, bob.id, "🔥")
        alice_like_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_liked",
        ).all()
        assert len(alice_like_notifs) == 1
        assert "Bob" in alice_like_notifs[0].title
        assert alice_like_notifs[0].actor_user_id == bob.id

        # Alice self-reacts -> no self notification
        toggle_reaction(db, post.id, alice.id, "💪")
        alice_like_notifs_after_self = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_liked",
        ).all()
        assert len(alice_like_notifs_after_self) == 1

        # 3. Comment notifications
        # Bob comments on Alice's post
        c1 = create_comment(db, post.id, bob.id, "Great run Alice!")
        alice_comment_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_comment",
        ).all()
        assert len(alice_comment_notifs) == 1
        assert "Bob" in alice_comment_notifs[0].title

        # Charlie replies to Bob's comment
        create_comment(db, post.id, charlie.id, "Crushing it!", parent_comment_id=c1.id)
        # Alice (post author) gets notified
        alice_comment_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_comment",
        ).all()
        assert len(alice_comment_notifs) == 2

        # Bob (parent comment author) gets notified
        bob_comment_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == bob.id,
            UserNotification.type == "post_comment",
        ).all()
        assert len(bob_comment_notifs) == 1
        assert "Charlie" in bob_comment_notifs[0].title

        # 4. Share notifications
        share_post(db, post.id, david.id)
        alice_share_notifs = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_shared",
        ).all()
        assert len(alice_share_notifs) == 1
        assert "David" in alice_share_notifs[0].title
        assert alice_share_notifs[0].actor_user_id == david.id

        # Alice self-share -> no self notification
        share_post(db, post.id, alice.id)
        alice_share_notifs_after = db.query(UserNotification).filter(
            UserNotification.user_id == alice.id,
            UserNotification.type == "post_shared",
        ).all()
        assert len(alice_share_notifs_after) == 1

        # 5. Push-worthy types
        assert "post_liked" in PUSH_WORTHY_TYPES
        assert "post_comment" in PUSH_WORTHY_TYPES
        assert "post_shared" in PUSH_WORTHY_TYPES
        assert "follower_post" in PUSH_WORTHY_TYPES

        print("All post notification tests passed!")
    finally:
        db.close()


if __name__ == "__main__":
    test_post_notifications()
