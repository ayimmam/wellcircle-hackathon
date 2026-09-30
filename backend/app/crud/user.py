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
    interest_categories: List[str],
    exercise_frequency: str,
    goal: Optional[str] = None,
) -> User:
    """Complete the Mini App onboarding. Awards one-time welcome points
    (endowed progress — the first-reward bar shouldn't start at zero)."""
    from app.models.point_transaction import PointTransaction
    from app.services.points import apply_transaction, POINTS_WELCOME, TXN_WELCOME

    user.name = name
    user.interest_categories = interest_categories
    user.exercise_frequency = exercise_frequency
    user.goal = goal
    was_onboarded = user.is_onboarded
    user.is_onboarded = True
    user.last_activity_at = datetime.now(timezone.utc)

    # Idempotent: the API already rejects re-onboarding, but guard the ledger
    # too so a retry can never double-award.
    already_welcomed = (
        db.query(PointTransaction.id)
        .filter(PointTransaction.user_id == user.id, PointTransaction.type == TXN_WELCOME)
        .first()
    )
    if not was_onboarded and not already_welcomed:
        apply_transaction(db, user, POINTS_WELCOME, TXN_WELCOME,
                          note="Welcome to Well Circle!")

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


def get_inactive_users(db: Session, days: int = 7, reengagement_cooldown_days: int = 7) -> List[User]:
    """Get onboarded users inactive for N+ days who haven't been re-engaged recently."""
    from datetime import timedelta
    from app.utils.pilot_time import pilot_day_start_utc
    now = datetime.now(timezone.utc)
    cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    reengagement_cutoff = now - timedelta(days=reengagement_cooldown_days)

    return (
        db.query(User)
        .filter(
            User.is_onboarded == True,
            User.proactive_notifications_enabled == True,
            (User.last_activity_at < cutoff) | (User.last_activity_at.is_(None)),
            (User.last_reengagement_at.is_(None)) | (User.last_reengagement_at < reengagement_cutoff),
            (User.last_proactive_reminder_at.is_(None)) | (User.last_proactive_reminder_at < pilot_day_start_utc()),
        )
        .all()
    )


def get_streaks_at_risk(db: Session) -> List[User]:
    """Users whose streak is alive but who haven't checked in today —
    i.e. last check-in was exactly yesterday. Feeds the bot's evening
    streak nudge (loss-aversion framing, ethically bounded: the streak is
    genuinely one missed day from needing a freeze/resetting)."""
    from datetime import timedelta
    from app.utils.pilot_time import pilot_day_start_utc
    today_start = pilot_day_start_utc()
    yesterday_start = today_start - timedelta(days=1)

    return (
        db.query(User)
        .filter(
            User.is_onboarded == True,
            User.proactive_notifications_enabled == True,
            User.current_streak > 0,
            User.last_checkin_at >= yesterday_start,
            User.last_checkin_at < today_start,
            (User.last_proactive_reminder_at.is_(None)) | (User.last_proactive_reminder_at < today_start),
        )
        .all()
    )


def mark_user_reengagement(db: Session, telegram_id: int) -> Optional[User]:
    user = get_user_by_telegram_id(db, telegram_id)
    if not user:
        return None
    user.last_reengagement_at = datetime.now(timezone.utc)
    user.last_proactive_reminder_at = user.last_reengagement_at
    db.commit()
    db.refresh(user)
    return user


def get_day1_return_users(db: Session) -> List[User]:
    """Users inactive since activation for at least one but fewer than seven days."""
    from datetime import timedelta
    from app.utils.pilot_time import pilot_day_start_utc
    now = datetime.now(timezone.utc)
    day1_cutoff = now - timedelta(days=1)
    older_cutoff = now - timedelta(days=7)
    day_start = pilot_day_start_utc()
    return (
        db.query(User)
        .filter(
            User.is_onboarded == True,
            User.proactive_notifications_enabled == True,
            User.last_activity_at <= day1_cutoff,
            User.last_activity_at > older_cutoff,
            User.day1_reminder_sent_at.is_(None),
            (User.last_proactive_reminder_at.is_(None)) | (User.last_proactive_reminder_at < day_start),
        )
        .all()
    )


def mark_user_day1_reminder(db: Session, telegram_id: int) -> Optional[User]:
    user = get_user_by_telegram_id(db, telegram_id)
    return mark_user_day1_reminder_for_user(db, user)


def mark_user_day1_reminder_for_user(db: Session, user: Optional[User]) -> Optional[User]:
    if not user:
        return None
    if user.day1_reminder_sent_at:
        return user
    now = datetime.now(timezone.utc)
    user.day1_reminder_sent_at = now
    user.last_proactive_reminder_at = now
    if not user.telegram_id:
        from app.services.notification_service import create_notification
        create_notification(
            db,
            user_id=user.id,
            type="day1_return_prompt",
            title="Ready for your next check-in?",
            body="Your community is here when you are. Pick up your wellness journey where you left off.",
            action_url="/community",
        )
    db.commit()
    db.refresh(user)
    return user


def mark_user_proactive_reminder(db: Session, telegram_id: int) -> Optional[User]:
    user = get_user_by_telegram_id(db, telegram_id)
    if not user:
        return None
    user.last_proactive_reminder_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user
