"""Authentication routes — Telegram Mini App initData exchange for JWT."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.crud.user import (
    get_user_by_telegram_id,
    create_user_from_telegram_auth,
    get_user_joined_community_ids,
    get_points_tier,
)
from app.schemas.user import TelegramAuthRequest, AuthResponse, UserResponse
from app.services.telegram_auth import validate_init_data, validate_init_data_dev

router = APIRouter()


def _create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def _build_user_response(user, joined_communities) -> UserResponse:
    tier, tier_emoji = get_points_tier(user.points_balance)
    return UserResponse(
        id=str(user.id),
        telegram_id=user.telegram_id,
        telegram_handle=user.telegram_handle,
        name=user.name,
        photo_url=user.photo_url,
        goal=user.goal,
        interest_category=user.interest_category,
        exercise_frequency=user.exercise_frequency,
        points_balance=user.points_balance,
        tier=tier,
        tier_emoji=tier_emoji,
        is_onboarded=user.is_onboarded,
        is_provider=user.is_provider,
        is_super_admin=user.is_super_admin or user.telegram_id in settings.super_admin_ids,
        location_neighborhood=user.location_neighborhood,
        health_app_connected=user.health_app_connected,
        joined_communities=joined_communities,
        created_at=user.created_at,
    )


@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(request: TelegramAuthRequest, db: Session = Depends(get_db)):
    """
    Validate Telegram initData and return JWT + user profile.
    Creates user if first login (or if bot registered them, returns existing).
    """
    # Validate initData
    if settings.ENVIRONMENT == "development":
        user_data = validate_init_data_dev(request.init_data)
    else:
        user_data = validate_init_data(request.init_data)

    if not user_data or not user_data.get("telegram_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram initData",
        )

    telegram_id = user_data["telegram_id"]
    is_new = False

    # Find or create user
    user = get_user_by_telegram_id(db, telegram_id)
    if not user:
        user = create_user_from_telegram_auth(
            db,
            telegram_id=telegram_id,
            username=user_data.get("username"),
            photo_url=user_data.get("photo_url"),
        )
        is_new = True
    else:
        # Update photo/handle if changed
        if user_data.get("photo_url") and user_data["photo_url"] != user.photo_url:
            user.photo_url = user_data["photo_url"]
        if user_data.get("username") and user_data["username"] != user.telegram_handle:
            user.telegram_handle = user_data["username"]
        user.last_activity_at = datetime.now(timezone.utc)
        db.commit()

    # Check if should be super admin
    if telegram_id in settings.super_admin_ids and not user.is_super_admin:
        user.is_super_admin = True
        db.commit()

    token = _create_token(str(user.id))
    joined = get_user_joined_community_ids(db, user.id)

    return AuthResponse(
        token=token,
        user=_build_user_response(user, joined),
        is_new_user=is_new,
    )
