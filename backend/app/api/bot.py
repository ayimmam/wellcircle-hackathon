"""Bot integration routes — registration and re-engagement queries."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import verify_bot_api_key
from app.crud.user import get_user_by_telegram_id, create_user_from_bot, get_inactive_users, mark_user_reengagement
from app.schemas.user import BotRegisterRequest

router = APIRouter()


@router.post("/register")
async def bot_register(
    request: BotRegisterRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Called by Telegram bot on /start. Creates minimal user record. Idempotent."""
    existing = get_user_by_telegram_id(db, request.telegram_id)
    if existing:
        # Update handle / photo if changed
        changed = False
        if request.telegram_handle and request.telegram_handle != existing.telegram_handle:
            existing.telegram_handle = request.telegram_handle
            changed = True
        if request.photo_url and request.photo_url != existing.photo_url:
            existing.photo_url = request.photo_url
            changed = True
        if changed:
            db.commit()
        is_admin = (
            existing.telegram_id in settings.super_admin_ids or existing.is_super_admin
        )
        return {
            "id": str(existing.id),
            "telegram_id": existing.telegram_id,
            "telegram_handle": existing.telegram_handle,
            "is_onboarded": existing.is_onboarded,
            "is_super_admin": is_admin,
            "created": False,
        }

    user = create_user_from_bot(
        db,
        telegram_id=request.telegram_id,
        telegram_handle=request.telegram_handle,
        photo_url=request.photo_url,
    )
    is_admin = user.telegram_id in settings.super_admin_ids or user.is_super_admin
    return {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "telegram_handle": user.telegram_handle,
        "is_onboarded": user.is_onboarded,
        "is_super_admin": is_admin,
        "created": True,
    }


@router.get("/users/{telegram_id}/admin-access")
async def bot_admin_access(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Check if a Telegram user has super-admin access (for /admin bot command)."""
    user = get_user_by_telegram_id(db, telegram_id)
    is_admin = (
        telegram_id in settings.super_admin_ids
        or (user is not None and user.is_super_admin)
    )
    return {
        "telegram_id": telegram_id,
        "is_super_admin": is_admin,
        "user_exists": user is not None,
    }


@router.get("/inactive-users")
async def inactive_users(
    days: int = 7,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Returns users inactive for N+ days (for re-engagement notifications)."""
    users = get_inactive_users(db, days=days)
    now = datetime.now(timezone.utc)
    items = []
    for u in users:
        days_inactive = (now - u.last_activity_at).days if u.last_activity_at else 999
        items.append({
            "telegram_id": u.telegram_id,
            "name": u.name or u.telegram_handle or "User",
            "telegram_handle": u.telegram_handle,
            "last_activity_at": u.last_activity_at.isoformat() if u.last_activity_at else None,
            "days_inactive": days_inactive,
        })
    return {"inactive_users": items, "count": len(items)}


@router.post("/users/{telegram_id}/reengagement-sent")
async def bot_reengagement_sent(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Mark that a re-engagement message was sent to this user."""
    user = mark_user_reengagement(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"telegram_id": telegram_id, "marked": True}
