import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.circle import Circle, CircleMember
from app.models.user import User
from app.models.point_transaction import PointTransaction
from app.models.community import CommunityFeedEvent


def _generate_join_code(db: Session) -> str:
    """8-char uppercase/digit code — short enough to share, and restricted to
    characters Telegram's `?startapp=` deep-link param accepts. Mirrors
    provider_invite.py's generation + uniqueness-check pattern."""
    chars = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(chars) for _ in range(8))
    while db.query(Circle).filter(Circle.join_code == code).first():
        code = "".join(secrets.choice(chars) for _ in range(8))
    return code


def create_circle(db: Session, name: str, description: str, owner_id: UUID, is_private: bool = False, join_code: str = None) -> Circle:
    # Every circle gets a shareable join_code, even public ones — it's what
    # powers the `?startapp=circle_{code}` invite-link flow, not just private
    # access control.
    if not join_code:
        join_code = _generate_join_code(db)
    circle = Circle(name=name, description=description, owner_id=owner_id, is_private=is_private, join_code=join_code)
    db.add(circle)
    db.flush()
    # Add owner as member
    member = CircleMember(circle_id=circle.id, user_id=owner_id)
    db.add(member)
    db.commit()
    db.refresh(circle)
    return circle

def join_circle(db: Session, circle_id: UUID, user_id: UUID, join_code: str = None) -> Optional[Circle]:
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        return None
        
    if getattr(circle, 'is_private', False):
        if not join_code or getattr(circle, 'join_code', None) != join_code:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Invalid or missing join code for private circle")

    
    member = db.query(CircleMember).filter(
        CircleMember.circle_id == circle_id,
        CircleMember.user_id == user_id
    ).first()
    
    if not member:
        member = CircleMember(circle_id=circle_id, user_id=user_id)
        db.add(member)
        db.commit()
        
    return circle

def get_circles(db: Session, user_id: Optional[UUID] = None) -> List[dict]:
    circles = db.query(Circle).all()
    result = []
    for c in circles:
        member_count = db.query(CircleMember).filter(CircleMember.circle_id == c.id).count()
        is_joined = False
        if user_id:
            m = db.query(CircleMember).filter(CircleMember.circle_id == c.id, CircleMember.user_id == user_id).first()
            is_joined = m is not None
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "owner_id": c.owner_id,
            "member_count": member_count,
            "is_joined": is_joined,
            "is_private": getattr(c, "is_private", False),
            # E1: only expose the invite code to existing members — it's the
            # access gate for private circles, so browsers who haven't joined
            # shouldn't see it.
            "join_code": c.join_code if is_joined else None,
            "created_at": c.created_at
        })
    return result

def _weekly_points_by_user(db: Session, user_ids: List[UUID]) -> dict:
    """Sum of positive ledger transactions in the trailing 7 days, per user.

    Replaces the never-written CircleMember.weekly_points column — that field
    was only ever populated by seed data, so it read 0 for real users. The
    ledger (B1) is the source of truth; this derives the same "this week"
    number on demand instead of needing a reset cron.
    """
    if not user_ids:
        return {}
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    rows = (
        db.query(PointTransaction.user_id, func.coalesce(func.sum(PointTransaction.amount), 0))
        .filter(
            PointTransaction.user_id.in_(user_ids),
            PointTransaction.amount > 0,
            PointTransaction.created_at >= week_start,
            PointTransaction.reversed_by.is_(None),
        )
        .group_by(PointTransaction.user_id)
        .all()
    )
    return {uid: int(total) for uid, total in rows}


def get_circle_leaderboard(db: Session, circle_id: UUID) -> List[dict]:
    members = db.query(CircleMember, User).join(User, CircleMember.user_id == User.id)\
        .filter(CircleMember.circle_id == circle_id).all()

    weekly = _weekly_points_by_user(db, [u.id for _, u in members])

    result = [{
        "user_id": u.id,
        "name": u.name,
        "telegram_handle": u.telegram_handle,
        "photo_url": u.photo_url,
        "weekly_points": weekly.get(u.id, 0),
        "total_points": u.points_balance
    } for cm, u in members]
    result.sort(key=lambda r: r["weekly_points"], reverse=True)
    return result


def join_circle_by_code(db: Session, join_code: str, user_id: UUID) -> Optional[Circle]:
    """E1: resolve a circle from its join_code (used by the ?startapp=circle_{code}
    deep link) and join it. join_code is treated as the shareable token regardless
    of the circle's is_private flag — the link itself is the invite."""
    circle = db.query(Circle).filter(Circle.join_code == join_code).first()
    if not circle:
        return None

    member = db.query(CircleMember).filter(
        CircleMember.circle_id == circle.id,
        CircleMember.user_id == user_id,
    ).first()
    if not member:
        member = CircleMember(circle_id=circle.id, user_id=user_id)
        db.add(member)
        db.commit()
    return circle


def get_circle_social_proof(db: Session, user_id: UUID) -> dict:
    """E2: how many circle-mates (across all the user's circles) checked in today."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    my_circle_ids = [
        row[0] for row in
        db.query(CircleMember.circle_id).filter(CircleMember.user_id == user_id).all()
    ]
    if not my_circle_ids:
        return {"checked_in_today": 0}

    mate_ids = {
        row[0] for row in
        db.query(CircleMember.user_id)
        .filter(CircleMember.circle_id.in_(my_circle_ids), CircleMember.user_id != user_id)
        .all()
    }
    if not mate_ids:
        return {"checked_in_today": 0}

    checked_in = (
        db.query(CommunityFeedEvent.user_id)
        .filter(
            CommunityFeedEvent.user_id.in_(mate_ids),
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= today_start,
        )
        .distinct()
        .count()
    )
    return {"checked_in_today": checked_in}


def get_weekly_digest_circles(db: Session) -> List[dict]:
    """C3: per circle, the weekly top scorer + member Telegram IDs, for the
    bot's Sunday digest job."""
    circles = db.query(Circle).all()
    result = []
    for c in circles:
        members = db.query(CircleMember, User).join(User, CircleMember.user_id == User.id)\
            .filter(CircleMember.circle_id == c.id).all()
        if len(members) < 2:
            continue  # nothing social to report for solo circles

        weekly = _weekly_points_by_user(db, [u.id for _, u in members])
        ranked = sorted(members, key=lambda m: weekly.get(m[1].id, 0), reverse=True)
        top_user = ranked[0][1]
        top_points = weekly.get(top_user.id, 0)
        if top_points <= 0:
            continue  # nobody earned anything this week — skip the digest

        result.append({
            "circle_id": str(c.id),
            "circle_name": c.name,
            "top_scorer_name": top_user.name or top_user.telegram_handle or "Someone",
            "top_scorer_points": top_points,
            "member_telegram_ids": [u.telegram_id for _, u in members if u.telegram_id],
        })
    return result
