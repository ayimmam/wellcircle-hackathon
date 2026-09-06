"""
Shared dependency injection for FastAPI routes.
Handles JWT auth, admin checks, and activity tracking.
"""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.utils.logger import get_logger

logger = get_logger(__name__)

security = HTTPBearer()

# Only the bot's re-engagement sweep reads last_activity_at, and it works in
# terms of days idle. Writing it on literally every authenticated request cost a
# round trip to Supabase per call; at this granularity the signal is identical.
ACTIVITY_WRITE_INTERVAL = timedelta(minutes=10)


def _touch_activity(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    previous = user.last_activity_at
    if previous is not None:
        # Postgres hands back naive datetimes for TIMESTAMP WITHOUT TIME ZONE.
        if previous.tzinfo is None:
            previous = previous.replace(tzinfo=timezone.utc)
        if now - previous < ACTIVITY_WRITE_INTERVAL:
            return

    user.last_activity_at = now
    try:
        db.commit()
    except Exception:
        # Activity tracking is bookkeeping; never fail the user's request for it.
        db.rollback()
        logger.warning("Failed to update last_activity_at for user %s", user.id, exc_info=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate JWT token, return the authenticated User.
    Also updates last_activity_at for re-engagement tracking.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    _touch_activity(db, user)

    return user


async def get_current_provider(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is a provider."""
    if not current_user.is_provider:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider access required",
        )
    return current_user


async def get_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is a super admin."""
    if not current_user.is_super_admin and current_user.telegram_id not in settings.super_admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
) -> User | None:
    """Return authenticated user if JWT present, else None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    return db.query(User).filter(User.id == user_id).first()


async def verify_bot_api_key(
    x_bot_api_key: str = Header(..., alias="X-Bot-API-Key"),
) -> bool:
    """Verify the shared secret between bot and backend."""
    if x_bot_api_key != settings.BOT_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid bot API key",
        )
    return True
