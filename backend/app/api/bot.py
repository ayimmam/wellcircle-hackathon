"""Bot integration routes — registration and re-engagement queries."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import verify_bot_api_key
from app.crud.user import get_user_by_telegram_id, create_user_from_bot, get_inactive_users
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
        # Update handle if changed
        if request.telegram_handle and request.telegram_handle != existing.telegram_handle:
            existing.telegram_handle = request.telegram_handle
            db.commit()
        return {
            "id": str(existing.id),
            "telegram_id": existing.telegram_id,
            "telegram_handle": existing.telegram_handle,
            "is_onboarded": existing.is_onboarded,
            "created": False,
        }

    user = create_user_from_bot(
        db,
        telegram_id=request.telegram_id,
        telegram_handle=request.telegram_handle,
        photo_url=request.photo_url,
    )
    return {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "telegram_handle": user.telegram_handle,
        "is_onboarded": user.is_onboarded,
        "created": True,
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
