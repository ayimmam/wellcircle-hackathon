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
    from app.services.points import (
        apply_transaction, get_points_tier, POINTS_CHECKIN,
        TXN_CHECKIN, TXN_CHALLENGE,
    )

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

    points_earned = POINTS_CHECKIN
    apply_transaction(db, user, points_earned, TXN_CHECKIN,
                      reference_id=community.id,
                      note=f"Check-in: {community.name}")

    # E1: Referral credit — fires once, on the invitee's first-ever check-in
    # (not mere signup), to resist farming. last_checkin_at is still None here.
    is_first_checkin_ever = user.last_checkin_at is None
    if is_first_checkin_ever and user.referred_by:
        from app.services.points import (
            count_referrals_this_month, REFERRAL_MAX_PER_MONTH,
            POINTS_REFERRAL, TXN_REFERRAL,
        )
        referrer = db.query(User).filter(User.id == user.referred_by).first()
        if referrer and count_referrals_this_month(db, referrer.id) < REFERRAL_MAX_PER_MONTH:
            apply_transaction(db, referrer, POINTS_REFERRAL, TXN_REFERRAL,
                              reference_id=user.id,
                              note=f"Referral: {user.name or user.telegram_handle or 'new member'} joined")
            apply_transaction(db, user, POINTS_REFERRAL, TXN_REFERRAL,
                              reference_id=referrer.id,
                              note="Referral bonus: welcome!")
            from app.services.notification_service import create_notification
            create_notification(
                db, user_id=referrer.id, type="referral_credited",
                title="Referral bonus! 🎉",
                body=f"{user.name or user.telegram_handle or 'Your invite'} checked in for the first time — you earned {POINTS_REFERRAL} pts.",
                action_url="/points-history",
            )

    # C2: Streak tracking
    now = datetime.now(timezone.utc)
    if user.last_checkin_at:
        days_since = (now.date() - user.last_checkin_at.date()).days
        if days_since == 1:
            user.current_streak = (user.current_streak or 0) + 1
        elif days_since > 1:
            user.current_streak = 1
        # same day = no change (shouldn't reach here due to duplicate check)
    else:
        user.current_streak = 1

    # C2: Award streak freeze every 7-day streak
    if user.current_streak and user.current_streak % 7 == 0:
        user.freeze_count = (user.freeze_count or 0) + 1

    user.last_checkin_at = now
    event = CommunityFeedEvent(community_id=community_id, user_id=user.id, event_type="checkin")
    db.add(event)
    db.commit()
    db.refresh(event)

    # --- Phase 3: Challenge completion check ---
    from app.models.community_challenge import CommunityChallenge, ChallengeAward
    from app.services.notification_service import create_notification
    
    active_challenges = db.query(CommunityChallenge).filter(
        CommunityChallenge.community_id == community_id,
        CommunityChallenge.is_active == True,
        CommunityChallenge.starts_at <= datetime.now(timezone.utc),
        CommunityChallenge.ends_at >= datetime.now(timezone.utc)
    ).all()
    
    for challenge in active_challenges:
        # check user progress
        checkins = db.query(CommunityFeedEvent).filter(
            CommunityFeedEvent.user_id == user.id,
            CommunityFeedEvent.community_id == community_id,
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= challenge.starts_at,
            CommunityFeedEvent.created_at <= challenge.ends_at
        ).count()
        
        if checkins >= challenge.target_checkins:
            already_awarded = db.query(ChallengeAward).filter(
                ChallengeAward.challenge_id == challenge.id,
                ChallengeAward.user_id == user.id
            ).first()
            if not already_awarded:
                apply_transaction(db, user, challenge.reward_points, TXN_CHALLENGE,
                                  reference_id=challenge.id,
                                  note=f"Challenge: {challenge.title}")
                db.add(ChallengeAward(
                    challenge_id=challenge.id,
                    user_id=user.id,
                    points_given=challenge.reward_points
                ))
                create_notification(
                    db,
                    user_id=user.id,
                    type="challenge_completed",
                    title="Challenge Completed! 🏆",
                    body=f"You completed '{challenge.title}' and earned {challenge.reward_points} pts!",
                    action_url=f"/community/{community_id}"
                )
    db.commit()
    # -------------------------------------------

    tier, tier_emoji = get_points_tier(user.points_balance)
    return {
        "points_earned": points_earned,
        "new_balance": user.points_balance,
        "current_streak": user.current_streak or 0,
        "freeze_count": user.freeze_count or 0,
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
