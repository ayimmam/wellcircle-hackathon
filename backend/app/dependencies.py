"""
Shared dependency injection for FastAPI routes.
Handles JWT auth, admin checks, and activity tracking.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()


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

    # Update last_activity_at for re-engagement tracking
    user.last_activity_at = datetime.now(timezone.utc)
    db.commit()

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
