"""
Well Circle — Navigation tips / facilities tests (Phase 8).
Run: cd backend && python -m app.tests.test_navigation_tips

Covers: get_provider_detail exposes navigation_tips/facilities (empty list
when unset, never null); update_provider_me can set them; get_all_providers
(list) does not carry navigation_tips (detail-only per the plan).
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
from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_all():
    db = TestSession()
    try:
        print("=" * 50)
        print("  WELL CIRCLE — NAVIGATION TIPS / FACILITIES TESTS")
        print("=" * 50)

        from app.crud.user import create_user_from_bot
        from app.crud.provider import (
            create_provider, get_provider_detail, get_provider_me,
            update_provider_me, get_all_providers,
        )

        # === 1. Defaults to empty list, never null ===========================
        print("\n1. Defaults")
        owner = create_user_from_bot(db, telegram_id=920100100, telegram_handle="tips_owner")
        provider, _ = create_provider(
            db, name="Plain Studio", category="yoga",
            description="No tips yet", location_text="Bole",
            price_range="ETB 300-800", rating=4.2,
            services=[{"name": "Yoga Class", "price": 500, "duration": "60 min"}],
            owner_telegram_id=owner.telegram_id,
        )
        detail = get_provider_detail(db, provider.id)
        assert detail["navigation_tips"] == []
        assert detail["facilities"] == []
        print("   ✅ empty list, not null, when unset")

        # === 2. update_provider_me can set them ===============================
        print("\n2. update_provider_me")
        tips = [{"title": "Parking", "detail": "Free parking behind the building."}]
        facilities = ["Free parking", "Wheelchair accessible"]
        update_provider_me(db, owner, navigation_tips=tips, facilities=facilities)
        me = get_provider_me(db, owner)
        assert me["navigation_tips"] == tips
        assert me["facilities"] == facilities
        print("   ✅ update_provider_me sets navigation_tips/facilities")

        detail2 = get_provider_detail(db, provider.id)
        assert detail2["navigation_tips"] == tips
        assert detail2["facilities"] == facilities
        print("   ✅ get_provider_detail reflects the update")

        # === 3. List view omits navigation_tips (detail-only) ================
        print("\n3. List view")
        listing = get_all_providers(db)
        item = next(p for p in listing if p["id"] == str(provider.id))
        assert "navigation_tips" not in item
        print("   ✅ navigation_tips not present on the list response")

        print("\n" + "=" * 50)
        print("  ALL NAVIGATION TIPS / FACILITIES TESTS PASSED ✅")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    test_all()
