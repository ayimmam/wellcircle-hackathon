"""
Well Circle — leave/delete circle tests (Phase 23, WS8).
Run: cd backend && python -m app.tests.test_circle_leave_delete

Covers: a member leaving just drops their membership; an owner leaving with
other members transfers ownership to the earliest joiner; an owner leaving
as the sole member soft-deletes the circle; an owner can't transfer a paid
circle's ownership (409); leaving as a non-member 404s; delete is owner-only
(403) and blocked by an active subscription (409) but allowed once it's
merely expired; a deleted circle disappears from every read path (list,
detail, join-by-code, public feed posts, social proof); members get a
batched `circle_deleted` notification; and a super admin can restore a
deleted circle.
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
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
from app.models.circle_subscription import CircleSubscription
from app.models.user_notification import UserNotification
from app.crud.circle import (
    create_circle, join_circle, get_circles, get_circle_detail,
    join_circle_by_code, get_circle_social_proof, leave_circle, delete_circle,
    restore_circle,
)
from app.crud.post import create_post, get_public_feed_posts

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
        print("  WELL CIRCLE — LEAVE/DELETE CIRCLE TESTS")
        print("=" * 50)

        # === 1. Member leaves — membership gone, circle unchanged =========
        print("\n1. Member leave")
        owner = make_user(db, 800100001, "Owner")
        member = make_user(db, 800100002, "Member")
        circle = create_circle(db, name="Runners", description="Morning runs", owner_id=owner.id)
        join_circle(db, circle.id, member.id)

        result = leave_circle(db, circle.id, member.id)
        assert result == {"left": True}
        assert db.query(CircleMember).filter(
            CircleMember.circle_id == circle.id, CircleMember.user_id == member.id
        ).first() is None
        db.refresh(circle)
        assert circle.deleted_at is None
        assert circle.owner_id == owner.id
        print("   ✅ member leaves; membership gone, circle unchanged")

        # === 2. Owner leaves with other members — ownership transfers =====
        print("\n2. Owner leave with other members — ownership transfer")
        m1 = make_user(db, 800100003, "Early Joiner")
        m2 = make_user(db, 800100004, "Late Joiner")
        join_circle(db, circle.id, m1.id)
        join_circle(db, circle.id, m2.id)
        # Force a deterministic join order — SQLite's default() timestamps
        # can tie within the same test process.
        db.query(CircleMember).filter(
            CircleMember.circle_id == circle.id, CircleMember.user_id == m1.id
        ).update({CircleMember.joined_at: datetime.now(timezone.utc) - timedelta(minutes=5)})
        db.commit()

        result = leave_circle(db, circle.id, owner.id)
        assert result["left"] is True
        assert result["new_owner_id"] == m1.id
        db.refresh(circle)
        assert circle.owner_id == m1.id
        assert db.query(CircleMember).filter(
            CircleMember.circle_id == circle.id, CircleMember.user_id == owner.id
        ).first() is None
        print("   ✅ owner leaves; earliest-joined remaining member becomes owner")

        # === 3. Owner leaves as sole member — circle soft-deleted =========
        print("\n3. Owner leave as sole member — soft delete")
        solo_owner = make_user(db, 800100005, "Solo Owner")
        solo_circle = create_circle(db, name="Solo Circle", description="Just me", owner_id=solo_owner.id)
        result = leave_circle(db, solo_circle.id, solo_owner.id)
        assert result == {"left": True, "deleted": True}
        db.refresh(solo_circle)
        assert solo_circle.deleted_at is not None
        print("   ✅ sole-member owner leaving soft-deletes the circle")

        # === 4. Owner leaving a paid circle with other members — 409 ======
        print("\n4. Owner leave, paid circle — 409")
        paid_owner = make_user(db, 800100006, "Paid Owner")
        paid_member = make_user(db, 800100007, "Paid Member")
        paid_circle = create_circle(db, name="Paid Coaching", description="Subscription", owner_id=paid_owner.id)
        join_circle(db, paid_circle.id, paid_member.id)
        paid_circle.is_paid = True
        db.commit()
        try:
            leave_circle(db, paid_circle.id, paid_owner.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409
        print("   ✅ owner can't transfer a paid circle's ownership by leaving")

        # === 5. Non-member leave — 404 =====================================
        print("\n5. Non-member leave — 404")
        stranger = make_user(db, 800100008, "Stranger")
        try:
            leave_circle(db, circle.id, stranger.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 404
        print("   ✅ leaving a circle you're not in 404s")

        # === 6. Delete: non-owner 403; active subscription 409; expired ok =
        print("\n6. Delete permission and active-subscription guard")
        del_owner = make_user(db, 800100009, "Del Owner")
        del_member = make_user(db, 800100010, "Del Member")
        del_circle = create_circle(db, name="Deletable", description="Test", owner_id=del_owner.id)
        join_circle(db, del_circle.id, del_member.id)

        try:
            delete_circle(db, del_circle.id, del_member.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 403
        print("   ✅ non-owner delete is 403")

        active_sub = CircleSubscription(
            circle_id=del_circle.id, user_id=del_member.id,
            period_start=datetime.now(timezone.utc), period_end=datetime.now(timezone.utc) + timedelta(days=30),
            amount_etb=500, status="active",
        )
        db.add(active_sub)
        db.commit()
        try:
            delete_circle(db, del_circle.id, del_owner.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409
        print("   ✅ delete with an active subscription is 409")

        active_sub.status = "expired"
        db.commit()

        # === 7. Delete succeeds; disappears from every read path ==========
        print("\n7. Delete succeeds; hidden from every read path")
        public_post = create_post(db, user_id=del_owner.id, circle_id=del_circle.id, content="Ran 5k!")
        code = del_circle.join_code

        result = delete_circle(db, del_circle.id, del_owner.id)
        assert result == {"deleted": True}
        db.refresh(del_circle)
        assert del_circle.deleted_at is not None
        assert db.query(CircleMember).filter(CircleMember.circle_id == del_circle.id).count() == 0

        circle_ids_in_list = {c["id"] for c in get_circles(db, user_id=del_owner.id)}
        assert del_circle.id not in circle_ids_in_list

        assert get_circle_detail(db, del_circle.id, del_owner.id) is None
        assert join_circle_by_code(db, code, del_member.id) is None

        feed_posts = get_public_feed_posts(db, limit=50)
        assert public_post.id not in {p["id"] for p in feed_posts}

        social_proof = get_circle_social_proof(db, del_owner.id)
        assert social_proof == {"checked_in_today": 0}
        print("   ✅ deleted circle absent from list, detail, join-by-code, feed posts, social proof")

        # === 8. Members get a batched circle_deleted notification =========
        print("\n8. Batched circle_deleted notification")
        assert db.query(UserNotification).filter(
            UserNotification.user_id == del_member.id, UserNotification.type == "circle_deleted"
        ).first() is not None

        def make_circle_with_members(n):
            o = make_user(db, 800200000 + n, f"BulkOwner{n}")
            c = create_circle(db, name=f"Bulk{n}", description="x", owner_id=o.id)
            for i in range(n):
                mm = make_user(db, 800300000 + n * 100 + i, f"BulkMember{n}_{i}")
                join_circle(db, c.id, mm.id)
            return o, c

        def count_queries(fn):
            count = [0]
            def counter(*_a, **_k):
                count[0] += 1
            sa_event.listen(engine, "before_cursor_execute", counter)
            try:
                fn()
            finally:
                sa_event.remove(engine, "before_cursor_execute", counter)
            return count[0]

        o2, c2 = make_circle_with_members(2)
        o20, c20 = make_circle_with_members(20)
        q_small = count_queries(lambda: delete_circle(db, c2.id, o2.id))
        q_large = count_queries(lambda: delete_circle(db, c20.id, o20.id))
        assert q_small == q_large, (q_small, q_large)
        print(f"   ✅ notification insert batched — {q_small} queries regardless of member count (2 vs 20)")

        # === 9. Admin restore clears deleted_at; non-admin path is a 403 at
        #        the route layer (restore_circle itself has no admin check —
        #        that's enforced by the API dependency, tested at the crud
        #        boundary here as "restore un-deletes").
        print("\n9. Admin restore")
        restored = restore_circle(db, del_circle.id)
        assert restored.deleted_at is None
        assert del_circle.id in {c["id"] for c in get_circles(db, user_id=del_owner.id)}
        print("   ✅ restore clears deleted_at and the circle reappears")

        print("\n" + "=" * 50)
        print("  ALL LEAVE/DELETE CIRCLE TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
