"""User CRUD operations."""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.community import CommunityMember


def get_user_by_telegram_id(db: Session, telegram_id: int) -> Optional[User]:
    """Find a user by their Telegram ID."""
    return db.query(User).filter(User.telegram_id == telegram_id).first()


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    """Find a user by internal UUID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user_from_bot(
    db: Session,
    telegram_id: int,
    telegram_handle: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> User:
    """Create a minimal user record from bot /start."""
    user = User(
        telegram_id=telegram_id,
        telegram_handle=telegram_handle,
        photo_url=photo_url,
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_from_telegram_auth(
    db: Session,
    telegram_id: int,
    username: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> User:
    """Create user from Telegram Mini App initData (fallback if bot didn't register first)."""
    user = User(
        telegram_id=telegram_id,
        telegram_handle=username,
        photo_url=photo_url,
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def onboard_user(
    db: Session,
    user: User,
    name: str,
    interest_category: str,
    exercise_frequency: str,
    goal: Optional[str] = None,
) -> User:
    """Complete the Mini App onboarding."""
    user.name = name
    user.interest_category = interest_category
    user.exercise_frequency = exercise_frequency
    user.goal = goal
    user.is_onboarded = True
    user.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user: User,
    **kwargs,
) -> User:
    """Update user profile fields."""
    for key, value in kwargs.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def get_user_joined_community_ids(db: Session, user_id: UUID) -> List[str]:
    """Get list of community IDs the user has joined."""
    rows = (
        db.query(CommunityMember.community_id)
        .filter(CommunityMember.user_id == user_id)
        .all()
    )
    return [str(r.community_id) for r in rows]


def get_points_tier(balance: int) -> tuple:
    """Calculate tier from points balance. Returns (tier_name, emoji)."""
    if balance >= 700:
        return ("forest", "🌲")
    elif balance >= 300:
        return ("grove", "🌳")
    elif balance >= 100:
        return ("sprout", "🌿")
    else:
        return ("seed", "🌱")


def get_all_users(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    is_onboarded: Optional[bool] = None,
) -> tuple:
    """Get paginated list of all users (admin). Returns (users, total)."""
    query = db.query(User)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_filter)) |
            (User.telegram_handle.ilike(search_filter))
        )

    if is_onboarded is not None:
        query = query.filter(User.is_onboarded == is_onboarded)

    total = query.count()
    users = (
        query
        .order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return users, total


def get_inactive_users(db: Session, days: int = 7) -> List[User]:
    """Get users who haven't been active in the given number of days."""
    cutoff = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    from datetime import timedelta
    cutoff = cutoff - timedelta(days=days)

    return (
        db.query(User)
        .filter(
            User.is_onboarded == True,
            (User.last_activity_at < cutoff) | (User.last_activity_at.is_(None))
        )
        .all()
    )
