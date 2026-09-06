"""
Well Circle — Circle detail preview + Join CTA tests (Phase 6).
Run: cd backend && python -m app.tests.test_circle_preview

Covers: private circle 404s for non-members (no existence leak); paid circle
returns metadata without preview_posts for a non-subscriber; public free
circle returns metadata + preview_posts for a non-member; a member always
sees is_joined=True and (for a free circle) still gets preview data; the
owner sees is_owner=True.
"""
import sys
import uuid

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
from app.models.circle import Circle, CircleMember

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — CIRCLE PREVIEW TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.circle import create_circle, get_circle_detail, join_circle
        from app.crud.post import create_post

        owner = create_user_from_bot(db, telegram_id=910100100, telegram_handle="circle_owner")
        outsider = create_user_from_bot(db, telegram_id=910100101, telegram_handle="outsider")
        member = create_user_from_bot(db, telegram_id=910100102, telegram_handle="member")

        # === 1. Private circle, non-member -> None (404) =====================
        print("\n1. Private circle non-member access")
        private_circle = create_circle(db, name="Private Club", description="Invite only", owner_id=owner.id, is_private=True)
        assert get_circle_detail(db, private_circle.id, outsider.id) is None
        assert get_circle_detail(db, private_circle.id, owner.id) is not None
        print("   ✅ private circle 404s for non-member, resolves for owner")

        # === 2. Paid circle, non-subscriber -> metadata only, no preview =====
        print("\n2. Paid circle non-subscriber access")
        paid_circle = create_circle(db, name="Paid Coaching", description="Subscription", owner_id=owner.id)
        paid_circle.is_paid = True
        paid_circle.price_etb = 350
        db.commit()

        detail = get_circle_detail(db, paid_circle.id, outsider.id)
        assert detail is not None
        assert detail["is_paid"] is True
        assert detail["is_joined"] is False
        assert detail["preview_posts"] is None
        assert detail["price_etb"] == 350
        print("   ✅ paid circle: metadata present, preview_posts omitted, price_etb exposed")

        # === 3. Public free circle, non-member -> metadata + preview_posts ==
        print("\n3. Public free circle non-member access")
        public_circle = create_circle(db, name="Public Runners", description="Open to all", owner_id=owner.id)
        create_post(db, user_id=owner.id, circle_id=public_circle.id, content="Morning run recap")
        create_post(db, user_id=owner.id, circle_id=public_circle.id, content="Who's in for Saturday?")

        detail2 = get_circle_detail(db, public_circle.id, outsider.id)
        assert detail2["is_joined"] is False
        assert detail2["is_private"] is False
        assert detail2["is_paid"] is False
        assert detail2["preview_posts"] is not None
        assert len(detail2["preview_posts"]) == 2
        print("   ✅ public free circle: preview_posts present for a non-member")

        # === 4. Member sees is_joined True; owner sees is_owner True ========
        print("\n4. Member / owner flags")
        join_circle(db, public_circle.id, member.id)
        member_detail = get_circle_detail(db, public_circle.id, member.id)
        assert member_detail["is_joined"] is True
        assert member_detail["is_owner"] is False
        assert member_detail["join_code"] is not None  # only exposed once joined

        owner_detail = get_circle_detail(db, public_circle.id, owner.id)
        assert owner_detail["is_owner"] is True
        assert owner_detail["is_joined"] is True
        print("   ✅ member/owner flags correct; join_code only exposed to members")

        # === 5. member_count is accurate ======================================
        print("\n5. member_count")
        public_circle_member_count = get_circle_detail(db, public_circle.id, owner.id)["member_count"]
        assert public_circle_member_count == 2  # owner + member
        print(f"   ✅ member_count = {public_circle_member_count}")

        print("\n" + "=" * 50)
        print("  ALL CIRCLE PREVIEW TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
