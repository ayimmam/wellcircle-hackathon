"""Weekly ranks (leaderboard) aggregation — trailing 7-day positive point sums."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.point_transaction import PointTransaction
from app.models.user import User
from app.models.community import Community, CommunityMember

TOP_N = 20


def _since():
    return datetime.now(timezone.utc) - timedelta(days=7)


def get_top_users(db: Session, limit: int = TOP_N):
    since = _since()
    rows = (
        db.query(
            PointTransaction.user_id,
            func.sum(PointTransaction.amount).label("weekly_points"),
        )
        .filter(PointTransaction.amount > 0, PointTransaction.created_at >= since)
        .group_by(PointTransaction.user_id)
        .order_by(func.sum(PointTransaction.amount).desc())
        .limit(limit)
        .all()
    )
    user_ids = [r.user_id for r in rows]
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    results = []
    for i, row in enumerate(rows, start=1):
        user = users_by_id.get(row.user_id)
        results.append({
            "user_id": str(row.user_id),
            "name": user.name if user else "Unknown",
            "photo_url": user.photo_url if user else None,
            "weekly_points": int(row.weekly_points),
            "rank": i,
        })
    return results


def get_top_communities(db: Session, limit: int = TOP_N):
    since = _since()
    rows = (
        db.query(
            CommunityMember.community_id,
            func.sum(PointTransaction.amount).label("weekly_points"),
        )
        .join(PointTransaction, PointTransaction.user_id == CommunityMember.user_id)
        .filter(PointTransaction.amount > 0, PointTransaction.created_at >= since)
        .group_by(CommunityMember.community_id)
        .order_by(func.sum(PointTransaction.amount).desc())
        .limit(limit)
        .all()
    )
    community_ids = [r.community_id for r in rows]
    communities_by_id = (
        {c.id: c for c in db.query(Community).filter(Community.id.in_(community_ids)).all()}
        if community_ids else {}
    )

    results = []
    for i, row in enumerate(rows, start=1):
        community = communities_by_id.get(row.community_id)
        if not community:
            continue
        results.append({
            "community_id": str(row.community_id),
            "name": community.name,
            "member_count": community.member_count or 0,
            "weekly_points": int(row.weekly_points),
            "rank": i,
        })
    return results


def get_my_rank(db: Session, user_id):
    since = _since()
    my_points = (
        db.query(func.coalesce(func.sum(PointTransaction.amount), 0))
        .filter(
            PointTransaction.user_id == user_id,
            PointTransaction.amount > 0,
            PointTransaction.created_at >= since,
        )
        .scalar()
    )
    my_points = int(my_points or 0)

    if my_points <= 0:
        return {"rank": None, "weekly_points": 0}

    per_user = (
        db.query(
            PointTransaction.user_id,
            func.sum(PointTransaction.amount).label("weekly_points"),
        )
        .filter(PointTransaction.amount > 0, PointTransaction.created_at >= since)
        .group_by(PointTransaction.user_id)
        .subquery()
    )
    higher_count = (
        db.query(func.count())
        .select_from(per_user)
        .filter(per_user.c.weekly_points > my_points)
        .scalar()
    )
    return {"rank": int(higher_count or 0) + 1, "weekly_points": my_points}
