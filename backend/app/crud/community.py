"""Community CRUD operations."""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.provider import Provider
from app.models.user import User


def get_all_communities(
    db: Session,
    user_id: Optional[UUID] = None,
    joined_only: bool = False,
    category: Optional[str] = None,
) -> List[dict]:
    """Get communities with provider info and user join status."""
    query = db.query(Community)
    if category:
        query = query.filter(Community.category == category)
    if joined_only and user_id:
        joined_ids = (
            db.query(CommunityMember.community_id)
            .filter(CommunityMember.user_id == user_id)
            .subquery()
        )
        query = query.filter(Community.id.in_(joined_ids))

    communities = query.order_by(Community.member_count.desc()).all()
    result = []
    for c in communities:
        provider = db.query(Provider).filter(Provider.id == c.provider_id).first()
        user_joined = False
        if user_id:
            membership = (
                db.query(CommunityMember)
                .filter(CommunityMember.community_id == c.id, CommunityMember.user_id == user_id)
                .first()
            )
            user_joined = membership is not None
        result.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "category": c.category,
            "member_count": c.member_count,
            "provider_name": provider.name if provider else None,
            "provider_id": str(provider.id) if provider else None,
            "user_joined": user_joined,
        })
    return result


def get_community_detail(db: Session, community_id: UUID, user_id: Optional[UUID] = None) -> Optional[dict]:
    """Get full community detail."""
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        return None
    provider = db.query(Provider).filter(Provider.id == community.provider_id).first()
    user_joined = False
    user_checked_in_today = False
    if user_id:
        membership = (
            db.query(CommunityMember)
            .filter(CommunityMember.community_id == community.id, CommunityMember.user_id == user_id)
            .first()
        )
        user_joined = membership is not None
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        checkin = (
            db.query(CommunityFeedEvent)
            .filter(
                CommunityFeedEvent.community_id == community.id,
                CommunityFeedEvent.user_id == user_id,
                CommunityFeedEvent.event_type == "checkin",
                CommunityFeedEvent.created_at >= today_start,
            )
            .first()
        )
        user_checked_in_today = checkin is not None
    return {
        "id": str(community.id),
        "name": community.name,
        "description": community.description,
        "category": community.category,
        "member_count": community.member_count,
        "provider": {
            "id": str(provider.id),
            "name": provider.name,
            "cover_photo_url": provider.cover_photo_url,
        } if provider else None,
        "user_joined": user_joined,
        "user_checked_in_today": user_checked_in_today,
        "created_at": community.created_at,
    }


def join_community(db: Session, community_id: UUID, user: User) -> Optional[dict]:
    """Join a community. Idempotent."""
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        return None
    existing = (
        db.query(CommunityMember)
        .filter(CommunityMember.community_id == community_id, CommunityMember.user_id == user.id)
        .first()
    )
    if existing:
        return {"community_id": str(community_id), "member_count": community.member_count, "joined": True, "feed_event": None}

    member = CommunityMember(community_id=community_id, user_id=user.id)
    db.add(member)
    community.member_count += 1
    event = CommunityFeedEvent(community_id=community_id, user_id=user.id, event_type="join")
    db.add(event)
    db.commit()
    db.refresh(event)
    return {
        "community_id": str(community_id),
        "member_count": community.member_count,
        "joined": True,
        "feed_event": {
            "id": str(event.id),
            "event_type": "join",
            "user_name": user.name or user.telegram_handle,
            "created_at": event.created_at,
        },
    }


def leave_community(db: Session, community_id: UUID, user_id: UUID) -> Optional[dict]:
    """Leave a community."""
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        return None
    membership = (
        db.query(CommunityMember)
        .filter(CommunityMember.community_id == community_id, CommunityMember.user_id == user_id)
        .first()
    )
    if not membership:
        return {"community_id": str(community_id), "member_count": community.member_count, "left": False}
    db.delete(membership)
    community.member_count = max(0, community.member_count - 1)
    db.commit()
    return {"community_id": str(community_id), "member_count": community.member_count, "left": True}


def checkin_community(db: Session, community_id: UUID, user: User):
    """Daily check-in. Returns dict, or string sentinel for errors."""
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        return None
    membership = (
        db.query(CommunityMember)
        .filter(CommunityMember.community_id == community_id, CommunityMember.user_id == user.id)
        .first()
    )
    if not membership:
        return "not_member"
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = (
        db.query(CommunityFeedEvent)
        .filter(
            CommunityFeedEvent.community_id == community_id,
            CommunityFeedEvent.user_id == user.id,
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= today_start,
        )
        .first()
    )
    if existing:
        return "already_checked_in"

    points_earned = 10
    user.points_balance += points_earned
    user.last_checkin_at = datetime.now(timezone.utc)
    event = CommunityFeedEvent(community_id=community_id, user_id=user.id, event_type="checkin")
    db.add(event)
    db.commit()
    db.refresh(event)

    from app.crud.user import get_points_tier
    tier, tier_emoji = get_points_tier(user.points_balance)
    return {
        "points_earned": points_earned,
        "new_balance": user.points_balance,
        "tier": tier,
        "tier_emoji": tier_emoji,
        "feed_event": {
            "id": str(event.id),
            "event_type": "checkin",
            "user_name": user.name or user.telegram_handle,
            "created_at": event.created_at,
        },
    }


def get_community_feed(db: Session, community_id: UUID, since: Optional[datetime] = None, limit: int = 20) -> List[dict]:
    """Get community feed events for polling."""
    query = db.query(CommunityFeedEvent).filter(CommunityFeedEvent.community_id == community_id)
    if since:
        query = query.filter(CommunityFeedEvent.created_at > since)
    events = query.order_by(CommunityFeedEvent.created_at.desc()).limit(min(limit, 50)).all()
    result = []
    for e in events:
        user = db.query(User).filter(User.id == e.user_id).first()
        result.append({
            "id": str(e.id),
            "event_type": e.event_type,
            "user_name": user.name or user.telegram_handle if user else None,
            "user_photo": user.photo_url if user else None,
            "event_metadata": e.event_metadata,
            "created_at": e.created_at,
        })
    return result


def get_suggested_communities(db: Session, interest_category: str, user_id: UUID, limit: int = 5) -> List[dict]:
    """Suggest communities based on interest, excluding already joined."""
    joined_ids = (
        db.query(CommunityMember.community_id)
        .filter(CommunityMember.user_id == user_id)
        .subquery()
    )
    communities = (
        db.query(Community)
        .filter(Community.category == interest_category, ~Community.id.in_(joined_ids))
        .order_by(Community.member_count.desc())
        .limit(limit)
        .all()
    )
    result = []
    for c in communities:
        provider = db.query(Provider).filter(Provider.id == c.provider_id).first()
        result.append({
            "id": str(c.id),
            "name": c.name,
            "category": c.category,
            "member_count": c.member_count,
            "provider_name": provider.name if provider else None,
        })
    return result
