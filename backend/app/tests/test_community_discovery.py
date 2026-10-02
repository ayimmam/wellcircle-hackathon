"""Discovery counts real weekly participants, without counting signup activity."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Reuse the suite's PostgreSQL type adapters for SQLite.
from app.tests.test_integration import Base
from app.models.community import Community, CommunityFeedEvent
from app.models.provider import Provider
from app.models.user import User
from app.crud.community import get_all_communities


def test_weekly_participation_is_distinct_recent_checkins_and_batched():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with sessionmaker(bind=engine)() as db:
        users = [User(id=uuid.uuid4(), telegram_id=9100 + i) for i in range(2)]
        provider = Provider(id=uuid.uuid4(), name="Yoga", category="yoga")
        communities = [Community(id=uuid.uuid4(), provider_id=provider.id,
                                 name=f"Group {i}", category="yoga", member_count=20)
                       for i in range(3)]
        db.add_all([*users, provider, *communities])
        db.flush()
        for user, event_type, age in [
            (users[0], "checkin", 1), (users[0], "checkin", 2),
            (users[1], "checkin", 3), (users[1], "join", 1),
        ]:
            db.add(CommunityFeedEvent(community_id=communities[0].id,
                                      user_id=user.id, event_type=event_type,
                                      created_at=now - timedelta(days=age)))
        for event_type, age in [("checkin", 8), ("join", 1), ("checkin", -1)]:
            db.add(CommunityFeedEvent(community_id=communities[1].id,
                                      user_id=users[0].id, event_type=event_type,
                                      created_at=now - timedelta(days=age)))
        db.commit()
        statements = []
        event.listen(engine, "before_cursor_execute",
                     lambda conn, cursor, statement, params, ctx, many: statements.append(statement))
        result = {row["id"]: row for row in get_all_communities(db)}
        assert result[str(communities[0].id)]["active_members_7d"] == 2
        assert result[str(communities[1].id)]["active_members_7d"] == 0
        assert result[str(communities[2].id)]["active_members_7d"] == 0
        # One activity aggregate, regardless of how many cards are returned.
        aggregates = [s for s in statements if "count(distinct" in s.lower()]
        assert len(aggregates) == 1
        assert get_all_communities(db, category="spa") == []
